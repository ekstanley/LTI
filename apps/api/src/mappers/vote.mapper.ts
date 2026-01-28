/**
 * Vote Mapper
 *
 * Transforms Prisma RollCallVote and Vote entities to API DTOs.
 * Handles field name differences and enum conversion.
 *
 * Key mappings:
 * - Prisma `rollNumber` → API `rollCallNumber`
 * - Prisma `voteDate` → API `date`
 * - Prisma enums (UPPERCASE) → API enums (lowercase)
 *
 * Note: Uses conditional spreads for optional properties to satisfy
 * exactOptionalPropertyTypes - properties are omitted rather than set to undefined.
 */

import type { Vote, VotePosition as ApiVotePosition, LegislatorVote } from '@ltip/shared';
import type {
  RollCallVoteSummary,
  RollCallVoteWithRelations,
  VoteWithLegislator,
} from '../repositories/vote.repository.js';
import { chamberToApi, voteResultToApi, votePositionToApi, billTypeToApi } from './enums.js';

/**
 * Map Prisma RollCallVoteSummary to API Vote
 */
export function mapRollCallVoteSummaryToApi(vote: RollCallVoteSummary): Vote {
  return {
    id: vote.id,
    chamber: chamberToApi(vote.chamber),
    session: vote.session,
    rollCallNumber: vote.rollNumber,
    date: vote.voteDate.toISOString(),
    question: vote.question,
    result: voteResultToApi(vote.result),
    yeas: vote.yeas,
    nays: vote.nays,
    present: vote.present,
    notVoting: vote.notVoting,
  };
}

/**
 * Map bill info if present
 */
function mapBillInfo(bill: NonNullable<RollCallVoteWithRelations['bill']>) {
  return {
    id: bill.id,
    title: bill.title,
    ...(bill.shortTitle != null && { shortTitle: bill.shortTitle }),
    type: billTypeToApi(bill.billType),
    number: bill.billNumber,
  };
}

/**
 * Map Prisma RollCallVoteWithRelations to API Vote with bill info
 */
export function mapRollCallVoteToApi(
  vote: RollCallVoteWithRelations
): Vote & { bill?: { id: string; title: string; shortTitle?: string; type: string; number: number } } {
  return {
    id: vote.id,
    ...(vote.billId != null && { billId: vote.billId }),
    chamber: chamberToApi(vote.chamber),
    session: vote.session,
    rollCallNumber: vote.rollNumber,
    date: vote.voteDate.toISOString(),
    question: vote.question,
    result: voteResultToApi(vote.result),
    yeas: vote.yeas,
    nays: vote.nays,
    present: vote.present,
    notVoting: vote.notVoting,
    ...(vote.bill != null && { bill: mapBillInfo(vote.bill) }),
  };
}

/**
 * Map individual vote record to API LegislatorVote
 */
export function mapLegislatorVoteToApi(vote: VoteWithLegislator): LegislatorVote {
  return {
    legislatorId: vote.legislatorId,
    voteId: vote.rollCallId,
    position: votePositionToApi(vote.position),
  };
}

/**
 * Map vote with legislator details for vote breakdown views
 */
export function mapVoteWithLegislatorToApi(vote: VoteWithLegislator): {
  legislatorId: string;
  fullName: string;
  party: string;
  state: string;
  position: ApiVotePosition;
} {
  return {
    legislatorId: vote.legislator.id,
    fullName: vote.legislator.fullName,
    party: vote.legislator.party, // Party enum is identical between Prisma and API
    state: vote.legislator.state,
    position: votePositionToApi(vote.position),
  };
}

/**
 * Map party breakdown from repository format to API format
 */
export function mapPartyBreakdownToApi(
  breakdown: Record<string, Record<string, number>>
): Record<string, { yea: number; nay: number; present: number; notVoting: number }> {
  const result: Record<string, { yea: number; nay: number; present: number; notVoting: number }> = {};

  for (const [party, positions] of Object.entries(breakdown)) {
    result[party] = {
      yea: positions['YEA'] ?? 0,
      nay: positions['NAY'] ?? 0,
      present: positions['PRESENT'] ?? 0,
      notVoting: positions['NOT_VOTING'] ?? 0,
    };
  }

  return result;
}
