/**
 * WebSocket message types for client-server communication
 */

import type { WebSocket } from 'ws';

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface SubscribeMessage {
  type: 'subscribe';
  topic: string;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  topic: string;
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface ConnectionEstablishedMessage {
  type: 'connection:established';
  data: {
    clientId: string;
    timestamp: string;
  };
}

export interface SubscribedMessage {
  type: 'subscribed';
  data: {
    topic: string;
    timestamp: string;
  };
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  data: {
    topic: string;
    timestamp: string;
  };
}

export interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  data: {
    code: string;
    message: string;
  };
}

// Re-export event types from shared for convenience
export type {
  WebSocketEvent,
  VoteUpdateEvent,
  TallyUpdateEvent,
  BillStatusChangeEvent,
} from '@ltip/shared';

export type ServerMessage =
  | ConnectionEstablishedMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | PongMessage
  | ErrorMessage;

// ============================================================================
// Extended WebSocket with metadata
// ============================================================================

export interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  userId?: string;
  isAlive: boolean;
  subscribedAt?: Date;
}

// ============================================================================
// Error codes
// ============================================================================

export const WS_ERROR_CODES = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_TOPIC: 'INVALID_TOPIC',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type WsErrorCode = (typeof WS_ERROR_CODES)[keyof typeof WS_ERROR_CODES];
