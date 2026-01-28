# WP3: API Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the API layer by wiring Express routes to the repository layer with proper DTO transformation, service abstraction, and integration tests.

**Architecture:** Three-layer architecture with Routes (HTTP handling, validation) -> Services (business logic, orchestration) -> Repositories (data access, caching). DTOs transform between Prisma entities (UPPERCASE enums) and API contracts (lowercase enums per @ltip/shared types).

**Tech Stack:** Express.js, Zod validation, Prisma ORM, Vitest for testing, supertest for HTTP testing

---

## Overview

| Aspect | Details |
|--------|---------|
| **Version** | 0.4.0 |
| **Effort** | 4-6 hours |
| **Risk** | Low - straightforward wiring of existing components |
| **Dependencies** | WP2 (repositories) MUST be complete |

## Acceptance Criteria

- [ ] All API endpoints return real data from PostgreSQL
- [ ] Enum transformation works correctly (Prisma UPPERCASE <-> API lowercase)
- [ ] Pagination matches @ltip/shared PaginatedResponse interface
- [ ] Full-text search endpoints functional
- [ ] Committee routes added (missing from v0.2.0)
- [ ] Integration tests achieve 80%+ coverage on routes
- [ ] No TypeScript errors
- [ ] All tests pass

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Enum mismatch runtime errors | Medium | High | Comprehensive mapper tests |
| Type incompatibility @ltip/shared | Low | Medium | Update shared types if needed |
| Performance on large datasets | Low | Medium | Pagination defaults enforced |
| Database connection issues | Low | High | Health check before tests |

## File Structure

```
apps/api/src/
├── services/               # NEW: Business logic layer
│   ├── index.ts
│   ├── bill.service.ts
│   ├── legislator.service.ts
│   ├── vote.service.ts
│   └── committee.service.ts
├── mappers/                # NEW: DTO transformation
│   ├── index.ts
│   ├── bill.mapper.ts
│   ├── legislator.mapper.ts
│   ├── vote.mapper.ts
│   └── committee.mapper.ts
├── routes/                 # MODIFY: Wire to services
│   ├── bills.ts
│   ├── legislators.ts
│   ├── votes.ts
│   └── committees.ts      # NEW
└── __tests__/             # NEW: Integration tests
    ├── setup.ts
    ├── bills.test.ts
    ├── legislators.test.ts
    ├── votes.test.ts
    └── committees.test.ts
```

---

## Task 1: Create Enum Mappers

**Files:**
- Create: `apps/api/src/mappers/enums.ts`
- Test: `apps/api/src/__tests__/mappers/enums.test.ts`

**Step 1: Write failing tests for enum mappers**

```typescript
// apps/api/src/__tests__/mappers/enums.test.ts
import { describe, it, expect } from 'vitest';
import {
  billTypeToApi,
  apiToBillType,
  partyToApi,
  apiToParty,
  chamberToApi,
  apiToChamber,
  billStatusToApi,
} from '../../mappers/enums.js';
import { BillType, Party, Chamber, BillStatus } from '@prisma/client';

describe('Enum Mappers', () => {
  describe('billTypeToApi', () => {
    it('converts HR to hr', () => {
      expect(billTypeToApi('HR')).toBe('hr');
    });
    it('converts all bill types', () => {
      expect(billTypeToApi('S')).toBe('s');
      expect(billTypeToApi('HJRES')).toBe('hjres');
      expect(billTypeToApi('SJRES')).toBe('sjres');
      expect(billTypeToApi('HCONRES')).toBe('hconres');
      expect(billTypeToApi('SCONRES')).toBe('sconres');
      expect(billTypeToApi('HRES')).toBe('hres');
      expect(billTypeToApi('SRES')).toBe('sres');
    });
  });

  describe('apiToBillType', () => {
    it('converts hr to HR', () => {
      expect(apiToBillType('hr')).toBe('HR');
    });
  });

  describe('partyToApi', () => {
    it('converts DEMOCRAT to D', () => {
      expect(partyToApi('DEMOCRAT')).toBe('D');
    });
    it('converts REPUBLICAN to R', () => {
      expect(partyToApi('REPUBLICAN')).toBe('R');
    });
    it('converts INDEPENDENT to I', () => {
      expect(partyToApi('INDEPENDENT')).toBe('I');
    });
    it('converts LIBERTARIAN to L', () => {
      expect(partyToApi('LIBERTARIAN')).toBe('L');
    });
    it('converts GREEN to G', () => {
      expect(partyToApi('GREEN')).toBe('G');
    });
  });

  describe('chamberToApi', () => {
    it('converts HOUSE to house', () => {
      expect(chamberToApi('HOUSE')).toBe('house');
    });
    it('converts SENATE to senate', () => {
      expect(chamberToApi('SENATE')).toBe('senate');
    });
    it('converts JOINT to joint', () => {
      expect(chamberToApi('JOINT')).toBe('joint');
    });
  });

  describe('billStatusToApi', () => {
    it('converts INTRODUCED to introduced', () => {
      expect(billStatusToApi('INTRODUCED')).toBe('introduced');
    });
    it('converts SIGNED_INTO_LAW to became_law', () => {
      expect(billStatusToApi('SIGNED_INTO_LAW')).toBe('became_law');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/__tests__/mappers/enums.test.ts
```
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// apps/api/src/mappers/enums.ts
import { BillType, Party, Chamber, BillStatus } from '@prisma/client';
import type {
  BillType as ApiBillType,
  Party as ApiParty,
  Chamber as ApiChamber,
  BillStatus as ApiBillStatus,
} from '@ltip/shared';

