/**
 * Congress.gov API Client
 *
 * A rate-limited, retry-capable client for the Congress.gov API v3.
 * Handles authentication, pagination, and error recovery.
 *
 * @see https://api.congress.gov/
 *
 * @example
 * ```ts
 * const client = new CongressApiClient({ apiKey: 'your-key' });
 * const bills = await client.listBills(118);
 * for await (const bill of bills) {
 *   console.log(bill.title);
 * }
 * ```
 */

import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { TokenBucketRateLimiter, getCongressApiLimiter } from './rate-limiter.js';
import { fetchWithRetry, getRetryAfterMs, RetryOptions } from './retry-handler.js';
import {
  BillListResponseSchema,
  BillDetailResponseSchema,
  BillActionsResponseSchema,
  BillCosponsorsResponseSchema,
  BillTextVersionsResponseSchema,
  MemberListResponseSchema,
  MemberDetailResponseSchema,
  CommitteeListResponseSchema,
  type BillListItem,
  type BillDetail,
  type BillAction,
  type BillCosponsor,
  type BillTextVersion,
  type MemberListItem,
  type MemberDetail,
  type CommitteeListItem,
  type CongressBillType,
} from './types.js';

export interface CongressClientOptions {
  /** API key for Congress.gov (from api.congress.gov) */
  apiKey?: string;
  /** Base URL for the API (default: https://api.congress.gov/v3) */
  baseUrl?: string;
  /** Rate limiter instance (default: shared singleton) */
  rateLimiter?: TokenBucketRateLimiter;
  /** Retry options for failed requests */
  retryOptions?: RetryOptions;
}

export interface PaginationOptions {
  /** Number of results per page (max 250) */
  limit?: number;
  /** Starting offset */
  offset?: number;
}

export interface BillListOptions extends PaginationOptions {
  /** Filter by bill type */
  type?: CongressBillType;
  /** Only return bills updated since this date */
  fromDateTime?: Date;
  /** Only return bills updated before this date */
  toDateTime?: Date;
  /** Sort order */
  sort?: 'updateDate+asc' | 'updateDate+desc';
}

export interface MemberListOptions extends PaginationOptions {
  /** Filter to current members only */
  currentMember?: boolean;
  /** Only return members updated since this date */
  fromDateTime?: Date;
  /** Only return members updated before this date */
  toDateTime?: Date;
}

export class CongressApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'CongressApiError';
  }
}

