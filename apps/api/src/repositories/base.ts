/**
 * Base Repository
 *
 * Provides common patterns for all repositories including:
 * - Pagination helpers
 * - Cache integration
 * - Error handling
 * - Type-safe query building
 */

import { cache, buildCacheKey, DEFAULT_TTL, REDIS_NAMESPACES } from '../db/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Cursor-based pagination response
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Parse and validate pagination parameters
 */
export function parsePagination(params: PaginationParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build paginated response
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Base repository class with caching support
 */
export abstract class BaseRepository {
  protected readonly cacheNamespace: string;
  protected readonly defaultTtl: number;

  constructor(cacheNamespace: string, defaultTtl: number = DEFAULT_TTL.CACHE) {
    this.cacheNamespace = cacheNamespace;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Build a cache key for this repository
   */
  protected buildKey(...parts: string[]): string {
    return buildCacheKey(REDIS_NAMESPACES.CACHE, this.cacheNamespace, ...parts);
  }

  /**
   * Get cached data or fetch from database
   */
  protected async cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cacheKey = this.buildKey(key);

    try {
      return await cache.getOrSet(cacheKey, fetcher, ttl ?? this.defaultTtl);
    } catch (error) {
      logger.warn({ error, key: cacheKey }, 'Cache error, falling back to database');
      return fetcher();
    }
  }

  /**
   * Invalidate cache for specific key
   */
  protected async invalidate(key: string): Promise<void> {
    const cacheKey = this.buildKey(key);
    await cache.del(cacheKey);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  protected async invalidatePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    return cache.invalidatePattern(fullPattern);
  }

  /**
   * Log repository operation
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    operation: string,
    data?: Record<string, unknown>
  ): void {
    logger[level]({ repository: this.cacheNamespace, operation, ...data });
  }
}

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Generic sort parameter
 */
export interface SortParams<T extends string = string> {
  field: T;
  direction: SortDirection;
}

/**
 * Build Prisma orderBy from sort params
 */
export function buildOrderBy<T extends string>(
  sort: SortParams<T> | undefined,
  defaultSort: SortParams<T>
): Record<string, 'asc' | 'desc'> {
  const { field, direction } = sort ?? defaultSort;
  return { [field]: direction };
}
