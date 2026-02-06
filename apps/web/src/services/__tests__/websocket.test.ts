/**
 * Tests for WebSocketService
 * @module services/__tests__/websocket.test
 *
 * Uses a lightweight MockWebSocket class to simulate the global WebSocket API.
 * Timer-dependent tests use vi.useFakeTimers() for heartbeat/reconnection control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebSocketService,
  createWebSocketService,
  type WebSocketConfig,
  type ConnectionStatus,
} from '../websocket';

// ============================================================================
// Mock WebSocket
// ============================================================================

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  protocol: string;
  protocols: string | string[];
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // Track calls for assertions
  sentMessages: string[] = [];
  closeCode: number | undefined = undefined;
  closeReason: string | undefined = undefined;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? [];
    this.protocol = Array.isArray(protocols) ? (protocols[0] ?? '') : (protocols ?? '');
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = MockWebSocket.CLOSED;
  }

  // Helpers for simulating server events
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
  }

  simulateMessage(data: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  // Static registry for test assertions
  static instances: MockWebSocket[] = [];
  static reset(): void {
    MockWebSocket.instances = [];
  }
  static get latest(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  // Satisfy WebSocket interface stubs
  addEventListener(): void { /* noop */ }
  removeEventListener(): void { /* noop */ }
  dispatchEvent(): boolean { return true; }
  get bufferedAmount(): number { return 0; }
  get extensions(): string { return ''; }
  binaryType: BinaryType = 'blob';
}

// ============================================================================
// Test Setup
// ============================================================================

const defaultConfig: WebSocketConfig = {
  url: 'ws://localhost:4001/ws',
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 3,
  heartbeatInterval: 5000,
};

function createService(overrides?: Partial<WebSocketConfig>): WebSocketService {
  return new WebSocketService({ ...defaultConfig, ...overrides });
}

