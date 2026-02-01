/**
 * Legislator Repository
 *
 * Data access layer for legislators with:
 * - Full-text search support
 * - Filtering by chamber, party, state
 * - Committee membership queries
 * - Voting record access
 */

import { Prisma, Party, Chamber } from '@prisma/client';

import { prisma } from '../db/client.js';
import { DEFAULT_TTL } from '../db/redis.js';

import {
  BaseRepository,
  PaginationParams,
  PaginatedResponse,
  parsePagination,
  buildPaginatedResponse,
  SortParams,
  buildOrderBy,
} from './base.js';

/**
 * Legislator filter parameters
 */
export interface LegislatorFilters {
  party?: Party | Party[];
  chamber?: Chamber;
  state?: string;
  inOffice?: boolean;
  isVotingMember?: boolean;
  search?: string;
}

/**
 * Legislator sort fields
 */
export type LegislatorSortField = 'lastName' | 'firstName' | 'state' | 'party';

/**
 * Legislator with relations type
 */
export type LegislatorWithRelations = Prisma.LegislatorGetPayload<{
  include: {
    committees: {
      include: {
        committee: true;
      };
    };
    partyHistory: true;
  };
}>;

/**
 * Legislator summary type
 */
export type LegislatorSummary = Prisma.LegislatorGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    fullName: true;
    nickName: true;
    party: true;
    chamber: true;
    state: true;
    district: true;
    isVotingMember: true;
    leadershipRole: true;
    inOffice: true;
    website: true;
    twitterHandle: true;
  };
}>;

export class LegislatorRepository extends BaseRepository {
  constructor() {
    super('legislators', DEFAULT_TTL.LEGISLATOR);
  }

  /**
   * Find legislator by ID with relations
   */
  async findById(id: string): Promise<LegislatorWithRelations | null> {
    return this.cached(`detail:${id}`, async () => {
      return prisma.legislator.findUnique({
        where: { id },
        include: {
          committees: {
            where: { endDate: null }, // Current memberships only
            include: {
              committee: true,
            },
            orderBy: { committee: { name: 'asc' } },
          },
          partyHistory: {
            orderBy: { changeDate: 'desc' },
          },
        },
      });
    });
  }

