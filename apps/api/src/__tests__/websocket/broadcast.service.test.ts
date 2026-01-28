/**
 * Broadcast Service Tests
 *
 * Tests for WebSocket event broadcasting for vote, tally, and bill status updates.
 * Verifies correct event structure and room targeting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocketEvent } from '@ltip/shared';

// Mock logger first (before any imports that use it)
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the WebSocket index module
vi.mock('../../websocket/index.js', () => ({
  broadcastToRoom: vi.fn(),
}));

// Import after mocks are set up
import {
  emitVoteUpdate,
  emitTallyUpdate,
  emitBillStatusChange,
  emitVoteWithTally,
} from '../../websocket/broadcast.service.js';
import { broadcastToRoom } from '../../websocket/index.js';

// Get the mocked function for assertions
const mockBroadcastToRoom = vi.mocked(broadcastToRoom);

describe('Broadcast Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date to have consistent timestamps in tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  describe('emitVoteUpdate', () => {
    it('broadcasts vote update to vote room', () => {
      emitVoteUpdate({
        voteId: 'vote-123',
        legislatorId: 'leg-456',
        position: 'yea',
      });

      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', {
        type: 'vote:update',
        data: {
          voteId: 'vote-123',
          legislatorId: 'leg-456',
          position: 'yea',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      });
    });

    it('broadcasts to both vote and bill rooms when billId provided', () => {
      emitVoteUpdate({
        voteId: 'vote-123',
        billId: 'bill-789',
        legislatorId: 'leg-456',
        position: 'nay',
      });

      expect(mockBroadcastToRoom).toHaveBeenCalledTimes(2);

      // Check vote room broadcast
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', {
        type: 'vote:update',
        data: {
          voteId: 'vote-123',
          billId: 'bill-789',
          legislatorId: 'leg-456',
          position: 'nay',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      });

      // Check bill room broadcast
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('bill:bill-789', {
        type: 'vote:update',
        data: {
          voteId: 'vote-123',
          billId: 'bill-789',
          legislatorId: 'leg-456',
          position: 'nay',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      });
    });

    it('handles all vote positions', () => {
      const positions = ['yea', 'nay', 'present', 'not_voting'] as const;

      for (const position of positions) {
        vi.clearAllMocks();
        emitVoteUpdate({
          voteId: 'vote-123',
          legislatorId: 'leg-456',
          position,
        });

        expect(mockBroadcastToRoom).toHaveBeenCalledWith(
          'vote:vote-123',
          expect.objectContaining({
            data: expect.objectContaining({ position }),
          })
        );
      }
    });
  });

  describe('emitTallyUpdate', () => {
    it('broadcasts tally update to vote room', () => {
      emitTallyUpdate({
        voteId: 'vote-123',
        yeas: 250,
        nays: 180,
        present: 5,
        notVoting: 0,
      });

      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', {
        type: 'tally:update',
        data: {
          voteId: 'vote-123',
          yeas: 250,
          nays: 180,
          present: 5,
          notVoting: 0,
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      });
    });

    it('broadcasts to both vote and bill rooms when billId provided', () => {
      emitTallyUpdate({
        voteId: 'vote-123',
        billId: 'bill-789',
        yeas: 218,
        nays: 217,
        present: 0,
        notVoting: 0,
      });

      expect(mockBroadcastToRoom).toHaveBeenCalledTimes(2);
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', expect.anything());
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('bill:bill-789', expect.anything());
    });

    it('includes correct tally counts in event', () => {
      emitTallyUpdate({
        voteId: 'vote-123',
        yeas: 100,
        nays: 200,
        present: 10,
        notVoting: 25,
      });

      const event = mockBroadcastToRoom.mock.calls[0]?.[1] as WebSocketEvent;
      expect(event.data).toMatchObject({
        yeas: 100,
        nays: 200,
        present: 10,
        notVoting: 25,
      });
    });
  });

  describe('emitBillStatusChange', () => {
    it('broadcasts status change to bill room', () => {
      emitBillStatusChange({
        billId: 'bill-123',
        previousStatus: 'introduced',
        newStatus: 'in_committee',
        action: 'referred_to_committee',
      });

      expect(mockBroadcastToRoom).toHaveBeenCalledWith('bill:bill-123', {
        type: 'bill:status_change',
        data: {
          billId: 'bill-123',
          previousStatus: 'introduced',
          newStatus: 'in_committee',
          action: 'referred_to_committee',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      });
    });

    it('handles all bill status transitions', () => {
      const transitions = [
        { from: 'introduced', to: 'in_committee', action: 'referred_to_committee' },
        { from: 'in_committee', to: 'passed_house', action: 'passed_house' },
        { from: 'passed_house', to: 'passed_senate', action: 'passed_senate' },
        { from: 'passed_senate', to: 'became_law', action: 'signed_by_president' },
      ] as const;

      for (const { from, to, action } of transitions) {
        vi.clearAllMocks();
        emitBillStatusChange({
          billId: 'bill-123',
          previousStatus: from,
          newStatus: to,
          action,
        });

        expect(mockBroadcastToRoom).toHaveBeenCalledWith(
          'bill:bill-123',
          expect.objectContaining({
            type: 'bill:status_change',
            data: expect.objectContaining({
              previousStatus: from,
              newStatus: to,
              action,
            }),
          })
        );
      }
    });
  });

  describe('emitVoteWithTally', () => {
    it('emits both vote update and tally update', () => {
      emitVoteWithTally(
        {
          voteId: 'vote-123',
          legislatorId: 'leg-456',
          position: 'yea',
        },
        {
          yeas: 251,
          nays: 180,
          present: 4,
          notVoting: 0,
        }
      );

      // Should have 2 calls: vote update + tally update
      expect(mockBroadcastToRoom).toHaveBeenCalledTimes(2);

      // Check vote update
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', {
        type: 'vote:update',
        data: expect.objectContaining({
          voteId: 'vote-123',
          legislatorId: 'leg-456',
          position: 'yea',
        }),
      });

      // Check tally update
      expect(mockBroadcastToRoom).toHaveBeenCalledWith('vote:vote-123', {
        type: 'tally:update',
        data: expect.objectContaining({
          voteId: 'vote-123',
          yeas: 251,
          nays: 180,
          present: 4,
          notVoting: 0,
        }),
      });
    });

    it('propagates billId to both events', () => {
      emitVoteWithTally(
        {
          voteId: 'vote-123',
          billId: 'bill-789',
          legislatorId: 'leg-456',
          position: 'nay',
        },
        {
          yeas: 200,
          nays: 235,
          present: 0,
          notVoting: 0,
        }
      );

      // Should broadcast to both vote and bill rooms for each event
      // 2 events x 2 rooms = 4 broadcasts
      expect(mockBroadcastToRoom).toHaveBeenCalledTimes(4);

      // Verify bill room received both events
      const billRoomCalls = mockBroadcastToRoom.mock.calls.filter(
        (call) => call[0] === 'bill:bill-789'
      );
      expect(billRoomCalls).toHaveLength(2);

      const billRoomEventTypes = billRoomCalls.map((call) => (call[1] as WebSocketEvent).type);
      expect(billRoomEventTypes).toContain('vote:update');
      expect(billRoomEventTypes).toContain('tally:update');
    });
  });
});
