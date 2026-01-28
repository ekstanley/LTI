/**
 * Repository Layer Exports
 *
 * Provides unified exports for all data access repositories.
 * Repositories implement the repository pattern with:
 * - Type-safe Prisma queries
 * - Cache-aside pattern with Redis/Memory fallback
 * - Standardized pagination and filtering
 * - Full-text search integration
 */

// Base utilities
export {
  BaseRepository,
  type PaginationParams,
  type PaginatedResponse,
  type CursorPaginatedResponse,
  type SortParams,
  type SortDirection,
  parsePagination,
  buildPaginatedResponse,
  buildOrderBy,
} from './base.js';

// Bill repository
export {
  BillRepository,
  billRepository,
  type BillFilters,
  type BillSortField,
  type BillWithRelations,
  type BillSummary,
} from './bill.repository.js';

// Legislator repository
export {
  LegislatorRepository,
  legislatorRepository,
  type LegislatorFilters,
  type LegislatorSortField,
  type LegislatorWithRelations,
  type LegislatorSummary,
} from './legislator.repository.js';

// Vote repository
export {
  VoteRepository,
  voteRepository,
  type RollCallVoteFilters,
  type RollCallVoteSortField,
  type RollCallVoteWithRelations,
  type RollCallVoteSummary,
  type VoteWithLegislator,
} from './vote.repository.js';

// Committee repository
export {
  CommitteeRepository,
  committeeRepository,
  type CommitteeFilters,
  type CommitteeWithRelations,
  type CommitteeSummary,
} from './committee.repository.js';
