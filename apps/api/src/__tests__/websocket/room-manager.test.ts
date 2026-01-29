/**
 * Room Manager Tests
 *
 * Tests for WebSocket room-based pub/sub subscription management.
 * Verifies bidirectional client↔room tracking and cleanup on disconnect.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { RoomManager } from '../../websocket/room-manager.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock WebSocket client for testing
function createMockClient(): WebSocket {
  return {} as WebSocket;
}

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('subscribe', () => {
    it('subscribes client to valid bill room', () => {
      const client = createMockClient();
      const result = roomManager.subscribe(client, 'bill:hr-1234');

      expect(result).toBe(true);
      expect(roomManager.getClients('bill:hr-1234').has(client)).toBe(true);
      expect(roomManager.getClientRooms(client).has('bill:hr-1234')).toBe(true);
    });

    it('subscribes client to valid vote room', () => {
      const client = createMockClient();
      const result = roomManager.subscribe(client, 'vote:abc123');

      expect(result).toBe(true);
      expect(roomManager.getClients('vote:abc123').has(client)).toBe(true);
    });

    it('returns false when already subscribed', () => {
      const client = createMockClient();
      roomManager.subscribe(client, 'bill:hr-1234');
      const result = roomManager.subscribe(client, 'bill:hr-1234');

      expect(result).toBe(false);
    });

    it('rejects invalid room format', () => {
      const client = createMockClient();

      expect(roomManager.subscribe(client, 'invalid')).toBe(false);
      expect(roomManager.subscribe(client, '')).toBe(false);
      expect(roomManager.subscribe(client, 'bill:')).toBe(false);
      expect(roomManager.subscribe(client, ':id')).toBe(false);
      expect(roomManager.subscribe(client, 'committee:123')).toBe(false);
    });

    it('allows multiple clients in same room', () => {
      const client1 = createMockClient();
      const client2 = createMockClient();

      roomManager.subscribe(client1, 'bill:hr-1234');
      roomManager.subscribe(client2, 'bill:hr-1234');

      const clients = roomManager.getClients('bill:hr-1234');
      expect(clients.size).toBe(2);
      expect(clients.has(client1)).toBe(true);
      expect(clients.has(client2)).toBe(true);
    });

    it('allows client in multiple rooms', () => {
      const client = createMockClient();

      roomManager.subscribe(client, 'bill:hr-1234');
      roomManager.subscribe(client, 'vote:abc123');

      const rooms = roomManager.getClientRooms(client);
      expect(rooms.size).toBe(2);
      expect(rooms.has('bill:hr-1234')).toBe(true);
      expect(rooms.has('vote:abc123')).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('removes client from room', () => {
      const client = createMockClient();
      roomManager.subscribe(client, 'bill:hr-1234');

      const result = roomManager.unsubscribe(client, 'bill:hr-1234');

      expect(result).toBe(true);
      expect(roomManager.getClients('bill:hr-1234').has(client)).toBe(false);
      expect(roomManager.getClientRooms(client).has('bill:hr-1234')).toBe(false);
    });

    it('returns false when client not in room', () => {
      const client = createMockClient();

      const result = roomManager.unsubscribe(client, 'bill:hr-1234');

      expect(result).toBe(false);
    });

    it('cleans up empty room', () => {
      const client = createMockClient();
      roomManager.subscribe(client, 'bill:hr-1234');
      roomManager.unsubscribe(client, 'bill:hr-1234');

      expect(roomManager.getStats().roomCount).toBe(0);
    });

    it('does not affect other clients in room', () => {
      const client1 = createMockClient();
      const client2 = createMockClient();
      roomManager.subscribe(client1, 'bill:hr-1234');
      roomManager.subscribe(client2, 'bill:hr-1234');

      roomManager.unsubscribe(client1, 'bill:hr-1234');

      expect(roomManager.getClients('bill:hr-1234').has(client2)).toBe(true);
      expect(roomManager.getStats().rooms['bill:hr-1234']).toBe(1);
    });
  });

  describe('removeClient', () => {
    it('removes client from all rooms on disconnect', () => {
      const client = createMockClient();
      roomManager.subscribe(client, 'bill:hr-1234');
      roomManager.subscribe(client, 'vote:abc123');

      const removedRooms = roomManager.removeClient(client);

      expect(removedRooms).toHaveLength(2);
      expect(removedRooms).toContain('bill:hr-1234');
      expect(removedRooms).toContain('vote:abc123');
      expect(roomManager.getClientRooms(client).size).toBe(0);
    });

    it('returns empty array for client not in any room', () => {
      const client = createMockClient();

      const removedRooms = roomManager.removeClient(client);

      expect(removedRooms).toHaveLength(0);
    });

    it('cleans up empty rooms', () => {
      const client = createMockClient();
      roomManager.subscribe(client, 'bill:hr-1234');

      roomManager.removeClient(client);

      expect(roomManager.getStats().roomCount).toBe(0);
    });

    it('does not affect other clients in shared rooms', () => {
      const client1 = createMockClient();
      const client2 = createMockClient();
      roomManager.subscribe(client1, 'bill:hr-1234');
      roomManager.subscribe(client2, 'bill:hr-1234');

      roomManager.removeClient(client1);

      expect(roomManager.getClients('bill:hr-1234').has(client2)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const client1 = createMockClient();
      const client2 = createMockClient();

      roomManager.subscribe(client1, 'bill:hr-1234');
      roomManager.subscribe(client1, 'vote:abc123');
      roomManager.subscribe(client2, 'bill:hr-1234');

      const stats = roomManager.getStats();

      expect(stats.roomCount).toBe(2);
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.rooms['bill:hr-1234']).toBe(2);
      expect(stats.rooms['vote:abc123']).toBe(1);
    });

    it('returns empty stats for new manager', () => {
      const stats = roomManager.getStats();

      expect(stats.roomCount).toBe(0);
      expect(stats.totalSubscriptions).toBe(0);
      expect(Object.keys(stats.rooms)).toHaveLength(0);
    });
  });

  describe('room name validation', () => {
    it('accepts lowercase bill IDs', () => {
      const client = createMockClient();
      expect(roomManager.subscribe(client, 'bill:abc123')).toBe(true);
    });

    it('accepts uppercase bill IDs', () => {
      const client = createMockClient();
      expect(roomManager.subscribe(client, 'bill:ABC123')).toBe(true);
    });

    it('accepts IDs with hyphens', () => {
      const client = createMockClient();
      expect(roomManager.subscribe(client, 'bill:hr-1234-5678')).toBe(true);
    });

    it('accepts IDs with numbers only', () => {
      const client = createMockClient();
      expect(roomManager.subscribe(client, 'vote:123456')).toBe(true);
    });

    it('rejects IDs with special characters', () => {
      const client = createMockClient();
      expect(roomManager.subscribe(client, 'bill:abc_123')).toBe(false);
      expect(roomManager.subscribe(client, 'bill:abc.123')).toBe(false);
      expect(roomManager.subscribe(client, 'bill:abc/123')).toBe(false);
    });
  });
});