describe('WebSocketService', () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  describe('connect()', () => {
    it('should create a WebSocket with the configured URL', () => {
      const service = createService();
      service.connect();

      expect(MockWebSocket.latest).toBeDefined();
      expect(MockWebSocket.latest!.url).toBe('ws://localhost:4001/ws');
    });

    it('should pass token via Sec-WebSocket-Protocol header (protocols param)', () => {
      const service = createService({ token: 'my-jwt-token' });
      service.connect();

      expect(MockWebSocket.latest!.protocols).toEqual(['token.my-jwt-token']);
    });

    it('should NOT include protocols when no token is provided', () => {
      const service = createService();
      service.connect();

      expect(MockWebSocket.latest!.protocols).toEqual([]);
    });

    it('should NOT append token to URL (security invariant)', () => {
      const service = createService({ token: 'secret-token' });
      service.connect();

      expect(MockWebSocket.latest!.url).not.toContain('token');
      expect(MockWebSocket.latest!.url).not.toContain('secret');
      expect(MockWebSocket.latest!.url).toBe('ws://localhost:4001/ws');
    });

    it('should set status to "connecting" on connect', () => {
      const service = createService();
      const handler = vi.fn();
      service.onStatusChange(handler);

      service.connect();

      // Handler called immediately with 'disconnected' on subscribe,
      // then 'connecting' on connect
      expect(handler).toHaveBeenCalledWith('connecting');
    });

    it('should not create a duplicate connection if already OPEN', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const instanceCount = MockWebSocket.instances.length;
      service.connect(); // Should be a no-op

      expect(MockWebSocket.instances.length).toBe(instanceCount);
    });
  });

  describe('disconnect()', () => {
    it('should call ws.close(1000)', () => {
      const service = createService();
      service.connect();
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      service.disconnect();

      expect(ws.closeCode).toBe(1000);
    });

    it('should set status to "disconnected"', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      service.disconnect();

      expect(service.getStatus()).toBe('disconnected');
    });

    it('should disable auto-reconnect', () => {
      vi.useFakeTimers();
      const service = createService();
      service.connect();
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      service.disconnect();
      // Simulate server closing connection after disconnect
      ws.simulateClose(1006, 'abnormal');
      vi.advanceTimersByTime(10000);

      // Should NOT have created a new connection
      expect(MockWebSocket.instances.length).toBe(1);
    });
  });

  describe('isConnected()', () => {
    it('should return true only when status is connected AND readyState is OPEN', () => {
      const service = createService();
      expect(service.isConnected()).toBe(false);

      service.connect();
      expect(service.isConnected()).toBe(false); // connecting, not yet open

      MockWebSocket.latest!.simulateOpen();
      expect(service.isConnected()).toBe(true);
    });

    it('should return false after disconnect', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();
      service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  // ==========================================================================
  // Reconnection
  // ==========================================================================

  describe('reconnection', () => {
    it('should attempt reconnection on close when reconnect is enabled', () => {
      vi.useFakeTimers();
      const service = createService({ maxReconnectAttempts: 3, reconnectInterval: 1000 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      // Simulate unexpected close
      MockWebSocket.latest!.simulateClose(1006, 'abnormal');
      expect(service.getStatus()).toBe('reconnecting');

      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances.length).toBe(2); // New connection attempt
    });

    it('should stop reconnecting after maxReconnectAttempts', () => {
      vi.useFakeTimers();
      const service = createService({ maxReconnectAttempts: 2, reconnectInterval: 100 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      // First close -> reconnect attempt 1
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(100);
      // Second close -> reconnect attempt 2
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(100);
      // Third close -> max reached, no more reconnection
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(100);

      expect(service.getStatus()).toBe('disconnected');
    });

    it('should reset reconnectAttempts on successful connection', () => {
      vi.useFakeTimers();
      const service = createService({ maxReconnectAttempts: 3, reconnectInterval: 100 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      // Close and reconnect
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(100);
      // Successfully reconnect
      MockWebSocket.latest!.simulateOpen();

      // Close again - should have full 3 attempts available
      MockWebSocket.latest!.simulateClose(1006);
      expect(service.getStatus()).toBe('reconnecting');
    });
  });

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  describe('subscribe()', () => {
    it('should send subscribe message when connected', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      service.subscribe('bill:hr-1-119', vi.fn());

      const sent = MockWebSocket.latest!.sentMessages;
      expect(sent.length).toBe(1);
      expect(JSON.parse(sent[0]!)).toEqual({ type: 'subscribe', topic: 'bill:hr-1-119' });
    });

    it('should queue subscribe message when not connected', () => {
      const service = createService();
      service.connect();
      // Not calling simulateOpen - still connecting

      service.subscribe('bill:hr-1-119', vi.fn());

      // No messages sent yet
      expect(MockWebSocket.latest!.sentMessages.length).toBe(0);
    });

    it('should flush queued messages on connection open', () => {
      const service = createService();
      service.connect();
      service.subscribe('bill:hr-1-119', vi.fn());

      // Now open the connection
      MockWebSocket.latest!.simulateOpen();

      const sent = MockWebSocket.latest!.sentMessages;
      expect(sent.some(m => JSON.parse(m).type === 'subscribe')).toBe(true);
    });

    it('should return unsubscribe function', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      const unsubscribe = service.subscribe('bill:hr-1-119', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should send unsubscribe when last handler is removed', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const unsubscribe = service.subscribe('bill:hr-1-119', vi.fn());
      MockWebSocket.latest!.sentMessages.length = 0; // Clear subscribe message

      unsubscribe();

      const sent = MockWebSocket.latest!.sentMessages;
      expect(sent.length).toBe(1);
      expect(JSON.parse(sent[0]!)).toEqual({ type: 'unsubscribe', topic: 'bill:hr-1-119' });
    });

    it('should NOT send unsubscribe when other handlers remain', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const unsub1 = service.subscribe('bill:hr-1-119', vi.fn());
      service.subscribe('bill:hr-1-119', vi.fn());
      MockWebSocket.latest!.sentMessages.length = 0;

      unsub1();

      // No unsubscribe sent because handler2 still exists
      expect(MockWebSocket.latest!.sentMessages.length).toBe(0);
    });
  });

  describe('onStatusChange()', () => {
    it('should immediately call handler with current status', () => {
      const service = createService();
      const handler = vi.fn();

      service.onStatusChange(handler);

      expect(handler).toHaveBeenCalledWith('disconnected');
    });

    it('should call handler on status transitions', () => {
      const service = createService();
      const statuses: ConnectionStatus[] = [];
      service.onStatusChange((s) => statuses.push(s));

      service.connect();
      MockWebSocket.latest!.simulateOpen();

      expect(statuses).toContain('connecting');
      expect(statuses).toContain('connected');
    });

    it('should return unsubscribe function for status handler', () => {
      const service = createService();
      const handler = vi.fn();
      const unsub = service.onStatusChange(handler);

      handler.mockClear();
      unsub();

      service.connect();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  describe('heartbeat', () => {
    it('should start sending ping messages on connection open', () => {
      vi.useFakeTimers();
      const service = createService({ heartbeatInterval: 5000 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.sentMessages.length = 0; // Clear queued messages

      vi.advanceTimersByTime(5000);

      const sent = MockWebSocket.latest!.sentMessages;
      expect(sent.length).toBe(1);
      expect(JSON.parse(sent[0]!)).toEqual({ type: 'ping' });
    });

    it('should send multiple pings at configured interval', () => {
      vi.useFakeTimers();
      const service = createService({ heartbeatInterval: 1000 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();
      MockWebSocket.latest!.sentMessages.length = 0;

      vi.advanceTimersByTime(3500);

      const pings = MockWebSocket.latest!.sentMessages.filter(
        m => JSON.parse(m).type === 'ping'
      );
      expect(pings.length).toBe(3);
    });

    it('should stop heartbeat on disconnect', () => {
      vi.useFakeTimers();
      const service = createService({ heartbeatInterval: 1000 });
      service.connect();
      MockWebSocket.latest!.simulateOpen();
      const ws = MockWebSocket.latest!;
      ws.sentMessages.length = 0;

      service.disconnect();
      vi.advanceTimersByTime(5000);

      // No pings should have been sent (ws is closed, readyState != OPEN)
      expect(ws.sentMessages.length).toBe(0);
    });
  });

  // ==========================================================================
  // Message Dispatch
  // ==========================================================================

  describe('message dispatch', () => {
    it('should dispatch application events to matching topic handlers', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('bill:hr-1-119', handler);

      MockWebSocket.latest!.simulateMessage({
        type: 'bill:updated',
        data: { billId: 'hr-1-119', title: 'Updated Bill' },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bill:updated',
          data: expect.objectContaining({ billId: 'hr-1-119' }),
        })
      );
    });

    it('should NOT dispatch pong messages to handlers', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('pong', handler);

      MockWebSocket.latest!.simulateMessage({ type: 'pong' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should NOT dispatch connection:established to handlers', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('connection:established', handler);

      MockWebSocket.latest!.simulateMessage({ type: 'connection:established' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should NOT dispatch subscribed/unsubscribed confirmations', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('subscribed', handler);

      MockWebSocket.latest!.simulateMessage({ type: 'subscribed' });
      MockWebSocket.latest!.simulateMessage({ type: 'unsubscribed' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle error messages by calling handleError', () => {
      const service = createService();
      const statuses: ConnectionStatus[] = [];
      service.onStatusChange((s) => statuses.push(s));

      service.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateMessage({
        type: 'error',
        data: { message: 'Rate limit exceeded' },
      });

      expect(statuses).toContain('error');
    });

    it('should catch and log handler errors without propagation', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const throwingHandler = vi.fn(() => { throw new Error('handler error'); });
      const normalHandler = vi.fn();
      service.subscribe('bill:hr-1-119', throwingHandler);
      service.subscribe('bill:hr-1-119', normalHandler);

      MockWebSocket.latest!.simulateMessage({
        type: 'bill:updated',
        data: { billId: 'hr-1-119' },
      });

      expect(consoleSpy).toHaveBeenCalled();
      // Second handler should still be called despite first handler throwing
      expect(normalHandler).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Topic Extraction
  // ==========================================================================

  describe('topic extraction', () => {
    it('should extract bill topic from bill:updated event', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('bill:abc-123', handler);

      MockWebSocket.latest!.simulateMessage({
        type: 'bill:updated',
        data: { billId: 'abc-123' },
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should extract vote topic from vote:recorded event', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('vote:v-456', handler);

      MockWebSocket.latest!.simulateMessage({
        type: 'vote:update',
        data: { voteId: 'v-456', legislatorId: 'L1', position: 'yea', timestamp: '' },
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should extract legislator topic from legislator:updated event', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('legislator:L-789', handler);

      MockWebSocket.latest!.simulateMessage({
        type: 'legislator:updated',
        data: { legislatorId: 'L-789' },
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should return null topic for unrecognized event types', () => {
      const service = createService();
      service.connect();
      MockWebSocket.latest!.simulateOpen();

      const handler = vi.fn();
      service.subscribe('unknown:topic', handler);

      MockWebSocket.latest!.simulateMessage({
        type: 'unknown:event',
        data: { someField: 'value' },
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Factory Function
  // ==========================================================================

  describe('createWebSocketService()', () => {
    it('should return a WebSocketService instance', () => {
      const service = createWebSocketService(defaultConfig);
      expect(service).toBeInstanceOf(WebSocketService);
    });
  });
});
