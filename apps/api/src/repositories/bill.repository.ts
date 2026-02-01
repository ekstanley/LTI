/**
 * Bill Repository
 *
 * Data access layer for bills with:
 * - Full-text search support
 * - Pagination and filtering
 * - Cache-aside pattern
 * - Sponsor/cosponsor relationships
 */

import { Prisma, BillStatus, BillType, Chamber } from '@prisma/client';

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
 * Bill filter parameters
 */
export interface BillFilters {
  congressNumber?: number;
  status?: BillStatus | BillStatus[];
  billType?: BillType | BillType[];
  chamber?: Chamber;
  policyAreaId?: string;
  sponsorId?: string;
  introducedAfter?: Date;
  introducedBefore?: Date;
  search?: string;
}

/**
 * Bill sort fields
 */
export type BillSortField =
  | 'introducedDate'
  | 'lastActionDate'
  | 'title'
  | 'sponsorCount';

/**
 * Bill with relations type
 */
export type BillWithRelations = Prisma.BillGetPayload<{
  include: {
    congress: true;
    policyArea: true;
    sponsors: {
      include: {
        legislator: true;
      };
    };
    subjects: {
      include: {
        subject: true;
      };
    };
  };
}>;

/**
 * Bill summary type (lighter weight for lists)
 */
export type BillSummary = Prisma.BillGetPayload<{
  select: {
    id: true;
    congressNumber: true;
    billType: true;
    billNumber: true;
    title: true;
    shortTitle: true;
    status: true;
    introducedDate: true;
    lastActionDate: true;
    sponsorCount: true;
    cosponsorsD: true;
    cosponsorsR: true;
    cosponsorsI: true;
  };
}>;

export class BillRepository extends BaseRepository {
  constructor() {
    super('bills', DEFAULT_TTL.BILL_DETAIL);
  }

  /**
   * Find bill by ID with full relations
   */
  async findById(id: string): Promise<BillWithRelations | null> {
    return this.cached(`detail:${id}`, async () => {
      return prisma.bill.findUnique({
        where: { id },
        include: {
          congress: true,
          policyArea: true,
          sponsors: {
            include: {
              legislator: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { cosponsorDate: 'asc' }],
          },
          subjects: {
            include: {
              subject: true,
            },
            where: { isPrimary: true },
          },
        },
      });
    });
  }

