/**
 * WebSocket Server Implementation
 *
 * Provides real-time updates for bill and vote events using room-based pub/sub.
 * Clients subscribe to topics like `bill:{billId}` to receive targeted updates.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { logger } from '../lib/logger.js';
import { roomManager } from './room-manager.js';
import { authenticateWebSocketRequest } from './auth.js';
import type {
  ExtendedWebSocket,
  ClientMessage,
  ServerMessage,
  WsErrorCode,
} from './types.js';
import { WS_ERROR_CODES } from './types.js';
import type { WebSocketEvent } from '@ltip/shared';

// ============================================================================
// Configuration
// ============================================================================

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
// Note: Client timeout is implicitly 1 heartbeat interval (clients that don't respond to ping are terminated)

// ============================================================================
// State
// ============================================================================

let wss: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize WebSocket server attached to HTTP server
 */
export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', handleConnection);

  // Start heartbeat check
  heartbeatInterval = setInterval(checkHeartbeats, HEARTBEAT_INTERVAL_MS);

  logger.info('WebSocket server started on /ws');
}

/**
 * Gracefully shutdown WebSocket server
 */
export function shutdownWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (!wss) {
      resolve();
      return;
    }

    // Close all client connections
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }

    wss.close(() => {
      logger.info('WebSocket server closed');
      wss = null;
      resolve();
    });
  });
}

/**
 * Broadcast an event to all clients subscribed to a specific room
 */
export function broadcastToRoom(room: string, event: WebSocketEvent): void {
  const clients = roomManager.getClients(room);
  const message = JSON.stringify(event);

  let sentCount = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  }

  logger.debug({ room, type: event.type, sentCount, totalInRoom: clients.size }, 'Broadcast to room');
}

/**
 * Broadcast an event to all connected clients (use sparingly)
 */
export function broadcast(event: WebSocketEvent): void {
  if (!wss) return;

  const message = JSON.stringify(event);
  let sentCount = 0;

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  }

  logger.debug({ type: event.type, sentCount }, 'Broadcast to all');
}

/**
 * Get WebSocket server statistics
 */
export function getStats(): {
  connected: number;
  rooms: Record<string, number>;
  totalSubscriptions: number;
} {
  const roomStats = roomManager.getStats();
  return {
    connected: wss?.clients.size ?? 0,
    rooms: roomStats.rooms,
    totalSubscriptions: roomStats.totalSubscriptions,
  };
}

/**
 * Get current connected client count
 */
export function getClientCount(): number {
  return wss?.clients.size ?? 0;
}

// ============================================================================
// Connection Handling
// ============================================================================

function handleConnection(ws: WebSocket, req: IncomingMessage): void {
  const extWs = ws as ExtendedWebSocket;

  // Authenticate the connection
  const authResult = authenticateWebSocketRequest(req);
  if (!authResult.authenticated) {
    logger.warn({ error: authResult.error }, 'WebSocket authentication failed');
    ws.close(4001, authResult.error ?? 'Authentication failed');
    return;
  }

  // Generate client ID and store user info
  extWs.clientId = generateClientId();
  if (authResult.userId !== undefined) {
    extWs.userId = authResult.userId;
  }
  extWs.isAlive = true;
  extWs.subscribedAt = new Date();

  const clientIp = req.socket.remoteAddress ?? 'unknown';
  logger.info(
    { clientId: extWs.clientId, userId: extWs.userId, ip: clientIp },
    'WebSocket client connected'
  );

  // Send connection confirmation
  sendMessage(extWs, {
    type: 'connection:established',
    data: {
      clientId: extWs.clientId,
      timestamp: new Date().toISOString(),
    },
  });

  // Set up event handlers
  extWs.on('message', (data) => handleMessage(extWs, data));
  extWs.on('pong', () => handlePong(extWs));
  extWs.on('close', () => handleClose(extWs));
  extWs.on('error', (error) => handleError(extWs, error));
}

// ============================================================================
// Message Handling
// ============================================================================

function handleMessage(ws: ExtendedWebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
  try {
    const message = JSON.parse(data.toString()) as ClientMessage;
    logger.debug({ clientId: ws.clientId, type: message.type }, 'Message received');

    switch (message.type) {
      case 'ping':
        handlePing(ws);
        break;

      case 'subscribe':
        handleSubscribe(ws, message.topic);
        break;

      case 'unsubscribe':
        handleUnsubscribe(ws, message.topic);
        break;

      default:
        sendError(ws, WS_ERROR_CODES.INVALID_MESSAGE, 'Unknown message type');
    }
  } catch (error) {
    logger.warn({ clientId: ws.clientId, error }, 'Invalid message format');
    sendError(ws, WS_ERROR_CODES.INVALID_MESSAGE, 'Invalid JSON');
  }
}

function handlePing(ws: ExtendedWebSocket): void {
  sendMessage(ws, {
    type: 'pong',
    timestamp: new Date().toISOString(),
  });
}

function handleSubscribe(ws: ExtendedWebSocket, topic: string): void {
  const subscribed = roomManager.subscribe(ws, topic);

  if (subscribed) {
    sendMessage(ws, {
      type: 'subscribed',
      data: {
        topic,
        timestamp: new Date().toISOString(),
      },
    });
    logger.info({ clientId: ws.clientId, topic }, 'Client subscribed');
  } else {
    // Either already subscribed or invalid topic
    const existingRooms = roomManager.getClientRooms(ws);
    if (existingRooms.has(topic)) {
      // Already subscribed - send confirmation anyway
      sendMessage(ws, {
        type: 'subscribed',
        data: {
          topic,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      sendError(ws, WS_ERROR_CODES.INVALID_TOPIC, `Invalid topic format: ${topic}`);
    }
  }
}

function handleUnsubscribe(ws: ExtendedWebSocket, topic: string): void {
  const unsubscribed = roomManager.unsubscribe(ws, topic);

  sendMessage(ws, {
    type: 'unsubscribed',
    data: {
      topic,
      timestamp: new Date().toISOString(),
    },
  });

  if (unsubscribed) {
    logger.info({ clientId: ws.clientId, topic }, 'Client unsubscribed');
  }
}

function handlePong(ws: ExtendedWebSocket): void {
  ws.isAlive = true;
}

function handleClose(ws: ExtendedWebSocket): void {
  const removedRooms = roomManager.removeClient(ws);
  logger.info(
    { clientId: ws.clientId, removedRooms: removedRooms.length },
    'WebSocket client disconnected'
  );
}

function handleError(ws: ExtendedWebSocket, error: Error): void {
  logger.error({ clientId: ws.clientId, error: error.message }, 'WebSocket error');
  roomManager.removeClient(ws);
}

// ============================================================================
// Heartbeat
// ============================================================================

function checkHeartbeats(): void {
  if (!wss) return;

  for (const client of wss.clients) {
    const extClient = client as ExtendedWebSocket;

    if (!extClient.isAlive) {
      logger.debug({ clientId: extClient.clientId }, 'Client timed out, terminating');
      roomManager.removeClient(extClient);
      extClient.terminate();
      continue;
    }

    extClient.isAlive = false;
    extClient.ping();
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sendMessage(ws: ExtendedWebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: ExtendedWebSocket, code: WsErrorCode, message: string): void {
  sendMessage(ws, {
    type: 'error',
    data: { code, message },
  });
}

function generateClientId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
