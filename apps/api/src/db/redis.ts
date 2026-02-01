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

import { Redis } from 'ioredis';
import { config } from '../config.js';
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
 * Redis cache implementation using ioredis.
 * Provides production-grade caching with automatic reconnection.
 */
class RedisCache {
  private client: Redis;
  private isConnected = false;

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      logger.error({ err: err.message }, 'Redis error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  async connect(): Promise<boolean> {
    try {
      await this.client.connect();
      return this.isConnected;
    } catch (err) {
      logger.warn('Redis connection failed, will use memory fallback');
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.setex(key, DEFAULT_TTL.CACHE, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  disconnect(): void {
    this.client.disconnect();
    this.isConnected = false;
  }

  getStatus(): boolean {
    return this.isConnected;
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
let redisInstance: RedisCache | null = null;
let cacheType: 'redis' | 'memory' = 'memory';

/**
 * Initialize Redis connection. Falls back to memory cache if Redis unavailable.
 * Call this during application startup for async Redis connection.
 */
export async function initializeCache(): Promise<void> {
  if (cacheClient) return;

  // Try Redis if URL is configured
  if (config.redisUrl) {
    try {
      redisInstance = new RedisCache(config.redisUrl);
      const connected = await redisInstance.connect();
      if (connected) {
        cacheClient = redisInstance;
        cacheType = 'redis';
        logger.info('Cache initialized with Redis');
        return;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis initialization failed');
    }
  }

  // Fallback to memory cache
  logger.info('Using in-memory cache (Redis not available)');
  cacheClient = new MemoryCache();
  cacheType = 'memory';
}

/**
 * Get or create cache client (Redis or Memory fallback)
 * Note: For async Redis initialization, call initializeCache() first during startup.
 */
export function getCache(): CacheClient {
  if (cacheClient) return cacheClient;

  // Synchronous fallback - memory cache only (for code that doesn't await init)
  logger.info('Using in-memory cache (call initializeCache() for Redis support)');
  cacheClient = new MemoryCache();
  cacheType = 'memory';

  return cacheClient;
}

/**
 * Get the current cache type
 */
export function getCacheType(): 'redis' | 'memory' {
  return cacheType;
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
