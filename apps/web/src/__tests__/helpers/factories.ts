/**
 * Test data factories for deterministic mock data
 *
 * All factories produce type-safe objects matching @ltip/shared types.
 * Partial overrides are supported for customization.
 * No randomness - all values are deterministic.
 */

import type {
  Bill,
  Legislator,
  Vote,
  User,
  PaginatedResponse,
  Pagination,
} from '@ltip/shared';

export function createMockLegislator(overrides?: Partial<Legislator>): Legislator {
  return {
    id: 'M001234',
    bioguideId: 'S000001',
    firstName: 'John',
    lastName: 'Smith',
    fullName: 'John Smith',
    party: 'D',
    state: 'CA',
    chamber: 'house',
    inOffice: true,
    termStart: '2023-01-03',
    ...overrides,
  };
}

export function createMockBill(overrides?: Partial<Bill>): Bill {
  return {
    id: 'hr-1-119',
    congressNumber: 119,
    billType: 'hr',
    billNumber: 1,
    title: 'Test Bill',
    introducedDate: '2025-01-15',
    latestAction: {
      date: '2025-01-15',
      text: 'Introduced in House',
    },
    status: 'introduced',
    chamber: 'house',
    sponsor: createMockLegislator(),
    cosponsorsCount: 5,
    subjects: ['Economics', 'Taxation'],
    policyArea: 'Economics and Public Finance',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

export function createMockVote(overrides?: Partial<Vote>): Vote {
  return {
    id: 'vote-119-1-100',
    billId: 'hr-1-119',
    chamber: 'house',
    session: 1,
    rollCallNumber: 100,
    date: '2025-02-01',
    question: 'On Passage',
    result: 'passed',
    yeas: 220,
    nays: 210,
    present: 3,
    notVoting: 2,
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    ...overrides,
  };
}

export function createMockPagination(overrides?: Partial<Pagination>): Pagination {
  return {
    total: 50,
    limit: 20,
    offset: 0,
    hasMore: true,
    ...overrides,
  };
}

export function createMockPaginatedResponse<T>(
  data: T[],
  paginationOverrides?: Partial<Pagination>
): PaginatedResponse<T> {
  return {
    data,
    pagination: createMockPagination({
      total: data.length,
      hasMore: false,
      ...paginationOverrides,
    }),
  };
}
