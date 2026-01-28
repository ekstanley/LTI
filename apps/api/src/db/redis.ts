/**
 * Redis Client with Namespace Support
 *
 * Provides Redis connectivity with key namespacing for:
 * - cache:* - General caching
 * - session:* - User sessions
 * - rate:* - Rate limiting data
 * - search:* - Search result caching
 *
 * Uses ioredis for connection management with automatic reconnection.
 */

import { logger } from '../lib/logger.js';

// Redis key namespaces for cost-efficient single-instance usage
export const REDIS_NAMESPACES = {
  CACHE: 'cache',
  SESSION: 'session',
  RATE: 'rate',
  SEARCH: 'search',
  QUEUE: 'queue',
} as const;

export type RedisNamespace = (typeof REDIS_NAMESPACES)[keyof typeof REDIS_NAMESPACES];

// Default TTL values (in seconds)
export const DEFAULT_TTL = {
  CACHE: 300,           // 5 minutes for general cache
  SEARCH: 60,           // 1 minute for search results
  SESSION: 86400,       // 24 hours for sessions
  RATE: 60,             // 1 minute for rate limiting windows
  BILL_DETAIL: 3600,    // 1 hour for bill details
  LEGISLATOR: 3600,     // 1 hour for legislator data
  VOTE: 1800,           // 30 minutes for vote data
} as const;

/**
 * In-memory cache fallback when Redis is not available.
 * Used for development and testing without Redis.
 */
class MemoryCache {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds ?? DEFAULT_TTL.CACHE) * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  async flushAll(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  disconnect(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Cache interface for Redis or Memory fallback
 */
interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flushAll(): Promise<void>;
  disconnect(): void;
}

// Singleton cache instance
let cacheClient: CacheClient | null = null;

/**
 * Get or create cache client (Redis or Memory fallback)
 */
export function getCache(): CacheClient {
  if (cacheClient) return cacheClient;

  // Use memory cache for now (Redis will be connected when available)
  logger.info('Using in-memory cache (Redis not configured)');
  cacheClient = new MemoryCache();

  return cacheClient;
}

/**
 * Build namespaced cache key
 */
export function buildCacheKey(namespace: RedisNamespace, ...parts: string[]): string {
  return `${namespace}:${parts.join(':')}`;
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getCache();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  /**
   * Set cached value with automatic JSON serialization
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = getCache();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await client.set(key, serialized, ttlSeconds);
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    const client = getCache();
    await client.del(key);
  },

  /**
   * Invalidate all keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const client = getCache();
    const keys = await client.keys(pattern);
    for (const key of keys) {
      await client.del(key);
    }
    return keys.length;
  },

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await cache.set(key, value, ttlSeconds);
    return value;
  },
};

/**
 * Disconnect cache client
 */
export function disconnectCache(): void {
  if (cacheClient) {
    cacheClient.disconnect();
    cacheClient = null;
    logger.info('Cache disconnected');
  }
}

/**
 * Health check for cache connection
 */
export async function checkCacheHealth(): Promise<boolean> {
  try {
    const client = getCache();
    const testKey = 'health:check';
    await client.set(testKey, 'ok', 10);
    const result = await client.get(testKey);
    return result === 'ok';
  } catch {
    return false;
  }
}
