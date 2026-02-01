/**
 * Bill Service
 *
 * Business logic layer for bill operations.
 * Coordinates repository calls and applies DTO transformations.
 */

import type { Bill, PaginatedResponse } from '@ltip/shared';
import type { BillType, Chamber } from '@prisma/client';

import {
  mapBillToApi,
  mapBillSummaryToApi,
  apiToBillType,
  apiToBillStatus,
  apiToChamber,
  partyToApi,
  chamberToApi,
} from '../mappers/index.js';
import {
  billRepository,
  type BillFilters,
  type PaginationParams,
} from '../repositories/index.js';

/**
 * Parameters for listing bills
 */
export interface ListBillsParams {
  congressNumber?: number;
  billType?: string;
  status?: string;
  chamber?: string;
  search?: string;
  limit: number;
  offset: number;
}

/**
 * Convert API chamber filter to bill types
 * (Bills are typed by origin chamber, not a separate chamber field)
 */
function chamberToBillTypes(chamber: Chamber): BillType[] {
  if (chamber === 'HOUSE') {
    return ['HR', 'HRES', 'HJRES', 'HCONRES'];
  }
  if (chamber === 'SENATE') {
    return ['S', 'SRES', 'SJRES', 'SCONRES'];
  }
  // JOINT - return all joint resolution types
  return ['HJRES', 'SJRES', 'HCONRES', 'SCONRES'];
}

/**
 * Build pagination params from offset/limit
 */
function toPaginationParams(limit: number, offset: number): PaginationParams {
  const page = Math.floor(offset / limit) + 1;
  return { page, limit };
}

/**
 * Bill Service singleton
 */
export const billService = {
  /**
   * List bills with optional filtering and search
   */
  async list(params: ListBillsParams): Promise<PaginatedResponse<Partial<Bill>>> {
    const { search, limit, offset, ...filterParams } = params;
    const paginationParams = toPaginationParams(limit, offset);

    // Use full-text search if search query provided
    if (search) {
      const result = await billRepository.search(search, paginationParams);

      return {
        data: result.data.map(mapBillSummaryToApi),
        pagination: {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
      };
    }

    // Build filters from parameters
    const filters: BillFilters = {};

    if (filterParams.congressNumber) {
      filters.congressNumber = filterParams.congressNumber;
    }

    if (filterParams.billType) {
      filters.billType = apiToBillType(filterParams.billType as Parameters<typeof apiToBillType>[0]);
    }

    if (filterParams.status) {
      filters.status = apiToBillStatus(filterParams.status as Parameters<typeof apiToBillStatus>[0]);
    }

    if (filterParams.chamber) {
      // Chamber maps to bill types
      const chamber = apiToChamber(filterParams.chamber as Parameters<typeof apiToChamber>[0]);
      if (chamber) {
        filters.billType = chamberToBillTypes(chamber);
      }
    }

    const result = await billRepository.findMany(filters, paginationParams);

    return {
      data: result.data.map(mapBillSummaryToApi),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  /**
   * Get a single bill by ID with full relations
   */
  async getById(id: string): Promise<Bill | null> {
    const bill = await billRepository.findById(id);
    if (!bill) return null;
    return mapBillToApi(bill);
  },

  /**
   * Get bill actions/history
   */
  async getActions(billId: string) {
    return billRepository.getActions(billId);
  },

  /**
   * Get bill text versions
   */
  async getTextVersions(billId: string) {
    return billRepository.getTextVersions(billId);
  },

  /**
   * Safely convert Date or ISO string to ISO string
   * (Handles cache deserialization where Dates become strings)
   */
  toISODate(value: Date | string): string {
    if (typeof value === 'string') {
      return value;
    }
    return value.toISOString();
  },

  /**
   * Get all bill sponsors (primary + cosponsors)
   */
  async getSponsors(billId: string) {
    const bill = await billRepository.findById(billId);
    if (!bill) return [];

    return bill.sponsors.map((s) => ({
      id: s.legislator.id,
      fullName: s.legislator.fullName,
      party: partyToApi(s.legislator.party),
      state: s.legislator.state,
      chamber: chamberToApi(s.legislator.chamber),
      isPrimary: s.isPrimary,
      ...(s.cosponsorDate != null && { cosponsorDate: this.toISODate(s.cosponsorDate) }),
    }));
  },

  /**
   * Get bill cosponsors
   */
  async getCosponsors(billId: string) {
    const bill = await billRepository.findById(billId);
    if (!bill) return [];

    return bill.sponsors
      .filter((s) => !s.isPrimary)
      .map((s) => ({
        id: s.legislator.id,
        fullName: s.legislator.fullName,
        party: partyToApi(s.legislator.party),
        state: s.legislator.state,
        chamber: chamberToApi(s.legislator.chamber),
        ...(s.cosponsorDate != null && { cosponsorDate: this.toISODate(s.cosponsorDate) }),
      }));
  },

  /**
   * Get related bills (same subject/policy area)
   */
  async getRelatedBills(billId: string, limit = 10) {
    const bill = await billRepository.findById(billId);
    if (!bill) return [];

    // Find bills in same policy area
    if (bill.policyArea) {
      const result = await billRepository.findMany(
        { policyAreaId: bill.policyArea.id },
        { page: 1, limit: limit + 1 }
      );

      // Filter out the current bill
      const related = result.data
        .filter((b) => b.id !== billId)
        .slice(0, limit);

      return related.map(mapBillSummaryToApi);
    }

    return [];
  },
};

export type BillService = typeof billService;
