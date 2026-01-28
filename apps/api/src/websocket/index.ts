import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WebSocketEvent } from '@ltip/shared';
import { logger } from '../lib/logger.js';

const clients = new Set<WebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).slice(2, 11);
    logger.info({ clientId, ip: req.socket.remoteAddress }, 'WebSocket client connected');

    clients.add(ws);

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: 'connection:established',
        data: { clientId, timestamp: new Date().toISOString() },
      })
    );

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug({ clientId, message }, 'WebSocket message received');

        // Handle ping/pong
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }

        // Handle subscription requests
        if (message.type === 'subscribe') {
          // TODO: Implement subscription logic for specific bills/votes
          logger.info({ clientId, topic: message.topic }, 'Client subscribed');
        }
      } catch (error) {
        logger.warn({ clientId, error }, 'Invalid WebSocket message');
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ clientId }, 'WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error({ clientId, error }, 'WebSocket error');
      clients.delete(ws);
    });
  });

  logger.info('WebSocket server started on /ws');
}

/**
 * Broadcast an event to all connected WebSocket clients
 */
export function broadcast(event: WebSocketEvent) {
  const message = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  logger.debug({ type: event.type, clientCount: clients.size }, 'Broadcast sent');
}

/**
 * Get current connected client count
 */
export function getClientCount(): number {
  return clients.size;
}
