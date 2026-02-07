/**
 * MemoryCache LRU Eviction Tests
 *
 * Validates the bounded in-memory cache fallback:
 * - Size never exceeds maxEntries (prevents unbounded growth / OOM)
 * - LRU eviction order: oldest-accessed entry evicted first
 * - get() promotes entry to most-recently-used position
 * - Expired entries are not returned and are cleaned up
 * - Metrics (hits, misses, evictions) are accurate
 * - Existing key update refreshes order without growing size
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getCache,
  disconnectCache,
  getCacheMetrics,
  cache,
} from '../../db/redis.js';

// Mock config to use a small maxEntries for testability
vi.mock('../../config.js', () => ({
  config: {
    redis: {
      url: '', // Empty URL forces MemoryCache fallback
      maxRetriesPerRequest: 3,
      retryMaxAttempts: 10,
      retryMaxDelayMs: 3000,
    },
    cache: {
      maxEntries: 5, // Small bound for test assertions
    },
  },
}));

// Mock logger to suppress output during tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MemoryCache (LRU bounded)', () => {
  beforeEach(() => {
    // Ensure clean state: disconnect any prior cache instance
    disconnectCache();
    // Use fake timers for cleanup interval control
    vi.useFakeTimers();
  });

  afterEach(() => {
    disconnectCache();
    vi.useRealTimers();
  });

  describe('size bound and eviction', () => {
    it('should never exceed maxEntries', async () => {
      const client = getCache();

      // Insert 8 entries into a cache with maxEntries=5
      for (let i = 0; i < 8; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.size).toBeLessThanOrEqual(5);
      expect(metrics!.maxEntries).toBe(5);
    });

    it('should evict LRU entries (oldest inserted first)', async () => {
      const client = getCache();

      // Fill to capacity: key:0 through key:4
      for (let i = 0; i < 5; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      // Insert one more -- key:0 (oldest) should be evicted
      await client.set('key:5', 'value:5', 300);

      // key:0 evicted (LRU)
      const evicted = await client.get('key:0');
      expect(evicted).toBeNull();

      // key:5 present (newest)
      const newest = await client.get('key:5');
      expect(newest).toBe('value:5');

      // key:1 still present (second oldest, but not evicted yet)
      const secondOldest = await client.get('key:1');
      expect(secondOldest).toBe('value:1');
    });

    it('should count evictions in metrics', async () => {
      const client = getCache();

      // Fill to capacity
      for (let i = 0; i < 5; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      // Trigger 3 evictions
      for (let i = 5; i < 8; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.evictions).toBe(3);
      expect(metrics!.size).toBe(5);
    });
  });

  describe('LRU promotion via get()', () => {
    it('should promote accessed entry to MRU position', async () => {
      const client = getCache();

      // Insert key:0 through key:4
      for (let i = 0; i < 5; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      // Access key:0 -- promotes it to most-recently-used
      await client.get('key:0');

      // Insert key:5 -- should evict key:1 (now the LRU), not key:0
      await client.set('key:5', 'value:5', 300);

      // key:0 survived (was promoted by get)
      const promoted = await client.get('key:0');
      expect(promoted).toBe('value:0');

      // key:1 evicted (was LRU after key:0 was promoted)
      const evicted = await client.get('key:1');
      expect(evicted).toBeNull();
    });
  });

  describe('existing key update', () => {
    it('should refresh insertion order without growing size', async () => {
      const client = getCache();

      // Fill to capacity
      for (let i = 0; i < 5; i++) {
        await client.set(`key:${i}`, `value:${i}`, 300);
      }

      // Update key:0 with new value -- should refresh its position
      await client.set('key:0', 'updated:0', 300);

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      // Size unchanged: update doesn't grow the map
      expect(metrics!.size).toBe(5);
      // No evictions: updating existing key doesn't trigger eviction
      expect(metrics!.evictions).toBe(0);

      // key:0 has updated value
      const updated = await client.get('key:0');
      expect(updated).toBe('updated:0');

      // Insert key:5 -- should evict key:1 (LRU), not key:0 (refreshed)
      await client.set('key:5', 'value:5', 300);

      const evicted = await client.get('key:1');
      expect(evicted).toBeNull();

      const refreshed = await client.get('key:0');
      expect(refreshed).toBe('updated:0');
    });
  });

  describe('expiration', () => {
    it('should return null for expired entries', async () => {
      const client = getCache();

      // Set with 1 second TTL
      await client.set('expiring', 'value', 1);

      // Advance past expiration
      vi.advanceTimersByTime(1500);

      const result = await client.get('expiring');
      expect(result).toBeNull();
    });

    it('should count expired get as a miss', async () => {
      const client = getCache();

      await client.set('expiring', 'value', 1);

      // First get: hit
      await client.get('expiring');

      // Advance past expiration
      vi.advanceTimersByTime(1500);

      // Second get: miss (expired)
      await client.get('expiring');

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.hits).toBe(1);
      expect(metrics!.misses).toBe(1);
    });

    it('should clean up expired entries on periodic cleanup', async () => {
      const client = getCache();

      // Insert entries with short TTL
      await client.set('short:1', 'v1', 30);
      await client.set('short:2', 'v2', 30);
      await client.set('long:1', 'v3', 600);

      // Advance past short TTL but not long
      vi.advanceTimersByTime(31_000);

      // Trigger cleanup interval (every 60s)
      vi.advanceTimersByTime(30_000); // Total: 61s

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      // Only the long-TTL entry remains
      expect(metrics!.size).toBe(1);
    });
  });

  describe('metrics accuracy', () => {
    it('should track hits and misses correctly', async () => {
      const client = getCache();

      await client.set('exists', 'value', 300);

      // 2 hits
      await client.get('exists');
      await client.get('exists');

      // 3 misses
      await client.get('missing1');
      await client.get('missing2');
      await client.get('missing3');

      const metrics = getCacheMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.hits).toBe(2);
      expect(metrics!.misses).toBe(3);
    });

    it('should report correct size after operations', async () => {
      const client = getCache();

      await client.set('a', '1', 300);
      await client.set('b', '2', 300);
      await client.set('c', '3', 300);

      expect(getCacheMetrics()!.size).toBe(3);

      await client.del('b');

      expect(getCacheMetrics()!.size).toBe(2);

      await client.flushAll();

      expect(getCacheMetrics()!.size).toBe(0);
    });
  });

  describe('cache helper (JSON serialization)', () => {
    it('should serialize and deserialize objects via cache.get/set', async () => {
      // Force MemoryCache by calling getCache() (config has empty Redis URL)
      getCache();

      const obj = { name: 'test', count: 42, nested: { ok: true } };
      await cache.set('json:test', obj, 300);

      const result = await cache.get<typeof obj>('json:test');
      expect(result).toEqual(obj);
    });

    it('should return null for missing keys', async () => {
      getCache();

      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('keys pattern matching', () => {
    it('should return keys matching glob pattern', async () => {
      const client = getCache();

      await client.set('cache:bills:1', 'v1', 300);
      await client.set('cache:bills:2', 'v2', 300);
      await client.set('cache:votes:1', 'v3', 300);
      await client.set('session:abc', 'v4', 300);

      const billKeys = await client.keys('cache:bills:*');
      expect(billKeys).toHaveLength(2);
      expect(billKeys).toContain('cache:bills:1');
      expect(billKeys).toContain('cache:bills:2');
    });
  });

  describe('default TTL', () => {
    it('should use DEFAULT_TTL.CACHE when no TTL specified', async () => {
      const client = getCache();

      await client.set('no-ttl', 'value');

      // Entry exists before default TTL expires
      const before = await client.get('no-ttl');
      expect(before).toBe('value');

      // Advance past DEFAULT_TTL.CACHE (300s)
      vi.advanceTimersByTime(301_000);

      const after = await client.get('no-ttl');
      expect(after).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear all entries and stop cleanup interval', () => {
      const client = getCache();
      // Populate
      client.set('a', '1', 300);

      disconnectCache();

      // getCacheMetrics returns null after disconnect (cacheClient is null)
      expect(getCacheMetrics()).toBeNull();
    });
  });
});
