/**
 * Legislator Service
 *
 * Business logic layer for legislator operations.
 * Coordinates repository calls and applies DTO transformations.
 */

import type { Legislator, PaginatedResponse } from '@ltip/shared';
import {
  legislatorRepository,
  billRepository,
  voteRepository,
  type LegislatorFilters,
  type PaginationParams,
} from '../repositories/index.js';
import {
  mapLegislatorToApi,
  mapLegislatorSummaryToApi,
  mapLegislatorWithCommitteesToApi,
  mapBillSummaryToApi,
  apiToParty,
  apiToChamber,
  chamberToApi,
  votePositionToApi,
} from '../mappers/index.js';

/**
 * Parameters for listing legislators
 */
export interface ListLegislatorsParams {
  chamber?: string;
  party?: string;
  state?: string;
  search?: string;
  inOffice?: boolean;
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
 * Legislator Service singleton
 */
export const legislatorService = {
  /**
   * List legislators with optional filtering and search
   */
  async list(params: ListLegislatorsParams): Promise<PaginatedResponse<Partial<Legislator>>> {
    const { search, limit, offset, ...filterParams } = params;
    const paginationParams = toPaginationParams(limit, offset);

    // Use full-text search if search query provided
    if (search) {
      const result = await legislatorRepository.search(search, paginationParams);

      return {
        data: result.data.map(mapLegislatorSummaryToApi),
        pagination: {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
      };
    }

    // Build filters from parameters
    const filters: LegislatorFilters = {
      // Default to current members only
      inOffice: filterParams.inOffice ?? true,
    };

    if (filterParams.party) {
      filters.party = apiToParty(filterParams.party as Parameters<typeof apiToParty>[0]);
    }

    if (filterParams.chamber) {
      const chamber = apiToChamber(filterParams.chamber as Parameters<typeof apiToChamber>[0]);
      if (chamber) {
        filters.chamber = chamber;
      }
    }

    if (filterParams.state) {
      filters.state = filterParams.state.toUpperCase();
    }

    const result = await legislatorRepository.findMany(filters, paginationParams);

    return {
      data: result.data.map(mapLegislatorSummaryToApi),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get a single legislator by ID with full relations
   */
  async getById(id: string): Promise<Legislator | null> {
    const legislator = await legislatorRepository.findById(id);
    if (!legislator) return null;
    return mapLegislatorToApi(legislator);
  },

  /**
   * Get a legislator with committee assignments
   */
  async getWithCommittees(id: string) {
    const legislator = await legislatorRepository.findById(id);
    if (!legislator) return null;
    return mapLegislatorWithCommitteesToApi(legislator);
  },

  /**
   * Get bills sponsored/cosponsored by a legislator
   */
  async getBills(
    legislatorId: string,
    primaryOnly = false,
    limit = 20,
    offset = 0
  ): Promise<PaginatedResponse<Partial<Legislator>>> {
    const paginationParams = toPaginationParams(limit, offset);
    const result = await billRepository.findByLegislator(
      legislatorId,
      primaryOnly,
      paginationParams
    );

    return {
      data: result.data.map(mapBillSummaryToApi) as Partial<Legislator>[],
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get voting record for a legislator
   */
  async getVotes(legislatorId: string, limit = 20, offset = 0) {
    const paginationParams = toPaginationParams(limit, offset);
    const result = await voteRepository.getLegislatorVotes(legislatorId, {}, paginationParams);

    return {
      data: result.data.map((v) => ({
        voteId: v.rollCallId,
        date: v.rollCall.voteDate.toISOString(),
        question: v.rollCall.question,
        position: votePositionToApi(v.position),
        chamber: chamberToApi(v.rollCall.chamber),
        result: v.rollCall.result,
      })),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get voting statistics for a legislator
   */
  async getVotingStats(legislatorId: string) {
    return legislatorRepository.getVotingStats(legislatorId);
  },

  /**
   * Get sponsorship statistics for a legislator
   */
  async getSponsorshipStats(legislatorId: string) {
    return legislatorRepository.getSponsorshipStats(legislatorId);
  },

  /**
   * Get combined stats for a legislator
   */
  async getStats(legislatorId: string) {
    const [votingStats, sponsorshipStats] = await Promise.all([
      legislatorRepository.getVotingStats(legislatorId),
      legislatorRepository.getSponsorshipStats(legislatorId),
    ]);

    return {
      voting: votingStats,
      sponsorship: sponsorshipStats,
    };
  },
};

export type LegislatorService = typeof legislatorService;
