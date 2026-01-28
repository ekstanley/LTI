/**
 * Vote Repository
 *
 * Data access layer for roll call votes and individual votes with:
 * - Vote filtering by chamber, category, result
 * - Legislator voting record queries
 * - Bill vote history
 * - Vote comparison utilities
 */

import { Prisma, Chamber, VoteCategory, VotePosition, VoteResult } from '@prisma/client';
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
 * Roll call vote filter parameters
 */
export interface RollCallVoteFilters {
  chamber?: Chamber;
  congressNumber?: number;
  session?: number;
  voteCategory?: VoteCategory | VoteCategory[];
  result?: VoteResult | VoteResult[];
  billId?: string;
  voteDateAfter?: Date;
  voteDateBefore?: Date;
}

/**
 * Roll call vote sort fields
 */
export type RollCallVoteSortField = 'voteDate' | 'rollNumber';

/**
 * Roll call vote with relations
 */
export type RollCallVoteWithRelations = Prisma.RollCallVoteGetPayload<{
  include: {
    bill: {
      select: {
        id: true;
        title: true;
        shortTitle: true;
        billType: true;
        billNumber: true;
      };
    };
    individualVotes: {
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
 * Roll call vote summary
 */
export type RollCallVoteSummary = Prisma.RollCallVoteGetPayload<{
  select: {
    id: true;
    chamber: true;
    congressNumber: true;
    session: true;
    rollNumber: true;
    voteType: true;
    voteCategory: true;
    question: true;
    result: true;
    yeas: true;
    nays: true;
    present: true;
    notVoting: true;
    voteDate: true;
  };
}>;

/**
 * Individual vote with legislator
 */
export type VoteWithLegislator = Prisma.VoteGetPayload<{
  include: {
    legislator: {
      select: {
        id: true;
        fullName: true;
        party: true;
        state: true;
        chamber: true;
      };
    };
  };
}>;

export class VoteRepository extends BaseRepository {
  constructor() {
    super('votes', DEFAULT_TTL.VOTE);
  }

  /**
   * Find roll call vote by ID with full details
   */
  async findById(id: string): Promise<RollCallVoteWithRelations | null> {
    return this.cached(`rollcall:${id}`, async () => {
      return prisma.rollCallVote.findUnique({
        where: { id },
        include: {
          bill: {
            select: {
              id: true,
              title: true,
              shortTitle: true,
              billType: true,
              billNumber: true,
            },
          },
          individualVotes: {
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
            orderBy: [{ legislator: { party: 'asc' } }, { legislator: { lastName: 'asc' } }],
          },
        },
      });
    });
  }

  /**
   * Find roll call votes with pagination and filtering
   */
  async findMany(
    filters: RollCallVoteFilters = {},
    pagination: PaginationParams = {},
    sort?: SortParams<RollCallVoteSortField>
  ): Promise<PaginatedResponse<RollCallVoteSummary>> {
    const { page, limit, skip } = parsePagination(pagination);
    const where = this.buildWhereClause(filters);
    const orderBy = buildOrderBy(sort, { field: 'voteDate', direction: 'desc' });

    const [total, data] = await Promise.all([
      prisma.rollCallVote.count({ where }),
      prisma.rollCallVote.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          chamber: true,
          congressNumber: true,
          session: true,
          rollNumber: true,
          voteType: true,
          voteCategory: true,
          question: true,
          result: true,
          yeas: true,
          nays: true,
          present: true,
          notVoting: true,
          voteDate: true,
        },
      }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Find votes for a specific bill
   */
  async findByBill(
    billId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RollCallVoteSummary>> {
    return this.findMany({ billId }, pagination, { field: 'voteDate', direction: 'asc' });
  }

  /**
   * Get legislator's voting record
   */
  async getLegislatorVotes(
    legislatorId: string,
    filters: RollCallVoteFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<VoteWithLegislator & { rollCall: RollCallVoteSummary }>> {
    const { page, limit, skip } = parsePagination(pagination);

    const where: Prisma.VoteWhereInput = {
      legislatorId,
      rollCall: this.buildWhereClause(filters),
    };

    const [total, data] = await Promise.all([
      prisma.vote.count({ where }),
      prisma.vote.findMany({
        where,
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
          rollCall: {
            select: {
              id: true,
              chamber: true,
              congressNumber: true,
              session: true,
              rollNumber: true,
              voteType: true,
              voteCategory: true,
              question: true,
              result: true,
              yeas: true,
              nays: true,
              present: true,
              notVoting: true,
              voteDate: true,
            },
          },
        },
        orderBy: { rollCall: { voteDate: 'desc' } },
        skip,
        take: limit,
      }),
    ]);

    return buildPaginatedResponse(
      data as (VoteWithLegislator & { rollCall: RollCallVoteSummary })[],
      total,
      page,
      limit
    );
  }

  /**
   * Get vote breakdown by party for a roll call
   */
  async getPartyBreakdown(rollCallId: string) {
    return this.cached(`party-breakdown:${rollCallId}`, async () => {
      const votes = await prisma.vote.findMany({
        where: { rollCallId },
        include: {
          legislator: {
            select: { party: true },
          },
        },
      });

      const breakdown: Record<string, Record<VotePosition, number>> = {};

      for (const vote of votes) {
        const party = vote.legislator.party;
        if (!breakdown[party]) {
          breakdown[party] = { YEA: 0, NAY: 0, NOT_VOTING: 0, PRESENT: 0 };
        }
        breakdown[party][vote.position]++;
      }

      return breakdown;
    });
  }

  /**
   * Compare voting records between two legislators
   */
  async compareVotingRecords(
    legislatorId1: string,
    legislatorId2: string,
    congressNumber?: number
  ): Promise<{
    total: number;
    agreed: number;
    disagreed: number;
    agreementRate: number;
  }> {
    const cacheKey = `compare:${[legislatorId1, legislatorId2].sort().join('-')}:${
      congressNumber ?? 'all'
    }`;

    return this.cached(cacheKey, async () => {
      // Find roll calls where both legislators voted
      const rollCallIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT v1.roll_call_id as id
        FROM votes v1
        JOIN votes v2 ON v1.roll_call_id = v2.roll_call_id
        JOIN roll_call_votes rcv ON v1.roll_call_id = rcv.id
        WHERE v1.legislator_id = ${legislatorId1}
          AND v2.legislator_id = ${legislatorId2}
          AND v1.position IN ('YEA', 'NAY')
          AND v2.position IN ('YEA', 'NAY')
          ${congressNumber ? Prisma.sql`AND rcv.congress_number = ${congressNumber}` : Prisma.empty}
      `;

      if (rollCallIds.length === 0) {
        return { total: 0, agreed: 0, disagreed: 0, agreementRate: 0 };
      }

      // Count agreements
      const agreementResult = await prisma.$queryRaw<[{ agreed: bigint }]>`
        SELECT COUNT(*) as agreed
        FROM votes v1
        JOIN votes v2 ON v1.roll_call_id = v2.roll_call_id
        WHERE v1.legislator_id = ${legislatorId1}
          AND v2.legislator_id = ${legislatorId2}
          AND v1.position = v2.position
          AND v1.position IN ('YEA', 'NAY')
          AND v1.roll_call_id IN (${Prisma.join(rollCallIds.map((r) => r.id))})
      `;

      const total = rollCallIds.length;
      const agreed = Number(agreementResult[0].agreed);
      const disagreed = total - agreed;
      const agreementRate = total > 0 ? Math.round((agreed / total) * 100) : 0;

      return { total, agreed, disagreed, agreementRate };
    });
  }

  /**
   * Get recent votes by chamber
   */
  async findRecent(
    chamber: Chamber,
    limit: number = 10
  ): Promise<RollCallVoteSummary[]> {
    return this.cached(`recent:${chamber}:${limit}`, async () => {
      return prisma.rollCallVote.findMany({
        where: { chamber },
        orderBy: { voteDate: 'desc' },
        take: limit,
        select: {
          id: true,
          chamber: true,
          congressNumber: true,
          session: true,
          rollNumber: true,
          voteType: true,
          voteCategory: true,
          question: true,
          result: true,
          yeas: true,
          nays: true,
          present: true,
          notVoting: true,
          voteDate: true,
        },
      });
    });
  }

  /**
   * Invalidate vote cache
   */
  async invalidateRollCall(rollCallId: string): Promise<void> {
    await this.invalidate(`rollcall:${rollCallId}`);
    await this.invalidate(`party-breakdown:${rollCallId}`);
    await this.invalidatePattern('recent:*');
    await this.invalidatePattern('compare:*');
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: RollCallVoteFilters): Prisma.RollCallVoteWhereInput {
    const where: Prisma.RollCallVoteWhereInput = {};

    if (filters.chamber) {
      where.chamber = filters.chamber;
    }

    if (filters.congressNumber !== undefined) {
      where.congressNumber = filters.congressNumber;
    }

    if (filters.session !== undefined) {
      where.session = filters.session;
    }

    if (filters.voteCategory) {
      where.voteCategory = Array.isArray(filters.voteCategory)
        ? { in: filters.voteCategory }
        : filters.voteCategory;
    }

    if (filters.result) {
      where.result = Array.isArray(filters.result)
        ? { in: filters.result }
        : filters.result;
    }

    if (filters.billId) {
      where.billId = filters.billId;
    }

    if (filters.voteDateAfter || filters.voteDateBefore) {
      where.voteDate = {};
      if (filters.voteDateAfter) {
        where.voteDate.gte = filters.voteDateAfter;
      }
      if (filters.voteDateBefore) {
        where.voteDate.lte = filters.voteDateBefore;
      }
    }

    return where;
  }
}

// Singleton instance
export const voteRepository = new VoteRepository();