export class CongressApiClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly retryOptions: RetryOptions;

  constructor(options: CongressClientOptions = {}) {
    this.apiKey = options.apiKey ?? config.congress.apiKey;
    this.baseUrl = options.baseUrl ?? config.congress.baseUrl;
    this.rateLimiter = options.rateLimiter ?? getCongressApiLimiter();
    this.retryOptions = options.retryOptions ?? {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30_000,
    };
  }

  /**
   * Makes an authenticated request to the Congress.gov API.
   * Handles rate limiting, retries, and response validation.
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    // Wait for rate limiter
    await this.rateLimiter.acquire();

    // Build URL with query params
    const url = new URL(endpoint, this.baseUrl);

    // Add API key if available
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }

    // Add format
    url.searchParams.set('format', 'json');

    // Add other params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    logger.debug({ url: url.toString() }, 'Congress API request');

    try {
      const response = await fetchWithRetry(
        url.toString(),
        {
          headers: {
            Accept: 'application/json',
          },
        },
        {
          ...this.retryOptions,
          onRetry: (attempt, error, delayMs) => {
            logger.warn(
              { attempt, error, delayMs, endpoint },
              'Retrying Congress API request'
            );
          },
        }
      );

      // Check for rate limit response
      if (response.status === 429) {
        const retryAfter = getRetryAfterMs(response);
        throw new CongressApiError(
          `Rate limited. Retry after ${retryAfter ?? 'unknown'}ms`,
          429,
          endpoint
        );
      }

      // Check for other errors
      if (!response.ok) {
        const body = await response.text();
        throw new CongressApiError(
          `API error: ${response.statusText}`,
          response.status,
          endpoint,
          body
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof CongressApiError) {
        throw error;
      }
      throw new CongressApiError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        endpoint,
        error
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bills API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lists bills for a given Congress.
   *
   * @param congress Congress number (e.g., 118)
   * @param options Pagination and filtering options
   */
  async getBills(
    congress: number,
    options: BillListOptions = {}
  ): Promise<{ bills: BillListItem[]; nextOffset: number | null }> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    };

    if (options.fromDateTime) {
      params.fromDateTime = options.fromDateTime.toISOString();
    }
    if (options.toDateTime) {
      params.toDateTime = options.toDateTime.toISOString();
    }
    if (options.sort) {
      params.sort = options.sort;
    }

    let endpoint = `/bill/${congress}`;
    if (options.type) {
      endpoint += `/${options.type}`;
    }

    const response = await this.request<unknown>(endpoint, params);
    const parsed = BillListResponseSchema.parse(response);

    const nextOffset = parsed.pagination?.next
      ? (options.offset ?? 0) + (options.limit ?? 20)
      : null;

    return { bills: parsed.bills, nextOffset };
  }

  /**
   * Async generator for iterating through all bills.
   * Handles pagination automatically.
   *
   * @param congress Congress number
   * @param options Filtering options
   */
  async *listBills(
    congress: number,
    options: Omit<BillListOptions, 'offset'> = {}
  ): AsyncGenerator<BillListItem, void, unknown> {
    let offset = 0;
    const limit = options.limit ?? 250;

    while (true) {
      const { bills, nextOffset } = await this.getBills(congress, {
        ...options,
        limit,
        offset,
      });

      for (const bill of bills) {
        yield bill;
      }

      if (nextOffset === null || bills.length === 0) {
        break;
      }

      offset = nextOffset;
    }
  }

  /**
   * Gets detailed information about a specific bill.
   *
   * @param congress Congress number
   * @param type Bill type (hr, s, etc.)
   * @param number Bill number
   */
  async getBillDetail(
    congress: number,
    type: CongressBillType,
    number: number
  ): Promise<BillDetail> {
    const response = await this.request<unknown>(
      `/bill/${congress}/${type}/${number}`
    );
    const parsed = BillDetailResponseSchema.parse(response);
    return parsed.bill;
  }

  /**
   * Gets actions for a specific bill.
   */
  async getBillActions(
    congress: number,
    type: CongressBillType,
    number: number,
    options: PaginationOptions = {}
  ): Promise<{ actions: BillAction[]; nextOffset: number | null }> {
    const params = {
      limit: options.limit ?? 250,
      offset: options.offset ?? 0,
    };

    const response = await this.request<unknown>(
      `/bill/${congress}/${type}/${number}/actions`,
      params
    );
    const parsed = BillActionsResponseSchema.parse(response);

    const nextOffset = parsed.pagination?.next
      ? (options.offset ?? 0) + (options.limit ?? 250)
      : null;

    return { actions: parsed.actions, nextOffset };
  }

  /**
   * Gets cosponsors for a specific bill.
   */
  async getBillCosponsors(
    congress: number,
    type: CongressBillType,
    number: number,
    options: PaginationOptions = {}
  ): Promise<{ cosponsors: BillCosponsor[]; nextOffset: number | null }> {
    const params = {
      limit: options.limit ?? 250,
      offset: options.offset ?? 0,
    };

    const response = await this.request<unknown>(
      `/bill/${congress}/${type}/${number}/cosponsors`,
      params
    );
    const parsed = BillCosponsorsResponseSchema.parse(response);

    const nextOffset = parsed.pagination?.next
      ? (options.offset ?? 0) + (options.limit ?? 250)
      : null;

    return { cosponsors: parsed.cosponsors, nextOffset };
  }

  /**
   * Gets text versions for a specific bill.
   */
  async getBillTextVersions(
    congress: number,
    type: CongressBillType,
    number: number
  ): Promise<BillTextVersion[]> {
    const response = await this.request<unknown>(
      `/bill/${congress}/${type}/${number}/text`
    );
    const parsed = BillTextVersionsResponseSchema.parse(response);
    return parsed.textVersions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Members API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lists members of Congress.
   *
   * @param options Pagination and filtering options
   */
  async getMembers(
    options: MemberListOptions = {}
  ): Promise<{ members: MemberListItem[]; nextOffset: number | null }> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    };

    if (options.currentMember !== undefined) {
      params.currentMember = options.currentMember;
    }
    if (options.fromDateTime) {
      params.fromDateTime = options.fromDateTime.toISOString();
    }
    if (options.toDateTime) {
      params.toDateTime = options.toDateTime.toISOString();
    }

    const response = await this.request<unknown>('/member', params);
    const parsed = MemberListResponseSchema.parse(response);

    const nextOffset = parsed.pagination?.next
      ? (options.offset ?? 0) + (options.limit ?? 20)
      : null;

    return { members: parsed.members, nextOffset };
  }

  /**
   * Async generator for iterating through all members.
   */
  async *listMembers(
    options: Omit<MemberListOptions, 'offset'> = {}
  ): AsyncGenerator<MemberListItem, void, unknown> {
    let offset = 0;
    const limit = options.limit ?? 250;

    while (true) {
      const { members, nextOffset } = await this.getMembers({
        ...options,
        limit,
        offset,
      });

      for (const member of members) {
        yield member;
      }

      if (nextOffset === null || members.length === 0) {
        break;
      }

      offset = nextOffset;
    }
  }

  /**
   * Gets detailed information about a specific member.
   *
   * @param bioguideId Member's Bioguide ID
   */
  async getMemberDetail(bioguideId: string): Promise<MemberDetail> {
    const response = await this.request<unknown>(`/member/${bioguideId}`);
    const parsed = MemberDetailResponseSchema.parse(response);
    return parsed.member;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Committees API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lists committees.
   *
   * @param options Pagination options
   */
  async getCommittees(
    options: PaginationOptions = {}
  ): Promise<{ committees: CommitteeListItem[]; nextOffset: number | null }> {
    const params = {
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    };

    const response = await this.request<unknown>('/committee', params);
    const parsed = CommitteeListResponseSchema.parse(response);

    const nextOffset = parsed.pagination?.next
      ? (options.offset ?? 0) + (options.limit ?? 20)
      : null;

    return { committees: parsed.committees, nextOffset };
  }

  /**
   * Async generator for iterating through all committees.
   */
  async *listCommittees(
    options: Omit<PaginationOptions, 'offset'> = {}
  ): AsyncGenerator<CommitteeListItem, void, unknown> {
    let offset = 0;
    const limit = options.limit ?? 250;

    while (true) {
      const { committees, nextOffset } = await this.getCommittees({
        ...options,
        limit,
        offset,
      });

      for (const committee of committees) {
        yield committee;
      }

      if (nextOffset === null || committees.length === 0) {
        break;
      }

      offset = nextOffset;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Gets the current rate limiter statistics.
   */
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Checks if the API is accessible.
   * @returns true if the API responds successfully
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get a single bill from the most recent congress
      await this.getBills(118, { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let congressClient: CongressApiClient | null = null;

/**
 * Gets the singleton Congress API client.
 */
export function getCongressClient(): CongressApiClient {
  if (!congressClient) {
    congressClient = new CongressApiClient();
  }
  return congressClient;
}

/**
 * Resets the singleton client (for testing).
 */
export function resetCongressClient(): void {
  congressClient = null;
}
