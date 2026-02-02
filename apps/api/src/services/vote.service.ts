/**
 * Vote Service
 *
 * Business logic layer for roll call vote operations.
 * Coordinates repository calls and applies DTO transformations.
 */

import type { Vote, PaginatedResponse } from '@ltip/shared';

import {
  mapRollCallVoteSummaryToApi,
  mapRollCallVoteToApi,
  mapPartyBreakdownToApi,
  apiToChamber,
  apiToVoteResult,
  votePositionToApi,
} from '../mappers/index.js';
import {
  voteRepository,
  type RollCallVoteFilters,
  type PaginationParams,
} from '../repositories/index.js';

/**
 * Parameters for listing votes
 */
export interface ListVotesParams {
  chamber?: string;
  congressNumber?: number;
  session?: number;
  result?: string;
  billId?: string;
  voteDateAfter?: string;
  voteDateBefore?: string;
  limit: number;
  offset: number;
}

/**
 * Build pagination params from offset/limit
 */
function toPaginationParams(limit: number, offset: number): PaginationParams {
  const page = Math.floor(offset / limit) + 1;
  return { page, limit };
}

/**
 * Vote Service singleton
 */
export const voteService = {
  /**
   * List roll call votes with optional filtering
   */
  async list(params: ListVotesParams): Promise<PaginatedResponse<Vote>> {
    const { limit, offset, ...filterParams } = params;
    const paginationParams = toPaginationParams(limit, offset);

    // Build filters from parameters
    const filters: RollCallVoteFilters = {};

    if (filterParams.chamber) {
      const chamber = apiToChamber(filterParams.chamber as Parameters<typeof apiToChamber>[0]);
      if (chamber) {
        filters.chamber = chamber;
      }
    }

    if (filterParams.congressNumber !== undefined) {
      filters.congressNumber = filterParams.congressNumber;
    }

    if (filterParams.session !== undefined) {
      filters.session = filterParams.session;
    }

    if (filterParams.result) {
      filters.result = apiToVoteResult(filterParams.result as Parameters<typeof apiToVoteResult>[0]);
    }

    if (filterParams.billId) {
      filters.billId = filterParams.billId;
    }

    if (filterParams.voteDateAfter) {
      filters.voteDateAfter = new Date(filterParams.voteDateAfter);
    }

    if (filterParams.voteDateBefore) {
      filters.voteDateBefore = new Date(filterParams.voteDateBefore);
    }

    const result = await voteRepository.findMany(filters, paginationParams);

    return {
      data: result.data.map(mapRollCallVoteSummaryToApi),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get a single roll call vote by ID with full details
   */
  async getById(id: string) {
    const vote = await voteRepository.findById(id);
    if (!vote) return null;
    return mapRollCallVoteToApi(vote);
  },

  /**
   * Get votes for a specific bill
   */
  async getByBill(billId: string, limit = 20, offset = 0): Promise<PaginatedResponse<Vote>> {
    const paginationParams = toPaginationParams(limit, offset);
    const result = await voteRepository.findByBill(billId, paginationParams);

    return {
      data: result.data.map(mapRollCallVoteSummaryToApi),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get individual vote breakdown for a roll call
   */
  async getVoteBreakdown(voteId: string) {
    const vote = await voteRepository.findById(voteId);
    if (!vote) return null;

    return {
      vote: mapRollCallVoteToApi(vote),
      // Map individual votes inline since the repository select doesn't include chamber
      votes: vote.individualVotes.map((v) => ({
        legislatorId: v.legislator.id,
        fullName: v.legislator.fullName,
        party: v.legislator.party,
        state: v.legislator.state,
        position: votePositionToApi(v.position),
      })),
    };
  },

  /**
   * Get party breakdown for a roll call vote
   */
  async getPartyBreakdown(voteId: string) {
    const breakdown = await voteRepository.getPartyBreakdown(voteId);
    return mapPartyBreakdownToApi(breakdown);
  },

  /**
   * Compare voting records between two legislators
   */
  async compareVotingRecords(
    legislatorId1: string,
    legislatorId2: string,
    congressNumber?: number
  ) {
    return voteRepository.compareVotingRecords(legislatorId1, legislatorId2, congressNumber);
  },

  /**
   * Get recent votes by chamber
   */
  async getRecent(chamber: string, limit = 10) {
    const prismaChamber = apiToChamber(chamber as Parameters<typeof apiToChamber>[0]);
    if (!prismaChamber) {
      return [];
    }
    const votes = await voteRepository.findRecent(prismaChamber, limit);
    return votes.map(mapRollCallVoteSummaryToApi);
  },
};

export type VoteService = typeof voteService;
