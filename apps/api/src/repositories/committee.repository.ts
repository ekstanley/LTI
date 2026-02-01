/**
 * Committee Repository
 *
 * Data access layer for congressional committees with:
 * - Committee hierarchy (parent/subcommittee)
 * - Membership queries
 * - Bill referral tracking
 */

import { Prisma, Chamber, CommitteeType } from '@prisma/client';

import { prisma } from '../db/client.js';
import { DEFAULT_TTL } from '../db/redis.js';

import {
  BaseRepository,
  PaginationParams,
  PaginatedResponse,
  parsePagination,
  buildPaginatedResponse,
} from './base.js';

/**
 * Committee filter parameters
 */
export interface CommitteeFilters {
  chamber?: Chamber;
  type?: CommitteeType | CommitteeType[];
  parentId?: string | null;
}

/**
 * Committee with relations
 */
export type CommitteeWithRelations = Prisma.CommitteeGetPayload<{
  include: {
    parent: true;
    subcommittees: true;
    members: {
      include: {
        legislator: {
          select: {
            id: true;
            fullName: true;
            party: true;
            state: true;
          };
        };
      };
    };
  };
}>;

/**
 * Committee summary
 */
export type CommitteeSummary = Prisma.CommitteeGetPayload<{
  select: {
    id: true;
    name: true;
    chamber: true;
    type: true;
    parentId: true;
    jurisdiction: true;
  };
}>;

export class CommitteeRepository extends BaseRepository {
  constructor() {
    super('committees', DEFAULT_TTL.CACHE);
  }

  /**
   * Find committee by ID with relations
   */
  async findById(id: string): Promise<CommitteeWithRelations | null> {
    return this.cached(`detail:${id}`, async () => {
      return prisma.committee.findUnique({
        where: { id },
        include: {
          parent: true,
          subcommittees: true,
          members: {
            where: { endDate: null }, // Current members only
            include: {
              legislator: {
                select: {
                  id: true,
                  fullName: true,
                  party: true,
                  state: true,
                },
              },
            },
            orderBy: [{ role: 'asc' }, { legislator: { lastName: 'asc' } }],
          },
        },
      });
    });
  }

  /**
   * Find committees with filtering
   */
  async findMany(
    filters: CommitteeFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<CommitteeSummary>> {
    const { page, limit, skip } = parsePagination(pagination);
    const where = this.buildWhereClause(filters);

    const [total, data] = await Promise.all([
      prisma.committee.count({ where }),
      prisma.committee.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          chamber: true,
          type: true,
          parentId: true,
          jurisdiction: true,
        },
      }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Get standing committees by chamber
   */
  async findStandingCommittees(chamber?: Chamber): Promise<CommitteeSummary[]> {
    const cacheKey = `standing:${chamber ?? 'all'}`;

    return this.cached(cacheKey, async () => {
      return prisma.committee.findMany({
        where: {
          type: 'STANDING',
          parentId: null, // Only top-level committees
          ...(chamber && { chamber }),
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          chamber: true,
          type: true,
          parentId: true,
          jurisdiction: true,
        },
      });
    });
  }

  /**
   * Get subcommittees of a committee
   */
  async findSubcommittees(parentId: string): Promise<CommitteeSummary[]> {
    return this.cached(`subcommittees:${parentId}`, async () => {
      return prisma.committee.findMany({
        where: { parentId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          chamber: true,
          type: true,
          parentId: true,
          jurisdiction: true,
        },
      });
    });
  }

  /**
   * Get committee members
   */
  async getMembers(committeeId: string, includeHistorical: boolean = false) {
    return prisma.committeeMembership.findMany({
      where: {
        committeeId,
        ...(includeHistorical ? {} : { endDate: null }),
      },
      include: {
        legislator: {
          select: {
            id: true,
            fullName: true,
            party: true,
            state: true,
            chamber: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { legislator: { lastName: 'asc' } }],
    });
  }

  /**
   * Get bills referred to committee
   */
  async getReferredBills(
    committeeId: string,
    pagination: PaginationParams = {}
  ) {
    const { page, limit, skip } = parsePagination(pagination);

    const [total, referrals] = await Promise.all([
      prisma.committeeReferral.count({ where: { committeeId } }),
      prisma.committeeReferral.findMany({
        where: { committeeId },
        include: {
          bill: {
            select: {
              id: true,
              title: true,
              shortTitle: true,
              billType: true,
              billNumber: true,
              status: true,
              introducedDate: true,
            },
          },
        },
        orderBy: { referralDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = referrals.map((r) => ({
      ...r.bill,
      referralDate: r.referralDate,
      isPrimary: r.isPrimary,
    }));

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Invalidate committee cache
   */
  async invalidateCommittee(committeeId: string): Promise<void> {
    await this.invalidate(`detail:${committeeId}`);
    await this.invalidate(`subcommittees:${committeeId}`);
    await this.invalidatePattern('standing:*');
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: CommitteeFilters): Prisma.CommitteeWhereInput {
    const where: Prisma.CommitteeWhereInput = {};

    if (filters.chamber) {
      where.chamber = filters.chamber;
    }

    if (filters.type) {
      where.type = Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type;
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    return where;
  }
}

// Singleton instance
export const committeeRepository = new CommitteeRepository();