  /**
   * Find bills with pagination and filtering
   */
  async findMany(
    filters: BillFilters = {},
    pagination: PaginationParams = {},
    sort?: SortParams<BillSortField>
  ): Promise<PaginatedResponse<BillSummary>> {
    const { page, limit, skip } = parsePagination(pagination);
    const where = this.buildWhereClause(filters);
    const orderBy = buildOrderBy(sort, {
      field: 'lastActionDate',
      direction: 'desc',
    });

    // Execute count and find in parallel
    const [total, data] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          congressNumber: true,
          billType: true,
          billNumber: true,
          title: true,
          shortTitle: true,
          status: true,
          introducedDate: true,
          lastActionDate: true,
          sponsorCount: true,
          cosponsorsD: true,
          cosponsorsR: true,
          cosponsorsI: true,
        },
      }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Full-text search for bills
   * Uses PostgreSQL tsvector search via raw query
   */
  async search(
    query: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<BillSummary & { rank: number }>> {
    const { page, limit, skip } = parsePagination(pagination);
    const cacheKey = `search:${query}:${page}:${limit}`;

    return this.cached(
      cacheKey,
      async () => {
        // Use raw query for full-text search with ranking
        const results = await prisma.$queryRaw<
          (BillSummary & { rank: number })[]
        >`
          SELECT
            id, congress_number as "congressNumber", bill_type as "billType",
            bill_number as "billNumber", title, short_title as "shortTitle",
            status, introduced_date as "introducedDate",
            last_action_date as "lastActionDate", sponsor_count as "sponsorCount",
            cosponsors_d as "cosponsorsD", cosponsors_r as "cosponsorsR",
            cosponsors_i as "cosponsorsI",
            ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
          FROM bills
          WHERE search_vector @@ plainto_tsquery('english', ${query})
          ORDER BY rank DESC, introduced_date DESC
          LIMIT ${limit} OFFSET ${skip}
        `;

        const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM bills
          WHERE search_vector @@ plainto_tsquery('english', ${query})
        `;

        const total = Number(countResult[0].count);
        return buildPaginatedResponse(results, total, page, limit);
      },
      DEFAULT_TTL.SEARCH
    );
  }

  /**
   * Find bills sponsored by a legislator
   */
  async findByLegislator(
    legislatorId: string,
    primaryOnly: boolean = false,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<BillSummary>> {
    const { page, limit, skip } = parsePagination(pagination);

    const sponsorWhere: Prisma.BillSponsorWhereInput = {
      legislatorId,
      ...(primaryOnly && { isPrimary: true }),
    };

    const [total, sponsors] = await Promise.all([
      prisma.billSponsor.count({ where: sponsorWhere }),
      prisma.billSponsor.findMany({
        where: sponsorWhere,
        include: {
          bill: {
            select: {
              id: true,
              congressNumber: true,
              billType: true,
              billNumber: true,
              title: true,
              shortTitle: true,
              status: true,
              introducedDate: true,
              lastActionDate: true,
              sponsorCount: true,
              cosponsorsD: true,
              cosponsorsR: true,
              cosponsorsI: true,
            },
          },
        },
        orderBy: { bill: { lastActionDate: 'desc' } },
        skip,
        take: limit,
      }),
    ]);

    const data = sponsors.map((s) => s.bill);
    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Get bill actions/history
   */
  async getActions(billId: string) {
    return prisma.billAction.findMany({
      where: { billId },
      orderBy: { actionDate: 'desc' },
      include: {
        committee: true,
      },
    });
  }

  /**
   * Get bill text versions
   */
  async getTextVersions(billId: string) {
    return prisma.billTextVersion.findMany({
      where: { billId },
      orderBy: { publishedDate: 'desc' },
    });
  }

  /**
   * Get bill amendments
   */
  async getAmendments(billId: string) {
    return prisma.amendment.findMany({
      where: { billId },
      include: {
        sponsor: true,
        childAmendments: true,
      },
      orderBy: { offeredDate: 'desc' },
    });
  }

  /**
   * Get active bills (not in terminal status)
   */
  async findActive(
    congressNumber?: number,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<BillSummary>> {
    const terminalStatuses: BillStatus[] = [
      'SIGNED_INTO_LAW',
      'VETOED',
      'POCKET_VETOED',
      'FAILED',
      'WITHDRAWN',
      'ENACTED',
    ];

    const filters: BillFilters = {
      status: Object.values(BillStatus).filter(
        (s) => !terminalStatuses.includes(s)
      ),
    };

    if (congressNumber !== undefined) {
      filters.congressNumber = congressNumber;
    }

    return this.findMany(
      filters,
      pagination,
      { field: 'lastActionDate', direction: 'desc' }
    );
  }

  /**
   * Invalidate bill cache
   */
  async invalidateBill(billId: string): Promise<void> {
    await this.invalidate(`detail:${billId}`);
    // Also invalidate search cache as bill content may have changed
    await this.invalidatePattern('search:*');
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: BillFilters): Prisma.BillWhereInput {
    const where: Prisma.BillWhereInput = {};

    if (filters.congressNumber !== undefined) {
      where.congressNumber = filters.congressNumber;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.billType) {
      where.billType = Array.isArray(filters.billType)
        ? { in: filters.billType }
        : filters.billType;
    }

    if (filters.chamber) {
      // Map chamber to bill types
      const houseTypes: BillType[] = ['HR', 'HRES', 'HJRES', 'HCONRES'];
      const senateTypes: BillType[] = ['S', 'SRES', 'SJRES', 'SCONRES'];
      where.billType = {
        in: filters.chamber === 'HOUSE' ? houseTypes : senateTypes,
      };
    }

    if (filters.policyAreaId) {
      where.policyAreaId = filters.policyAreaId;
    }

    if (filters.sponsorId) {
      where.sponsors = {
        some: { legislatorId: filters.sponsorId },
      };
    }

    if (filters.introducedAfter || filters.introducedBefore) {
      where.introducedDate = {};
      if (filters.introducedAfter) {
        where.introducedDate.gte = filters.introducedAfter;
      }
      if (filters.introducedBefore) {
        where.introducedDate.lte = filters.introducedBefore;
      }
    }

    return where;
  }
}

// Singleton instance
export const billRepository = new BillRepository();