  /**
   * Find legislators with pagination and filtering
   */
  async findMany(
    filters: LegislatorFilters = {},
    pagination: PaginationParams = {},
    sort?: SortParams<LegislatorSortField>
  ): Promise<PaginatedResponse<LegislatorSummary>> {
    const { page, limit, skip } = parsePagination(pagination);
    const where = this.buildWhereClause(filters);
    const orderBy = buildOrderBy(sort, { field: 'lastName', direction: 'asc' });

    const [total, data] = await Promise.all([
      prisma.legislator.count({ where }),
      prisma.legislator.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          nickName: true,
          party: true,
          chamber: true,
          state: true,
          district: true,
          isVotingMember: true,
          leadershipRole: true,
          inOffice: true,
          website: true,
          twitterHandle: true,
        },
      }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Full-text search for legislators
   */
  async search(
    query: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<LegislatorSummary & { rank: number }>> {
    const { page, limit, skip } = parsePagination(pagination);
    const cacheKey = `search:${query}:${page}:${limit}`;

    return this.cached(
      cacheKey,
      async () => {
        const results = await prisma.$queryRaw<
          (LegislatorSummary & { rank: number })[]
        >`
          SELECT
            id, first_name as "firstName", last_name as "lastName",
            full_name as "fullName", nick_name as "nickName",
            party, chamber, state, district,
            is_voting_member as "isVotingMember",
            leadership_role as "leadershipRole", in_office as "inOffice",
            website, twitter_handle as "twitterHandle",
            ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
          FROM legislators
          WHERE search_vector @@ plainto_tsquery('english', ${query})
          ORDER BY rank DESC, in_office DESC, last_name ASC
          LIMIT ${limit} OFFSET ${skip}
        `;

        const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM legislators
          WHERE search_vector @@ plainto_tsquery('english', ${query})
        `;

        const total = Number(countResult[0].count);
        return buildPaginatedResponse(results, total, page, limit);
      },
      DEFAULT_TTL.SEARCH
    );
  }

  /**
   * Find legislators by state
   */
  async findByState(
    state: string,
    chamber?: Chamber,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<LegislatorSummary>> {
    const filters: LegislatorFilters = {
      state: state.toUpperCase(),
      inOffice: true,
    };

    if (chamber !== undefined) {
      filters.chamber = chamber;
    }

    return this.findMany(
      filters,
      pagination,
      { field: 'lastName', direction: 'asc' }
    );
  }

  /**
   * Find legislators by party
   */
  async findByParty(
    party: Party,
    chamber?: Chamber,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<LegislatorSummary>> {
    const filters: LegislatorFilters = {
      party,
      inOffice: true,
    };

    if (chamber !== undefined) {
      filters.chamber = chamber;
    }

    return this.findMany(
      filters,
      pagination,
      { field: 'lastName', direction: 'asc' }
    );
  }

  /**
   * Get current members of Congress
   */
  async findCurrentMembers(
    chamber?: Chamber,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<LegislatorSummary>> {
    const filters: LegislatorFilters = {
      inOffice: true,
    };

    if (chamber !== undefined) {
      filters.chamber = chamber;
    }

    return this.findMany(
      filters,
      pagination,
      { field: 'lastName', direction: 'asc' }
    );
  }

  /**
   * Get legislator's voting record summary
   */
  async getVotingStats(legislatorId: string) {
    return this.cached(`voting-stats:${legislatorId}`, async () => {
      const stats = await prisma.vote.groupBy({
        by: ['position'],
        where: { legislatorId },
        _count: true,
      });

      return stats.reduce(
        (acc, stat) => {
          acc[stat.position] = stat._count;
          return acc;
        },
        {} as Record<string, number>
      );
    });
  }

  /**
   * Get legislator's committee memberships
   */
  async getCommittees(legislatorId: string, includeHistorical: boolean = false) {
    return prisma.committeeMembership.findMany({
      where: {
        legislatorId,
        ...(includeHistorical ? {} : { endDate: null }),
      },
      include: {
        committee: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: [{ committee: { name: 'asc' } }],
    });
  }

  /**
   * Get legislator's sponsored bills count by status
   */
  async getSponsorshipStats(legislatorId: string) {
    return this.cached(`sponsorship-stats:${legislatorId}`, async () => {
      const stats = await prisma.bill.groupBy({
        by: ['status'],
        where: {
          sponsors: {
            some: { legislatorId, isPrimary: true },
          },
        },
        _count: true,
      });

      const cosponsored = await prisma.billSponsor.count({
        where: { legislatorId, isPrimary: false },
      });

      return {
        byStatus: stats.reduce(
          (acc, stat) => {
            acc[stat.status] = stat._count;
            return acc;
          },
          {} as Record<string, number>
        ),
        totalSponsored: stats.reduce((sum, s) => sum + s._count, 0),
        totalCosponsored: cosponsored,
      };
    });
  }

  /**
   * Invalidate legislator cache
   */
  async invalidateLegislator(legislatorId: string): Promise<void> {
    await this.invalidate(`detail:${legislatorId}`);
    await this.invalidate(`voting-stats:${legislatorId}`);
    await this.invalidate(`sponsorship-stats:${legislatorId}`);
    await this.invalidatePattern('search:*');
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: LegislatorFilters): Prisma.LegislatorWhereInput {
    const where: Prisma.LegislatorWhereInput = {};

    if (filters.party) {
      where.party = Array.isArray(filters.party)
        ? { in: filters.party }
        : filters.party;
    }

    if (filters.chamber) {
      where.chamber = filters.chamber;
    }

    if (filters.state) {
      where.state = filters.state.toUpperCase();
    }

    if (filters.inOffice !== undefined) {
      where.inOffice = filters.inOffice;
    }

    if (filters.isVotingMember !== undefined) {
      where.isVotingMember = filters.isVotingMember;
    }

    return where;
  }
}

// Singleton instance
export const legislatorRepository = new LegislatorRepository();
