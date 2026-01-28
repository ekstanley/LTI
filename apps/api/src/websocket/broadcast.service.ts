/**
 * Vote Broadcast Service
 *
 * Emits real-time WebSocket events when vote data changes.
 * Called by API routes after mutations to notify subscribed clients.
 */

import type {
  VoteUpdateEvent,
  TallyUpdateEvent,
  BillStatusChangeEvent,
  VotePosition,
  BillStatus,
  BillAction,
} from '@ltip/shared';
import { broadcastToRoom } from './index.js';
import { logger } from '../lib/logger.js';

// ============================================================================
// Vote Events
// ============================================================================

export interface VoteUpdateParams {
  voteId: string;
  billId?: string;
  legislatorId: string;
  position: VotePosition;
}

/**
 * Broadcast when an individual legislator casts a vote
 */
export function emitVoteUpdate(params: VoteUpdateParams): void {
  const event: VoteUpdateEvent = {
    type: 'vote:update',
    data: {
      voteId: params.voteId,
      legislatorId: params.legislatorId,
      position: params.position,
      timestamp: new Date().toISOString(),
      ...(params.billId !== undefined && { billId: params.billId }),
    },
  };

  // Broadcast to vote room
  broadcastToRoom(`vote:${params.voteId}`, event);

  // Also broadcast to bill room if associated
  if (params.billId) {
    broadcastToRoom(`bill:${params.billId}`, event);
  }

  logger.info({ voteId: params.voteId, legislatorId: params.legislatorId }, 'Vote update emitted');
}

// ============================================================================
// Tally Events
// ============================================================================

export interface TallyUpdateParams {
  voteId: string;
  billId?: string;
  yeas: number;
  nays: number;
  present: number;
  notVoting: number;
}

/**
 * Broadcast when vote tallies are updated
 */
export function emitTallyUpdate(params: TallyUpdateParams): void {
  const event: TallyUpdateEvent = {
    type: 'tally:update',
    data: {
      voteId: params.voteId,
      yeas: params.yeas,
      nays: params.nays,
      present: params.present,
      notVoting: params.notVoting,
      timestamp: new Date().toISOString(),
      ...(params.billId !== undefined && { billId: params.billId }),
    },
  };

  // Broadcast to vote room
  broadcastToRoom(`vote:${params.voteId}`, event);

  // Also broadcast to bill room if associated
  if (params.billId) {
    broadcastToRoom(`bill:${params.billId}`, event);
  }

  logger.info(
    { voteId: params.voteId, yeas: params.yeas, nays: params.nays },
    'Tally update emitted'
  );
}

// ============================================================================
// Bill Status Events
// ============================================================================

export interface BillStatusChangeParams {
  billId: string;
  previousStatus: BillStatus;
  newStatus: BillStatus;
  action: BillAction;
}

/**
 * Broadcast when a bill's status changes
 */
export function emitBillStatusChange(params: BillStatusChangeParams): void {
  const event: BillStatusChangeEvent = {
    type: 'bill:status_change',
    data: {
      billId: params.billId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      action: params.action,
      timestamp: new Date().toISOString(),
    },
  };

  // Broadcast to bill room
  broadcastToRoom(`bill:${params.billId}`, event);

  logger.info(
    { billId: params.billId, from: params.previousStatus, to: params.newStatus },
    'Bill status change emitted'
  );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Emit vote update and recalculated tally in a single batch
 * This is the typical pattern when a legislator casts a vote
 */
export function emitVoteWithTally(
  voteParams: VoteUpdateParams,
  tallyParams: Omit<TallyUpdateParams, 'voteId' | 'billId'>
): void {
  emitVoteUpdate(voteParams);
  emitTallyUpdate({
    voteId: voteParams.voteId,
    ...(voteParams.billId !== undefined && { billId: voteParams.billId }),
    ...tallyParams,
  });
}

// ============================================================================
// Export as service object for consistency
// ============================================================================

export const broadcastService = {
  emitVoteUpdate,
  emitTallyUpdate,
  emitBillStatusChange,
  emitVoteWithTally,
};
