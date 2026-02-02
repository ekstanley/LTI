/**
 * Committee Service
 *
 * Business logic layer for congressional committee operations.
 * Coordinates repository calls and applies DTO transformations.
 *
 * Note: Committee types are not yet defined in @ltip/shared.
 * This service defines response shapes inline until shared types are added.
 */

import type { PaginatedResponse } from '@ltip/shared';
import type { Chamber, CommitteeType } from '@prisma/client';

import { chamberToApi, apiToChamber, partyToApi, billTypeToApi, billStatusToApi } from '../mappers/index.js';
import {
  committeeRepository,
  type CommitteeFilters,
  type PaginationParams,
} from '../repositories/index.js';

/**
 * Parameters for listing committees
 */
export interface ListCommitteesParams {
  chamber?: string;
  type?: string;
  parentId?: string | null;
  limit: number;
  offset: number;
}

/**
 * Committee summary for list views
 */
export interface CommitteeSummaryDto {
  id: string;
  name: string;
  chamber: string;
  type: string;
  parentId: string | null;
  jurisdiction: string | null;
}

/**
 * Committee member DTO
 */
export interface CommitteeMemberDto {
  id: string;
  fullName: string;
  party: string;
  state: string;
  role: string | null;
}

/**
 * Build pagination params from offset/limit
 */
function toPaginationParams(limit: number, offset: number): PaginationParams {
  const page = Math.floor(offset / limit) + 1;
  return { page, limit };
}

/**
 * Map committee type to lowercase API format
 */
function committeeTypeToApi(type: CommitteeType): string {
  return type.toLowerCase();
}

/**
 * Map API committee type to Prisma enum
 */
function apiToCommitteeType(type: string): CommitteeType {
  return type.toUpperCase() as CommitteeType;
}

/**
 * Committee Service singleton
 */
export const committeeService = {
  /**
   * List committees with optional filtering
   */
  async list(params: ListCommitteesParams): Promise<PaginatedResponse<CommitteeSummaryDto>> {
    const { limit, offset, ...filterParams } = params;
    const paginationParams = toPaginationParams(limit, offset);

    // Build filters from parameters
    const filters: CommitteeFilters = {};

    if (filterParams.chamber) {
      const chamber = apiToChamber(filterParams.chamber as Parameters<typeof apiToChamber>[0]);
      if (chamber) {
        filters.chamber = chamber;
      }
    }

    if (filterParams.type) {
      filters.type = apiToCommitteeType(filterParams.type);
    }

    if (filterParams.parentId !== undefined) {
      filters.parentId = filterParams.parentId;
    }

    const result = await committeeRepository.findMany(filters, paginationParams);

    return {
      data: result.data.map((c) => ({
        id: c.id,
        name: c.name,
        chamber: chamberToApi(c.chamber),
        type: committeeTypeToApi(c.type),
        parentId: c.parentId,
        jurisdiction: c.jurisdiction,
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
   * Get a single committee by ID with full details
   */
  async getById(id: string) {
    const committee = await committeeRepository.findById(id);
    if (!committee) return null;

    return {
      id: committee.id,
      name: committee.name,
      chamber: chamberToApi(committee.chamber),
      type: committeeTypeToApi(committee.type),
      jurisdiction: committee.jurisdiction,
      ...(committee.parent && {
        parent: {
          id: committee.parent.id,
          name: committee.parent.name,
        },
      }),
      subcommittees: committee.subcommittees.map((s) => ({
        id: s.id,
        name: s.name,
      })),
      members: committee.members.map((m) => ({
        id: m.legislator.id,
        fullName: m.legislator.fullName,
        party: partyToApi(m.legislator.party),
        state: m.legislator.state,
        role: m.role,
      })),
    };
  },

  /**
   * Get standing committees by chamber
   */
  async getStandingCommittees(chamber?: string) {
    let prismaChamber: Chamber | undefined;
    if (chamber) {
      const mapped = apiToChamber(chamber as Parameters<typeof apiToChamber>[0]);
      if (mapped) {
        prismaChamber = mapped;
      }
    }

    const committees = await committeeRepository.findStandingCommittees(prismaChamber);

    return committees.map((c) => ({
      id: c.id,
      name: c.name,
      chamber: chamberToApi(c.chamber),
      type: committeeTypeToApi(c.type),
      parentId: c.parentId,
      jurisdiction: c.jurisdiction,
    }));
  },

  /**
   * Get subcommittees of a committee
   */
  async getSubcommittees(parentId: string) {
    const subcommittees = await committeeRepository.findSubcommittees(parentId);

    return subcommittees.map((c) => ({
      id: c.id,
      name: c.name,
      chamber: chamberToApi(c.chamber),
      type: committeeTypeToApi(c.type),
      parentId: c.parentId,
      jurisdiction: c.jurisdiction,
    }));
  },

  /**
   * Get committee members
   */
  async getMembers(committeeId: string, includeHistorical = false): Promise<CommitteeMemberDto[]> {
    const members = await committeeRepository.getMembers(committeeId, includeHistorical);

    return members.map((m) => ({
      id: m.legislator.id,
      fullName: m.legislator.fullName,
      party: partyToApi(m.legislator.party),
      state: m.legislator.state,
      role: m.role,
    }));
  },

  /**
   * Get bills referred to committee
   */
  async getReferredBills(committeeId: string, limit = 20, offset = 0) {
    const paginationParams = toPaginationParams(limit, offset);
    const result = await committeeRepository.getReferredBills(committeeId, paginationParams);

    return {
      data: result.data.map((b) => ({
        id: b.id,
        title: b.title,
        ...(b.shortTitle != null && { shortTitle: b.shortTitle }),
        type: billTypeToApi(b.billType),
        number: b.billNumber,
        status: billStatusToApi(b.status),
        introducedDate: b.introducedDate.toISOString(),
        referralDate: b.referralDate.toISOString(),
        isPrimary: b.isPrimary,
      })),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },
};

export type CommitteeService = typeof committeeService;
