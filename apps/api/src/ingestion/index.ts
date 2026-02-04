/**
 * Data Ingestion Module
 *
 * Handles data synchronization from external APIs (Congress.gov, etc.)
 * to the local database. Provides rate-limited, retry-capable API clients
 * with data transformation and scheduling capabilities.
 *
 * @module ingestion
 *
 * @example
 * ```ts
 * import {
 *   getCongressClient,
 *   getSyncScheduler,
 *   CongressApiClient,
 *   SyncScheduler,
 * } from './ingestion/index.js';
 *
 * // Use the Congress.gov API client
 * const client = getCongressClient();
 * const bills = await client.listBills(118);
 *
 * // Start the sync scheduler
 * const scheduler = getSyncScheduler(prisma);
 * await scheduler.start();
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Bill types
  BillListItem,
  BillDetail,
  BillAction,
  BillSponsor,
  BillCosponsor,
  BillTextVersion,
  BillSummaryItem,
  BillSubject,
  BillCommittee,
  PolicyArea,
  CongressBillType,

  // Member types
  MemberListItem,
  MemberDetail,
  MemberTerm,

  // Committee types
  CommitteeListItem,

  // Pagination
  Pagination,

  // Response types
  BillListResponse,
  BillDetailResponse,
  BillActionsResponse,
  BillCosponsorsResponse,
  BillTextVersionsResponse,
  MemberListResponse,
  MemberDetailResponse,
  CommitteeListResponse,

  // Sync types
  SyncState,
  SyncResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────

export {
  TokenBucketRateLimiter,
  getCongressApiLimiter,
  resetCongressApiLimiter,
} from './rate-limiter.js';

export type { RateLimiterOptions, RateLimiterStats } from './rate-limiter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Retry Handler
// ─────────────────────────────────────────────────────────────────────────────

export {
  withRetry,
  fetchWithRetry,
  calculateBackoffDelay,
  isRetryableResponse,
  isRetryableError,
  getRetryAfterMs,
  RetryExhaustedError,
} from './retry-handler.js';

export type { RetryOptions } from './retry-handler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Congress.gov API Client
// ─────────────────────────────────────────────────────────────────────────────

export {
  CongressApiClient,
  CongressApiError,
  getCongressClient,
  resetCongressClient,
} from './congress-client.js';

export type {
  CongressClientOptions,
  PaginationOptions,
  BillListOptions,
  MemberListOptions,
} from './congress-client.js';

// ─────────────────────────────────────────────────────────────────────────────
// Data Transformer
// ─────────────────────────────────────────────────────────────────────────────

export {
  // ID utilities
  generateBillId,
  parseBillId,

  // Enum mappers
  mapBillType,
  mapChamber,
  mapParty,
  mapCommitteeType,
  inferBillStatus,

  // Date utilities
  parseDate,
  parseDateRequired,

  // Bill transformers
  transformBillListItem,
  transformBillDetail,
  transformBillAction,
  transformCosponsor,
  transformTextVersion,

  // Member transformers
  transformMemberListItem,
  transformMemberDetail,

  // Committee transformers
  transformCommittee,

  // Batch transformers
  transformBillBatch,
  transformMemberBatch,
  transformCommitteeBatch,
} from './transformers/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Sync Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export {
  SyncScheduler,
  getSyncScheduler,
  resetSyncScheduler,
} from './sync-scheduler.js';

export type { SyncOptions, SyncStats } from './sync-scheduler.js';
