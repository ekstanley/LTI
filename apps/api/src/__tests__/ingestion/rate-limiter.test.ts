/**
 * Rate Limiter Unit Tests
 *
 * Tests for the token bucket rate limiter implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TokenBucketRateLimiter,
  getCongressApiLimiter,
  resetCongressApiLimiter,
} from '../../ingestion/rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCongressApiLimiter();
  });

  describe('constructor', () => {
    it('initializes with correct default tokens', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
      });

      const stats = limiter.getStats();
      expect(stats.currentTokens).toBe(100);
      expect(stats.maxTokens).toBe(100);
    });

    it('initializes with custom initial tokens', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
        initialTokens: 50,
      });

      const stats = limiter.getStats();
      expect(stats.currentTokens).toBe(50);
    });
  });

  describe('tryAcquire', () => {
    it('returns true when tokens available', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 10,
        refillRatePerHour: 1000,
      });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.getStats().currentTokens).toBe(9);
    });

    it('returns false when no tokens available', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 1,
        refillRatePerHour: 1000,
        initialTokens: 0,
      });

      expect(limiter.tryAcquire()).toBe(false);
    });

    it('increments request counter', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 10,
        refillRatePerHour: 1000,
      });

      limiter.tryAcquire();
      limiter.tryAcquire();

      expect(limiter.getStats().requestsThisHour).toBe(2);
    });
  });

  describe('acquire', () => {
    it('resolves immediately when tokens available', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 10,
        refillRatePerHour: 1000,
      });

      await limiter.acquire();
      expect(limiter.getStats().currentTokens).toBe(9);
    });

    it('throws when wait time exceeds timeout', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 1,
        refillRatePerHour: 1, // Very slow refill
        initialTokens: 0,
      });

      await expect(limiter.acquire(100)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('waits and acquires when tokens refill', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 10,
        refillRatePerHour: 36000000, // 10000 per second for testing
        initialTokens: 0,
      });

      const acquirePromise = limiter.acquire(5000);

      // Advance time to refill tokens
      vi.advanceTimersByTime(1000);

      await expect(acquirePromise).resolves.toBeUndefined();
    });
  });

  describe('refill', () => {
    it('refills tokens over time', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 3600000, // 1000 per second
        initialTokens: 0,
      });

      // Advance 1 second
      vi.advanceTimersByTime(1000);

      const stats = limiter.getStats();
      expect(stats.currentTokens).toBeGreaterThan(0);
    });

    it('caps tokens at maxTokens', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 3600000,
        initialTokens: 99,
      });

      // Advance significant time
      vi.advanceTimersByTime(10000);

      const stats = limiter.getStats();
      expect(stats.currentTokens).toBeLessThanOrEqual(100);
    });

    it('resets hourly counter after an hour', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
      });

      // Make some requests
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.getStats().requestsThisHour).toBe(2);

      // Advance past 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Trigger refill by getting stats
      const stats = limiter.getStats();
      expect(stats.requestsThisHour).toBe(0);
    });
  });

  describe('reset', () => {
    it('resets tokens to max', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
        initialTokens: 10,
      });

      limiter.reset();

      expect(limiter.getStats().currentTokens).toBe(100);
    });

    it('resets request counter', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
      });

      limiter.tryAcquire();
      limiter.reset();

      expect(limiter.getStats().requestsThisHour).toBe(0);
    });

    it('clears waiting queue', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 1,
        refillRatePerHour: 3600, // 1 token per second - wait time ~1000ms
        initialTokens: 0,
      });

      // Use timeout longer than wait time so request gets queued
      // Note: acquire() adds to queue synchronously in Promise constructor
      const acquirePromise = limiter.acquire(60000);

      // Reset should reject the waiting promise
      limiter.reset();

      await expect(acquirePromise).rejects.toThrow('Rate limiter reset');
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokens: 100,
        refillRatePerHour: 1000,
        initialTokens: 50,
      });

      limiter.tryAcquire();

      const stats = limiter.getStats();
      expect(stats).toEqual({
        currentTokens: 49,
        maxTokens: 100,
        refillRatePerHour: 1000,
        requestsThisHour: 1,
        waitingRequests: 0,
      });
    });
  });

  describe('getCongressApiLimiter', () => {
    it('returns singleton instance', () => {
      const limiter1 = getCongressApiLimiter();
      const limiter2 = getCongressApiLimiter();

      expect(limiter1).toBe(limiter2);
    });

    it('has correct Congress.gov configuration', () => {
      const limiter = getCongressApiLimiter();
      const stats = limiter.getStats();

      expect(stats.maxTokens).toBe(100);
      expect(stats.refillRatePerHour).toBe(1000);
    });
  });
});
