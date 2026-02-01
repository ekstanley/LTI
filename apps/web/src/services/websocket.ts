/**
 * WebSocket Client Service - Secure Header-Based Authentication
 *
 * SECURITY: Uses Sec-WebSocket-Protocol header for token transmission
 * Query string tokens are NEVER used to prevent token leakage in:
 * - Server logs
 * - Browser history
 * - Proxy logs
 * - Referrer headers
 * - Analytics tools
 *
 * @module services/websocket
 */

import type { WebSocketEvent } from '@ltip/shared';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WebSocketConfig {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface SubscriptionOptions {
  onMessage?: (event: WebSocketEvent) => void;
  onError?: (error: Error) => void;
}

export type MessageHandler = (event: WebSocketEvent) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

// ============================================================================
// WebSocket Client Service
// ============================================================================

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<Omit<WebSocketConfig, 'token'>> & { token?: string };
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private messageQueue: Array<Record<string, unknown>> = [];

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      ...(config.token && { token: config.token }),
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      heartbeatInterval: config.heartbeatInterval ?? 25000, // Slightly less than server's 30s
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to WebSocket server using header-based authentication
   *
   * SECURITY: Token passed via Sec-WebSocket-Protocol header (RFC 6455)
   * Format: "token.<jwt>" where <jwt> is the actual JWT
   *
   * This prevents token leakage in:
   * - Access logs (query strings are logged)
   * - Browser history
   * - Proxy logs
   * - Referrer headers
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.status === 'connecting') {
      return;
    }

    this.updateStatus('connecting');

    try {
      // SECURITY: Use header-based authentication via protocol parameter
      // This is the ONLY secure way to pass tokens in WebSocket connections
      const protocols = this.config.token ? [`token.${this.config.token}`] : [];

      // CRITICAL: Never append token to URL
      // ❌ BAD:  `${this.config.url}?token=${token}`
      // ✅ GOOD: Use protocols parameter (Sec-WebSocket-Protocol header)
      this.ws = new WebSocket(this.config.url, protocols);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.config.reconnect = false; // Disable auto-reconnect
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.updateStatus('disconnected');
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe to a topic (e.g., 'bill:hr-1234-118')
   */
  subscribe(topic: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());

      // Send subscription message to server
      if (this.isConnected()) {
        this.send({ type: 'subscribe', topic });
      } else {
        // Queue for when connection is established
        this.messageQueue.push({ type: 'subscribe', topic });
      }
    }

    const handlers = this.subscriptions.get(topic)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(topic);
        if (this.isConnected()) {
          this.send({ type: 'unsubscribe', topic });
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Immediately call with current status
    handler(this.status);

    // Return unsubscribe function
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.updateStatus('connected');

    // Send queued subscription messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }

    // Start heartbeat
    this.startHeartbeat();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as { type: string; data?: any };

      // Handle server messages
      if (data.type === 'pong' || data.type === 'connection:established') {
        return; // Heartbeat acknowledgment
      }

      if (data.type === 'subscribed' || data.type === 'unsubscribed') {
        // Subscription confirmation - log but don't dispatch
        return;
      }

      if (data.type === 'error') {
        const error = new Error(data.data?.message ?? 'WebSocket error');
        this.handleError(error);
        return;
      }

      // Dispatch to topic subscribers (application events)
      // Event format: { type: 'bill:updated', data: { billId: '...', ... } }
      const appEvent = data as WebSocketEvent;
      const topic = this.extractTopic(appEvent);
      if (topic) {
        const handlers = this.subscriptions.get(topic);
        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(appEvent);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleError(error: Event | Error): void {
    console.error('WebSocket error:', error);
    this.updateStatus('error');
  }

  private handleClose(_event: CloseEvent): void {
    this.cleanup();

    // Check if we should reconnect
    if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.updateStatus('reconnecting');
      this.reconnectAttempts++;

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, this.config.reconnectInterval);
    } else {
      this.updateStatus('disconnected');
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);
    this.updateStatus('error');
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, queueing message');
      this.messageQueue.push(message);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusHandlers.forEach((handler) => {
      try {
        handler(status);
      } catch (error) {
        console.error('Error in status handler:', error);
      }
    });
  }

  private extractTopic(event: WebSocketEvent): string | null {
    // Extract topic from event type (e.g., 'bill:updated' -> 'bill:xxx')
    // This depends on your event structure
    if (event.type.startsWith('bill:') && 'billId' in event.data && event.data.billId) {
      return `bill:${event.data.billId}`;
    }
    if (event.type.startsWith('vote:') && 'voteId' in event.data && event.data.voteId) {
      return `vote:${event.data.voteId}`;
    }
    if (event.type.startsWith('legislator:') && 'legislatorId' in event.data && event.data.legislatorId) {
      return `legislator:${event.data.legislatorId}`;
    }
    return null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WebSocket service instance
 *
 * @example
 * ```typescript
 * const ws = createWebSocketService({
 *   url: 'ws://localhost:4001/ws',
 *   token: getAccessToken(), // From auth service
 *   reconnect: true
 * });
 *
 * ws.connect();
 *
 * // Subscribe to bill updates
 * const unsubscribe = ws.subscribe('bill:hr-1234-118', (event) => {
 *   console.log('Bill updated:', event.data);
 * });
 *
 * // Later: unsubscribe()
 * ```
 */
export function createWebSocketService(config: WebSocketConfig): WebSocketService {
  return new WebSocketService(config);
}