// Bill Type mappings
const billTypeMap: Record<BillType, ApiBillType> = {
  HR: 'hr',
  S: 's',
  HJRES: 'hjres',
  SJRES: 'sjres',
  HCONRES: 'hconres',
  SCONRES: 'sconres',
  HRES: 'hres',
  SRES: 'sres',
};

const apiBillTypeMap: Record<ApiBillType, BillType> = {
  hr: 'HR',
  s: 'S',
  hjres: 'HJRES',
  sjres: 'SJRES',
  hconres: 'HCONRES',
  sconres: 'SCONRES',
  hres: 'HRES',
  sres: 'SRES',
};

export function billTypeToApi(type: BillType): ApiBillType {
  return billTypeMap[type];
}

export function apiToBillType(type: ApiBillType): BillType {
  return apiBillTypeMap[type];
}

// Party mappings
const partyMap: Record<Party, ApiParty> = {
  DEMOCRAT: 'D',
  REPUBLICAN: 'R',
  INDEPENDENT: 'I',
  LIBERTARIAN: 'L',
  GREEN: 'G',
};

const apiPartyMap: Record<ApiParty, Party> = {
  D: 'DEMOCRAT',
  R: 'REPUBLICAN',
  I: 'INDEPENDENT',
  L: 'LIBERTARIAN',
  G: 'GREEN',
};

export function partyToApi(party: Party): ApiParty {
  return partyMap[party];
}

export function apiToParty(party: ApiParty): Party {
  return apiPartyMap[party];
}

// Chamber mappings
const chamberMap: Record<Chamber, ApiChamber> = {
  HOUSE: 'house',
  SENATE: 'senate',
  JOINT: 'joint',
};

const apiChamberMap: Record<ApiChamber, Chamber> = {
  house: 'HOUSE',
  senate: 'SENATE',
  joint: 'JOINT',
};

export function chamberToApi(chamber: Chamber): ApiChamber {
  return chamberMap[chamber];
}

export function apiToChamber(chamber: ApiChamber): Chamber {
  return apiChamberMap[chamber];
}

// Bill Status mappings (Prisma has more statuses than API)
const billStatusMap: Record<BillStatus, ApiBillStatus> = {
  INTRODUCED: 'introduced',
  IN_COMMITTEE: 'in_committee',
  PASSED_HOUSE: 'passed_house',
  PASSED_SENATE: 'passed_senate',
  PASSED_BOTH: 'resolving_differences',
  RESOLVING_DIFFERENCES: 'resolving_differences',
  TO_PRESIDENT: 'to_president',
  SIGNED_INTO_LAW: 'became_law',
  ENACTED: 'became_law',
  VETOED: 'vetoed',
  VETO_OVERRIDDEN: 'became_law',
  POCKET_VETOED: 'vetoed',
  FAILED: 'failed',
  WITHDRAWN: 'failed',
};

export function billStatusToApi(status: BillStatus): ApiBillStatus {
  return billStatusMap[status];
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/__tests__/mappers/enums.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/mappers/enums.ts apps/api/src/__tests__/mappers/enums.test.ts
git commit -m "feat(api): add enum mappers for Prisma-to-API transformation"
```

---

## Task 2: Create Bill Mapper

**Files:**
- Create: `apps/api/src/mappers/bill.mapper.ts`
- Create: `apps/api/src/mappers/index.ts`
- Test: `apps/api/src/__tests__/mappers/bill.mapper.test.ts`

**Step 1: Write failing test**

```typescript
// apps/api/src/__tests__/mappers/bill.mapper.test.ts
import { describe, it, expect } from 'vitest';
import { mapBillToApi, mapBillSummaryToApi } from '../../mappers/bill.mapper.js';

describe('Bill Mapper', () => {
  describe('mapBillSummaryToApi', () => {
    it('maps a bill summary to API format', () => {
      const prismaBill = {
        id: 'bill-1',
        congressNumber: 118,
        billType: 'HR' as const,
        billNumber: 1234,
        title: 'Test Bill',
        shortTitle: 'TB',
        status: 'INTRODUCED' as const,
        introducedDate: new Date('2024-01-15'),
        lastActionDate: new Date('2024-01-20'),
        sponsorCount: 5,
        cosponsorsD: 3,
        cosponsorsR: 1,
        cosponsorsI: 1,
      };

      const result = mapBillSummaryToApi(prismaBill);

      expect(result.id).toBe('bill-1');
      expect(result.billType).toBe('hr');
      expect(result.status).toBe('introduced');
      expect(result.chamber).toBe('house');
      expect(result.cosponsorsCount).toBe(5);
      expect(result.introducedDate).toBe('2024-01-15T00:00:00.000Z');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/__tests__/mappers/bill.mapper.test.ts
```

**Step 3: Write implementation**

```typescript
// apps/api/src/mappers/bill.mapper.ts
import type { Bill, BillAction } from '@ltip/shared';
import type { BillSummary, BillWithRelations } from '../repositories/bill.repository.js';
import { billTypeToApi, billStatusToApi, chamberToApi, partyToApi } from './enums.js';
import { BillType } from '@prisma/client';

/**
 * Determine chamber from bill type
 */
function getChamberFromBillType(billType: BillType): 'house' | 'senate' | 'joint' {
  const houseTypes: BillType[] = ['HR', 'HRES', 'HJRES', 'HCONRES'];
  const senateTypes: BillType[] = ['S', 'SRES', 'SJRES', 'SCONRES'];

  if (houseTypes.includes(billType)) return 'house';
  if (senateTypes.includes(billType)) return 'senate';
  return 'joint';
}

/**
 * Map Prisma BillSummary to API Bill (partial)
 */
export function mapBillSummaryToApi(bill: BillSummary): Omit<Bill, 'sponsor' | 'latestAction' | 'subjects' | 'policyArea' | 'createdAt' | 'updatedAt'> {
  return {
    id: bill.id,
    congressNumber: bill.congressNumber,
    billType: billTypeToApi(bill.billType),
    billNumber: bill.billNumber,
    title: bill.title,
    shortTitle: bill.shortTitle ?? undefined,
    introducedDate: bill.introducedDate.toISOString(),
    status: billStatusToApi(bill.status),
    chamber: getChamberFromBillType(bill.billType),
    cosponsorsCount: bill.sponsorCount,
  };
}

/**
 * Map Prisma BillWithRelations to full API Bill
 */
export function mapBillToApi(bill: BillWithRelations): Bill {
  const primarySponsor = bill.sponsors.find(s => s.isPrimary);

  return {
    id: bill.id,
    congressNumber: bill.congressNumber,
    billType: billTypeToApi(bill.billType),
    billNumber: bill.billNumber,
    title: bill.title,
    shortTitle: bill.shortTitle ?? undefined,
    introducedDate: bill.introducedDate.toISOString(),
    status: billStatusToApi(bill.status),
    chamber: getChamberFromBillType(bill.billType),
    cosponsorsCount: bill.sponsors.length,
    subjects: bill.subjects.map(s => s.subject.name),
    policyArea: bill.policyArea?.name,
    sponsor: primarySponsor ? {
      id: primarySponsor.legislator.id,
      bioguideId: primarySponsor.legislator.bioguideId,
      firstName: primarySponsor.legislator.firstName,
      lastName: primarySponsor.legislator.lastName,
      fullName: primarySponsor.legislator.fullName,
      party: partyToApi(primarySponsor.legislator.party),
      state: primarySponsor.legislator.state,
      district: primarySponsor.legislator.district ?? undefined,
      chamber: chamberToApi(primarySponsor.legislator.chamber),
      inOffice: primarySponsor.legislator.inOffice,
      termStart: primarySponsor.legislator.termStart.toISOString(),
      termEnd: primarySponsor.legislator.termEnd?.toISOString(),
    } : undefined,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}
```

```typescript
// apps/api/src/mappers/index.ts
export * from './enums.js';
export * from './bill.mapper.js';
```

**Step 4: Run test**

```bash
cd apps/api && npx vitest run src/__tests__/mappers/bill.mapper.test.ts
```

**Step 5: Commit**

```bash
git add apps/api/src/mappers/
git commit -m "feat(api): add bill mapper for DTO transformation"
```

---

## Task 3: Create Legislator and Vote Mappers

**Files:**
- Create: `apps/api/src/mappers/legislator.mapper.ts`
- Create: `apps/api/src/mappers/vote.mapper.ts`
- Update: `apps/api/src/mappers/index.ts`

**Step 1: Create legislator mapper**

```typescript
// apps/api/src/mappers/legislator.mapper.ts
import type { Legislator } from '@ltip/shared';
import type { LegislatorSummary, LegislatorWithRelations } from '../repositories/legislator.repository.js';
import { partyToApi, chamberToApi } from './enums.js';

/**
 * Map Prisma LegislatorSummary to API Legislator
 */
export function mapLegislatorSummaryToApi(legislator: LegislatorSummary): Omit<Legislator, 'termStart' | 'termEnd' | 'bioguideId' | 'imageUrl' | 'phone'> {
  return {
    id: legislator.id,
    firstName: legislator.firstName,
    lastName: legislator.lastName,
    fullName: legislator.fullName,
    party: partyToApi(legislator.party),
    state: legislator.state,
    district: legislator.district ?? undefined,
    chamber: chamberToApi(legislator.chamber),
    inOffice: legislator.inOffice,
    website: legislator.website ?? undefined,
    twitter: legislator.twitterHandle ?? undefined,
  };
}

/**
 * Map Prisma LegislatorWithRelations to full API Legislator
 */
export function mapLegislatorToApi(legislator: LegislatorWithRelations): Legislator {
  return {
    id: legislator.id,
    bioguideId: legislator.bioguideId,
    firstName: legislator.firstName,
    lastName: legislator.lastName,
    fullName: legislator.fullName,
    party: partyToApi(legislator.party),
    state: legislator.state,
    district: legislator.district ?? undefined,
    chamber: chamberToApi(legislator.chamber),
    imageUrl: legislator.imageUrl ?? undefined,
    phone: legislator.phone ?? undefined,
    website: legislator.website ?? undefined,
    twitter: legislator.twitterHandle ?? undefined,
    inOffice: legislator.inOffice,
    termStart: legislator.termStart.toISOString(),
    termEnd: legislator.termEnd?.toISOString(),
  };
}
```

**Step 2: Create vote mapper**

```typescript
// apps/api/src/mappers/vote.mapper.ts
import type { Vote, VoteResult, VotePosition } from '@ltip/shared';
import type { RollCallVoteSummary, RollCallVoteWithRelations } from '../repositories/vote.repository.js';
import { chamberToApi } from './enums.js';
import { VoteResult as PrismaVoteResult, VotePosition as PrismaVotePosition } from '@prisma/client';

const voteResultMap: Record<PrismaVoteResult, VoteResult> = {
  PASSED: 'passed',
  FAILED: 'failed',
  AGREED_TO: 'agreed_to',
  REJECTED: 'rejected',
  UNKNOWN: 'failed', // Default fallback
};

const votePositionMap: Record<PrismaVotePosition, VotePosition> = {
  YEA: 'yea',
  NAY: 'nay',
  PRESENT: 'present',
  NOT_VOTING: 'not_voting',
};

export function voteResultToApi(result: PrismaVoteResult): VoteResult {
  return voteResultMap[result];
}

export function votePositionToApi(position: PrismaVotePosition): VotePosition {
  return votePositionMap[position];
}

/**
 * Map Prisma RollCallVoteSummary to API Vote
 */
export function mapVoteSummaryToApi(vote: RollCallVoteSummary): Vote {
  return {
    id: vote.id,
    billId: vote.billId ?? undefined,
    chamber: chamberToApi(vote.chamber),
    session: vote.session,
    rollCallNumber: vote.rollCallNumber,
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
 * Map Prisma RollCallVoteWithRelations to API Vote
 */
export function mapVoteToApi(vote: RollCallVoteWithRelations): Vote {
  return mapVoteSummaryToApi(vote);
}
```

**Step 3: Update index**

```typescript
// apps/api/src/mappers/index.ts
export * from './enums.js';
export * from './bill.mapper.js';
export * from './legislator.mapper.js';
export * from './vote.mapper.js';
```

**Step 4: Commit**

```bash
git add apps/api/src/mappers/
git commit -m "feat(api): add legislator and vote mappers"
```

---

## Task 4: Create Service Layer

**Files:**
- Create: `apps/api/src/services/bill.service.ts`
- Create: `apps/api/src/services/legislator.service.ts`
- Create: `apps/api/src/services/vote.service.ts`
- Create: `apps/api/src/services/committee.service.ts`
- Create: `apps/api/src/services/index.ts`

**Step 1: Create bill service**

```typescript
// apps/api/src/services/bill.service.ts
import type { Bill, PaginatedResponse, Pagination } from '@ltip/shared';
import { billRepository, type BillFilters } from '../repositories/index.js';
import { mapBillToApi, mapBillSummaryToApi, apiToBillType, apiToChamber } from '../mappers/index.js';
import { BillStatus, BillType } from '@prisma/client';

export interface ListBillsParams {
  congressNumber?: number;
  billType?: string;
  status?: string;
  chamber?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function mapApiStatusToPrisma(status: string): BillStatus {
  const statusMap: Record<string, BillStatus> = {
    introduced: 'INTRODUCED',
    in_committee: 'IN_COMMITTEE',
    passed_house: 'PASSED_HOUSE',
    passed_senate: 'PASSED_SENATE',
    resolving_differences: 'RESOLVING_DIFFERENCES',
    to_president: 'TO_PRESIDENT',
    became_law: 'SIGNED_INTO_LAW',
    vetoed: 'VETOED',
    failed: 'FAILED',
  };
  return statusMap[status] ?? 'INTRODUCED';
}

export const billService = {
  async list(params: ListBillsParams): Promise<PaginatedResponse<Partial<Bill>>> {
    const { search, limit = 20, offset = 0, ...filterParams } = params;

    // Use full-text search if search query provided
    if (search) {
      const result = await billRepository.search(search, {
        page: Math.floor(offset / limit) + 1,
        limit,
      });

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

    // Build filters
    const filters: BillFilters = {};
    if (filterParams.congressNumber) filters.congressNumber = filterParams.congressNumber;
    if (filterParams.billType) filters.billType = apiToBillType(filterParams.billType as any);
    if (filterParams.status) filters.status = mapApiStatusToPrisma(filterParams.status);
    if (filterParams.chamber) {
      // Chamber maps to bill types
      const chamber = apiToChamber(filterParams.chamber as any);
      filters.chamber = chamber;
    }

    const result = await billRepository.findMany(
      filters,
      { page: Math.floor(offset / limit) + 1, limit }
    );

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

  async getById(id: string): Promise<Bill | null> {
    const bill = await billRepository.findById(id);
    if (!bill) return null;
    return mapBillToApi(bill);
  },

  async getActions(billId: string) {
    return billRepository.getActions(billId);
  },

  async getTextVersions(billId: string) {
    return billRepository.getTextVersions(billId);
  },

  async getCosponsors(billId: string) {
    const bill = await billRepository.findById(billId);
    if (!bill) return [];

    return bill.sponsors
      .filter(s => !s.isPrimary)
      .map(s => ({
        id: s.legislator.id,
        fullName: s.legislator.fullName,
        party: s.legislator.party,
        state: s.legislator.state,
        cosponsorDate: s.cosponsorDate?.toISOString(),
      }));
  },
};
```

**Step 2: Create legislator service**

```typescript
// apps/api/src/services/legislator.service.ts
import type { Legislator, PaginatedResponse } from '@ltip/shared';
import { legislatorRepository, type LegislatorFilters } from '../repositories/index.js';
import { billRepository } from '../repositories/index.js';
import { mapLegislatorToApi, mapLegislatorSummaryToApi, apiToParty, apiToChamber } from '../mappers/index.js';
import { mapBillSummaryToApi } from '../mappers/bill.mapper.js';

export interface ListLegislatorsParams {
  chamber?: string;
  party?: string;
  state?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const legislatorService = {
  async list(params: ListLegislatorsParams): Promise<PaginatedResponse<Partial<Legislator>>> {
    const { search, limit = 20, offset = 0, ...filterParams } = params;

    if (search) {
      const result = await legislatorRepository.search(search, {
        page: Math.floor(offset / limit) + 1,
        limit,
      });

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

    const filters: LegislatorFilters = { inOffice: true };
    if (filterParams.party) filters.party = apiToParty(filterParams.party as any);
    if (filterParams.chamber) filters.chamber = apiToChamber(filterParams.chamber as any);
    if (filterParams.state) filters.state = filterParams.state;

    const result = await legislatorRepository.findMany(
      filters,
      { page: Math.floor(offset / limit) + 1, limit }
    );

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

  async getById(id: string): Promise<Legislator | null> {
    const legislator = await legislatorRepository.findById(id);
    if (!legislator) return null;
    return mapLegislatorToApi(legislator);
  },

  async getBills(legislatorId: string, primaryOnly = false, limit = 20, offset = 0) {
    const result = await billRepository.findByLegislator(
      legislatorId,
      primaryOnly,
      { page: Math.floor(offset / limit) + 1, limit }
    );

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

  async getVotingStats(legislatorId: string) {
    return legislatorRepository.getVotingStats(legislatorId);
  },

  async getSponsorshipStats(legislatorId: string) {
    return legislatorRepository.getSponsorshipStats(legislatorId);
  },
};
```

**Step 3: Create vote service**

```typescript
// apps/api/src/services/vote.service.ts
import type { Vote, PaginatedResponse } from '@ltip/shared';
import { voteRepository, type RollCallVoteFilters } from '../repositories/index.js';
import { mapVoteToApi, mapVoteSummaryToApi, votePositionToApi, apiToChamber } from '../mappers/index.js';
import { mapLegislatorSummaryToApi } from '../mappers/legislator.mapper.js';

export interface ListVotesParams {
  chamber?: string;
  billId?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

export const voteService = {
  async list(params: ListVotesParams): Promise<PaginatedResponse<Vote>> {
    const { limit = 20, offset = 0, ...filterParams } = params;

    const filters: RollCallVoteFilters = {};
    if (filterParams.chamber) filters.chamber = apiToChamber(filterParams.chamber as any);
    if (filterParams.billId) filters.billId = filterParams.billId;

    const result = await voteRepository.findMany(
      filters,
      { page: Math.floor(offset / limit) + 1, limit }
    );

    return {
      data: result.data.map(mapVoteSummaryToApi),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  async getById(id: string): Promise<Vote | null> {
    const vote = await voteRepository.findById(id);
    if (!vote) return null;
    return mapVoteToApi(vote);
  },

  async getLegislatorVotes(voteId: string) {
    const votes = await voteRepository.getVotesByRollCall(voteId);

    return votes.map(v => ({
      legislator: mapLegislatorSummaryToApi(v.legislator as any),
      position: votePositionToApi(v.position),
    }));
  },

  async getPartyBreakdown(voteId: string) {
    return voteRepository.getPartyBreakdown(voteId);
  },
};
```

**Step 4: Create committee service**

```typescript
// apps/api/src/services/committee.service.ts
import { committeeRepository, type CommitteeFilters } from '../repositories/index.js';
import { chamberToApi, apiToChamber } from '../mappers/index.js';

export interface ListCommitteesParams {
  chamber?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export const committeeService = {
  async list(params: ListCommitteesParams) {
    const { limit = 20, offset = 0, ...filterParams } = params;

    const filters: CommitteeFilters = {};
    if (filterParams.chamber) filters.chamber = apiToChamber(filterParams.chamber as any);

    const result = await committeeRepository.findMany(
      filters,
      { page: Math.floor(offset / limit) + 1, limit }
    );

    return {
      data: result.data.map(c => ({
        ...c,
        chamber: chamberToApi(c.chamber),
      })),
      pagination: {
        total: result.pagination.total,
        limit,
        offset,
        hasMore: result.pagination.hasNext,
      },
    };
  },

  async getById(id: string) {
    const committee = await committeeRepository.findById(id);
    if (!committee) return null;

    return {
      ...committee,
      chamber: chamberToApi(committee.chamber),
      members: committee.members.map(m => ({
        ...m,
        legislator: {
          ...m.legislator,
        },
      })),
    };
  },

  async getMembers(committeeId: string, includeHistorical = false) {
    return committeeRepository.getMembers(committeeId, includeHistorical);
  },

  async getSubcommittees(parentId: string) {
    const subs = await committeeRepository.findSubcommittees(parentId);
    return subs.map(s => ({
      ...s,
      chamber: chamberToApi(s.chamber),
    }));
  },
};
```

**Step 5: Create service index**

```typescript
// apps/api/src/services/index.ts
export { billService } from './bill.service.js';
export { legislatorService } from './legislator.service.js';
export { voteService } from './vote.service.js';
export { committeeService } from './committee.service.js';
```

**Step 6: Commit**

```bash
git add apps/api/src/services/
git commit -m "feat(api): add service layer with business logic"
```

---

## Task 5: Wire Routes to Services

**Files:**
- Modify: `apps/api/src/routes/bills.ts`
- Modify: `apps/api/src/routes/legislators.ts`
- Modify: `apps/api/src/routes/votes.ts`
- Create: `apps/api/src/routes/committees.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Update bills route**

```typescript
// apps/api/src/routes/bills.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { billService } from '../services/index.js';

export const billsRouter = Router();

const listBillsSchema = z.object({
  congressNumber: z.coerce.number().int().min(1).optional(),
  billType: z.enum(['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']).optional(),
  status: z.enum([
    'introduced',
    'in_committee',
    'passed_house',
    'passed_senate',
    'resolving_differences',
    'to_president',
    'became_law',
    'vetoed',
    'failed',
  ]).optional(),
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

billsRouter.get('/', validate(listBillsSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as z.infer<typeof listBillsSchema>;
    const result = await billService.list(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const getBillSchema = z.object({
  id: z.string().min(1),
});

billsRouter.get('/:id', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const bill = await billService.getById(id);

    if (!bill) {
      throw ApiError.notFound('Bill');
    }

    res.json(bill);
  } catch (error) {
    next(error);
  }
});

billsRouter.get('/:id/cosponsors', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const cosponsors = await billService.getCosponsors(id);
    res.json({ data: cosponsors });
  } catch (error) {
    next(error);
  }
});

billsRouter.get('/:id/actions', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const actions = await billService.getActions(id);
    res.json({ data: actions });
  } catch (error) {
    next(error);
  }
});
```

**Step 2: Update legislators route**

```typescript
// apps/api/src/routes/legislators.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { legislatorService } from '../services/index.js';

export const legislatorsRouter = Router();

const listLegislatorsSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  party: z.enum(['D', 'R', 'I', 'L', 'G']).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

legislatorsRouter.get('/', validate(listLegislatorsSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as z.infer<typeof listLegislatorsSchema>;
    const result = await legislatorService.list(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const getLegislatorSchema = z.object({
  id: z.string().min(1),
});

legislatorsRouter.get('/:id', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const legislator = await legislatorService.getById(id);

    if (!legislator) {
      throw ApiError.notFound('Legislator');
    }

    res.json(legislator);
  } catch (error) {
    next(error);
  }
});

legislatorsRouter.get('/:id/bills', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await legislatorService.getBills(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

legislatorsRouter.get('/:id/votes', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const stats = await legislatorService.getVotingStats(id);
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
});

legislatorsRouter.get('/:id/stats', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const [votingStats, sponsorshipStats] = await Promise.all([
      legislatorService.getVotingStats(id),
      legislatorService.getSponsorshipStats(id),
    ]);
    res.json({ voting: votingStats, sponsorship: sponsorshipStats });
  } catch (error) {
    next(error);
  }
});
```

**Step 3: Update votes route**

```typescript
// apps/api/src/routes/votes.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { voteService } from '../services/index.js';

export const votesRouter = Router();

const listVotesSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  billId: z.string().optional(),
  result: z.enum(['passed', 'failed', 'agreed_to', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

votesRouter.get('/', validate(listVotesSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as z.infer<typeof listVotesSchema>;
    const result = await voteService.list(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const getVoteSchema = z.object({
  id: z.string().min(1),
});

votesRouter.get('/:id', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const vote = await voteService.getById(id);

    if (!vote) {
      throw ApiError.notFound('Vote');
    }

    res.json(vote);
  } catch (error) {
    next(error);
  }
});

votesRouter.get('/:id/legislators', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const legislatorVotes = await voteService.getLegislatorVotes(id);
    res.json({ data: legislatorVotes });
  } catch (error) {
    next(error);
  }
});

votesRouter.get('/:id/breakdown', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const breakdown = await voteService.getPartyBreakdown(id);
    res.json(breakdown);
  } catch (error) {
    next(error);
  }
});
```

**Step 4: Create committees route**

```typescript
// apps/api/src/routes/committees.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { committeeService } from '../services/index.js';

export const committeesRouter = Router();

const listCommitteesSchema = z.object({
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  type: z.enum(['standing', 'select', 'joint', 'subcommittee']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

committeesRouter.get('/', validate(listCommitteesSchema, 'query'), async (req, res, next) => {
  try {
    const params = req.query as z.infer<typeof listCommitteesSchema>;
    const result = await committeeService.list(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const getCommitteeSchema = z.object({
  id: z.string().min(1),
});

committeesRouter.get('/:id', validate(getCommitteeSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const committee = await committeeService.getById(id);

    if (!committee) {
      throw ApiError.notFound('Committee');
    }

    res.json(committee);
  } catch (error) {
    next(error);
  }
});

committeesRouter.get('/:id/members', validate(getCommitteeSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeHistorical = req.query.includeHistorical === 'true';
    const members = await committeeService.getMembers(id, includeHistorical);
    res.json({ data: members });
  } catch (error) {
    next(error);
  }
});

committeesRouter.get('/:id/subcommittees', validate(getCommitteeSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const subcommittees = await committeeService.getSubcommittees(id);
    res.json({ data: subcommittees });
  } catch (error) {
    next(error);
  }
});
```

**Step 5: Register committees route in index.ts**

Add to `apps/api/src/index.ts`:
```typescript
import { committeesRouter } from './routes/committees.js';
// ... in route registration section:
app.use('/api/committees', committeesRouter);
```

**Step 6: Commit**

```bash
git add apps/api/src/routes/ apps/api/src/index.ts
git commit -m "feat(api): wire routes to services with real data access"
```

---

## Task 6: Write Integration Tests

**Files:**
- Create: `apps/api/src/__tests__/setup.ts`
- Create: `apps/api/src/__tests__/routes/bills.test.ts`
- Create: `apps/api/vitest.config.ts`

**Step 1: Create test setup**

```typescript
// apps/api/src/__tests__/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { prisma, disconnectDatabase } from '../db/client.js';

beforeAll(async () => {
  // Ensure database is connected
  await prisma.$connect();
});

afterAll(async () => {
  await disconnectDatabase();
});
```

**Step 2: Create vitest config**

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/*.d.ts'],
    },
  },
});
```

**Step 3: Create bills integration test**

```typescript
// apps/api/src/__tests__/routes/bills.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { billsRouter } from '../../routes/bills.js';
import { errorHandler } from '../../middleware/error.js';

const app = express();
app.use(express.json());
app.use('/api/bills', billsRouter);
app.use(errorHandler);

describe('Bills API', () => {
  describe('GET /api/bills', () => {
    it('returns paginated bills', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('supports search query', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ search: 'healthcare', limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('filters by chamber', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ chamber: 'house', limit: 5 });

      expect(response.status).toBe(200);
    });

    it('validates limit parameter', async () => {
      const response = await request(app)
        .get('/api/bills')
        .query({ limit: 200 }); // exceeds max

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/bills/:id', () => {
    it('returns 404 for non-existent bill', async () => {
      const response = await request(app)
        .get('/api/bills/non-existent-id');

      expect(response.status).toBe(404);
    });
  });
});
```

**Step 4: Add test script to package.json**

Update `apps/api/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

**Step 5: Run tests**

```bash
cd apps/api && npm install && npm test
```

**Step 6: Commit**

```bash
git add apps/api/src/__tests__/ apps/api/vitest.config.ts apps/api/package.json
git commit -m "test(api): add integration tests for API routes"
```

---

## Task 7: Update CHANGELOG and Tag Release

**Files:**
- Modify: `docs/change-control/CHANGELOG.md`

**Step 1: Update CHANGELOG**

Add new section for v0.4.0 with:
- Service layer implementation
- DTO mappers for type transformation
- Routes wired to real data
- Committee endpoints added
- Integration test suite

**Step 2: Commit and tag**

```bash
git add docs/change-control/CHANGELOG.md
git commit -m "docs: update CHANGELOG for v0.4.0 API layer release"
git tag -a v0.4.0 -m "Phase 1 API layer complete"
git push origin master --tags
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm test` passes all integration tests
- [ ] Manual testing: `curl http://localhost:4001/api/bills?limit=5` returns data
- [ ] Manual testing: `curl http://localhost:4001/api/legislators?chamber=house` returns data
- [ ] Manual testing: `curl http://localhost:4001/api/committees` returns data
- [ ] Full-text search works: `curl http://localhost:4001/api/bills?search=healthcare`
- [ ] Git history shows atomic commits for each task
- [ ] CHANGELOG updated with v0.4.0 entry

---

## Rollback Plan

If issues arise:
1. Revert to previous commit: `git revert HEAD~N`
2. Routes can fall back to returning empty arrays (v0.2.0 behavior)
3. Services and mappers can be deleted without affecting routes if needed

---

**Estimated Total Time:** 4-6 hours
**Complexity:** Medium
**Risk Level:** Low
