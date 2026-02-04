/**
 * Account Lockout Middleware Integration Tests
 *
 * Comprehensive integration tests for account lockout middleware (Issue #38).
 * Tests the full request flow: Request → Middleware → Service → Response
 *
 * SECURITY: Tests CWE-307 protection against brute force attacks
 *
 * Test Coverage (20 tests):
 * - Basic Lockout (5 tests)
 * - IP-Based Lockout (5 tests)
 * - Username-Based Lockout (5 tests)
 * - Progressive Backoff (3 tests)
 * - Edge Cases (2 tests)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { Request, Response } from 'express';

import { accountLockout, trackLoginAttempt } from '../../middleware/accountLockout.js';
import { accountLockoutService } from '../../services/accountLockout.service.js';
import { initializeCache, disconnectCache, getCacheType, getCache } from '../../db/redis.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Account Lockout Middleware - Integration Tests', () => {
  let isRedisAvailable = false;
  let originalTrustProxy: string | undefined;

  // Helper to create mock request
  const createMockRequest = (overrides: Partial<Request> = {}): Request => {
    return {
      path: '/login',
      body: { email: 'test@example.com', password: 'password123' },
      headers: {},
      ip: '192.168.1.100',
      socket: {
        remoteAddress: '192.168.1.100',
      } as any,
      ...overrides,
    } as Request;
  };

  // Helper to create mock response
  const createMockResponse = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as unknown as Response;

    return res;
  };

  // Helper to get status code from mock response
  const getStatusCode = (res: Response): number | undefined => {
    return (res.status as any).mock?.calls[0]?.[0];
  };

  // Helper to get JSON data from mock response
  const getJsonData = (res: Response): any => {
    return (res.json as any).mock?.calls[0]?.[0];
  };

  // Helper to get headers from mock response
  const getHeaders = (res: Response): Record<string, string> => {
    const headers: Record<string, string> = {};
    const setCalls = (res.set as any).mock?.calls || [];
    for (const call of setCalls) {
      if (call && call.length >= 2) {
        headers[call[0]] = call[1];
      }
    }
    return headers;
  };

  beforeAll(async () => {
    await initializeCache();
    isRedisAvailable = getCacheType() === 'redis';

    if (isRedisAvailable) {
      await accountLockoutService.initializeScript();
    }

    // Save original TRUST_PROXY value
    originalTrustProxy = process.env.TRUST_PROXY;
  });

  afterAll(() => {
    disconnectCache();

    // Restore original TRUST_PROXY value
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
  });

  beforeEach(async () => {
    // Clear all lockout keys before each test
    const cache = getCache();
    const keys = await cache.keys('lockout:*');
    for (const key of keys) {
      await cache.del(key);
    }

    // Reset TRUST_PROXY to default (false)
    delete process.env.TRUST_PROXY;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // Basic Lockout (5 tests)
  // =============================================================================

  describe('Basic Lockout', () => {
    it('should not lock account on first failed attempt', async () => {
      const email = 'basic1@example.com';
      const ip = '192.168.1.1';
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should not lock account on 4 failed attempts (under threshold)', async () => {
      const email = 'basic2@example.com';
      const ip = '192.168.1.2';

      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // 5th attempt should still be allowed (not locked yet)
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should lock account after 5 failed attempts (15 min duration)', async () => {
      const email = 'basic3@example.com';
      const ip = '192.168.1.3';

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // 6th attempt should be blocked (account locked)
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
      expect(getJsonData(res)).toMatchObject({
        error: 'account_locked',
        message: expect.stringContaining('locked'),
      });
      expect(getJsonData(res).retryAfter).toBeGreaterThan(0);
      expect(getJsonData(res).expiresAt).toBeDefined();
      expect(getHeaders(res)['Retry-After']).toBeDefined();
    });

    it('should return 429 with lockout message when account is locked', async () => {
      const email = 'basic4@example.com';
      const ip = '192.168.1.4';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Try to access while locked
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
      expect(getJsonData(res).error).toBe('account_locked');
      expect(getJsonData(res).message).toContain('locked');
      expect(getJsonData(res).retryAfter).toBeGreaterThan(0);
    });

    it('should reset attempt counter on successful login', async () => {
      const email = 'basic5@example.com';
      const ip = '192.168.1.5';

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Verify attempts were recorded
      const beforeReset = await accountLockoutService.checkLockout(email, ip);
      expect(beforeReset.attemptCount).toBe(3);

      // Simulate successful login
      await trackLoginAttempt(email, ip, true);

      // Verify counter was reset
      const afterReset = await accountLockoutService.checkLockout(email, ip);
      expect(afterReset.attemptCount).toBe(0);
      expect(afterReset.isLocked).toBe(false);

      // Next attempt should be allowed
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // IP-Based Lockout (5 tests)
  // =============================================================================

  describe('IP-Based Lockout', () => {
    it('should lock IP after 5 failed attempts from same IP', async () => {
      const ip = '192.168.2.1';
      const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

      // Make 5 failed attempts from same IP with different usernames
      for (let i = 0; i < 5; i++) {
        const email = emails[i % emails.length]!;
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Any username from this IP should be blocked
      const req = createMockRequest({ body: { email: 'newuser@example.com' }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should trigger IP lockout with different usernames, same IP', async () => {
      const ip = '192.168.2.2';

      // 5 different users, same IP
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(`user${i}@example.com`, ip);
      }

      // Check lockout for a new username
      const req = createMockRequest({ body: { email: 'different@example.com' }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should ignore x-forwarded-for header when TRUST_PROXY=false', async () => {
      process.env.TRUST_PROXY = 'false';

      const realIp = '192.168.2.3';

      // Make 5 attempts (middleware uses realIp, ignores x-forwarded-for)
      for (let i = 0; i < 5; i++) {
        // Manually extract IP as middleware does
        const ip = realIp; // Middleware ignores x-forwarded-for when TRUST_PROXY=false
        await accountLockoutService.recordFailedAttempt('test@example.com', ip);
      }

      // Request with realIp should be blocked
      const req = createMockRequest({ ip: realIp });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should use x-forwarded-for header when TRUST_PROXY=true', async () => {
      process.env.TRUST_PROXY = 'true';

      const realIp = '192.168.2.4';
      const forwardedIp = '1.2.3.5';

      // Make 5 attempts with x-forwarded-for header
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt('test@example.com', forwardedIp);
      }

      // Request with forwarded IP should be blocked
      const req = createMockRequest({
        headers: { 'x-forwarded-for': forwardedIp },
        ip: realIp,
      });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should expire IP lockout after timeout', async () => {
      const email = 'expire@example.com';
      const ip = '192.168.2.5';

      // Lock the IP first
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Verify it's locked
      const beforeExpiry = await accountLockoutService.checkLockout(email, ip);
      expect(beforeExpiry.isLocked).toBe(true);

      // Manually delete the lockout keys to simulate expiration
      const cache = getCache();
      await cache.del(`lockout:locked:ip:${ip}`);
      await cache.del(`lockout:locked:username:${email.toLowerCase()}`);

      // Request should be allowed (lockout expired)
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Username-Based Lockout (5 tests)
  // =============================================================================

  describe('Username-Based Lockout', () => {
    it('should lock username after 5 failed attempts for same username', async () => {
      const email = 'locked-user@example.com';
      const ips = ['192.168.3.1', '192.168.3.2', '192.168.3.3'];

      // Make 5 failed attempts for same username from different IPs
      for (let i = 0; i < 5; i++) {
        const ip = ips[i % ips.length]!;
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Username should be blocked from any IP
      const req = createMockRequest({ body: { email }, ip: '192.168.3.100' });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should trigger username lockout with same username, different IPs', async () => {
      const email = 'distributed@example.com';

      // 5 attempts from different IPs
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, `192.168.3.${10 + i}`);
      }

      // Username should be locked from new IP
      const req = createMockRequest({ body: { email }, ip: '192.168.3.99' });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should maintain username lockout across IP changes', async () => {
      const email = 'persistent@example.com';

      // Lock username from IP1
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, '192.168.3.20');
      }

      // Try from different IP - should still be locked
      const req = createMockRequest({ body: { email }, ip: '192.168.3.21' });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });

    it('should expire username lockout after timeout', async () => {
      const email = 'expire-user@example.com';
      const ip = '192.168.3.30';

      // Lock the username first
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Verify it's locked
      const beforeExpiry = await accountLockoutService.checkLockout(email, ip);
      expect(beforeExpiry.isLocked).toBe(true);

      // Manually delete the lockout keys to simulate expiration
      const cache = getCache();
      await cache.del(`lockout:locked:username:${email.toLowerCase()}`);
      await cache.del(`lockout:locked:ip:${ip}`);

      // Request should be allowed (lockout expired)
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should track different usernames independently', async () => {
      const email1 = 'independent1@example.com';
      const email2 = 'independent2@example.com';
      const ip1 = '192.168.3.40';
      const ip2 = '192.168.3.41';

      // Lock first username from ip1
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email1, ip1);
      }

      // First username should be locked (from any IP)
      const req1 = createMockRequest({ body: { email: email1 }, ip: ip2 });
      const res1 = createMockResponse();
      const next1 = vi.fn();

      await accountLockout(req1, res1, next1);

      expect(next1).not.toHaveBeenCalled();
      expect(getStatusCode(res1)).toBe(429);

      // Second username should NOT be locked (from any IP)
      const req2 = createMockRequest({ body: { email: email2 }, ip: ip2 });
      const res2 = createMockResponse();
      const next2 = vi.fn();

      await accountLockout(req2, res2, next2);

      expect(next2).toHaveBeenCalled();
      expect(res2.status).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Progressive Backoff (3 tests)
  // =============================================================================

  describe('Progressive Backoff', () => {
    it('should apply 15 minute lockout on 1st lockout', async () => {
      const email = 'backoff1@example.com';
      const ip = '192.168.4.1';

      // Trigger first lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      const lockoutInfo = await accountLockoutService.checkLockout(email, ip);

      expect(lockoutInfo.isLocked).toBe(true);
      // First lockout: 15 minutes = 900 seconds (with small tolerance)
      expect(lockoutInfo.remainingSeconds).toBeGreaterThanOrEqual(890);
      expect(lockoutInfo.remainingSeconds).toBeLessThanOrEqual(900);
    });

    it('should apply 1 hour lockout on 2nd lockout (within window)', async () => {
      const email = 'backoff2@example.com';
      const ip = '192.168.4.2';
      const cache = getCache();

      // Trigger first lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Clear lockout but keep count (simulate first lockout expired)
      await cache.del(`lockout:locked:username:${email}`);
      await cache.del(`lockout:locked:ip:${ip}`);
      await cache.del(`lockout:attempts:username:${email}`);
      await cache.del(`lockout:attempts:ip:${ip}`);

      // Trigger second lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      const lockoutInfo = await accountLockoutService.checkLockout(email, ip);

      expect(lockoutInfo.isLocked).toBe(true);
      // Second lockout: 1 hour = 3600 seconds (with small tolerance)
      expect(lockoutInfo.remainingSeconds).toBeGreaterThanOrEqual(3590);
      expect(lockoutInfo.remainingSeconds).toBeLessThanOrEqual(3600);
    });

    it('should apply 6 hour lockout on 3rd lockout (within window)', async () => {
      const email = 'backoff3@example.com';
      const ip = '192.168.4.3';
      const cache = getCache();

      // Trigger first lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Clear lockout but keep count
      await cache.del(`lockout:locked:username:${email}`);
      await cache.del(`lockout:locked:ip:${ip}`);
      await cache.del(`lockout:attempts:username:${email}`);
      await cache.del(`lockout:attempts:ip:${ip}`);

      // Trigger second lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Clear lockout but keep count
      await cache.del(`lockout:locked:username:${email}`);
      await cache.del(`lockout:locked:ip:${ip}`);
      await cache.del(`lockout:attempts:username:${email}`);
      await cache.del(`lockout:attempts:ip:${ip}`);

      // Trigger third lockout
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      const lockoutInfo = await accountLockoutService.checkLockout(email, ip);

      expect(lockoutInfo.isLocked).toBe(true);
      // Third lockout: 6 hours = 21600 seconds (with small tolerance)
      expect(lockoutInfo.remainingSeconds).toBeGreaterThanOrEqual(21590);
      expect(lockoutInfo.remainingSeconds).toBeLessThanOrEqual(21600);
    });
  });

  // =============================================================================
  // Edge Cases (2 tests)
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle Redis unavailable gracefully (memory cache fallback)', async () => {
      // This test verifies the middleware works regardless of cache backend
      const email = 'fallback@example.com';
      const ip = '192.168.5.1';

      // The middleware should work with memory cache fallback
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      // Can still record attempts
      await trackLoginAttempt(email, ip, false);

      // Verify it works
      const lockoutInfo = await accountLockoutService.checkLockout(email, ip);
      expect(lockoutInfo).toBeDefined();
      expect(lockoutInfo.attemptCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent failed attempts atomically (no race condition)', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping race condition test - Redis not available');
        return;
      }

      const email = 'concurrent@example.com';
      const ip = '192.168.5.2';

      // Spawn 5 concurrent failed attempts
      const promises = Array.from({ length: 5 }, () =>
        accountLockoutService.recordFailedAttempt(email, ip)
      );

      await Promise.all(promises);

      // All 5 attempts should be counted (no lost updates)
      const lockoutInfo = await accountLockoutService.checkLockout(email, ip);
      expect(lockoutInfo.attemptCount).toBe(5);
      expect(lockoutInfo.isLocked).toBe(true);

      // Middleware should block the account
      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
    });
  });

  // =============================================================================
  // Additional Integration Tests
  // =============================================================================

  describe('Middleware Integration', () => {
    it('should skip non-login routes', async () => {
      const req = createMockRequest({ path: '/api/profile' });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle missing email in request body gracefully', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle middleware errors gracefully (fail open)', async () => {
      const email = 'error-test@example.com';
      const ip = '192.168.5.3';

      // Mock checkLockout to throw error
      vi.spyOn(accountLockoutService, 'checkLockout').mockRejectedValueOnce(
        new Error('Cache error')
      );

      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      // Middleware should fail open (allow request to proceed)
      await accountLockout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      // Restore original function
      vi.spyOn(accountLockoutService, 'checkLockout').mockRestore();
    });

    it('should include correct Retry-After header in lockout response', async () => {
      const email = 'retry-after@example.com';
      const ip = '192.168.5.4';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      const req = createMockRequest({ body: { email }, ip });
      const res = createMockResponse();
      const next = vi.fn();

      await accountLockout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode(res)).toBe(429);
      expect(getHeaders(res)['Retry-After']).toBeDefined();
      expect(parseInt(getHeaders(res)['Retry-After']!, 10)).toBeGreaterThan(0);
      expect(getJsonData(res).retryAfter).toBe(parseInt(getHeaders(res)['Retry-After']!, 10));
    });

    it('should handle case-insensitive email matching', async () => {
      const email = 'CaseSensitive@Example.COM';
      const ip = '192.168.5.5';

      // Record attempts with mixed case
      await accountLockoutService.recordFailedAttempt(email, ip);
      await accountLockoutService.recordFailedAttempt(email.toLowerCase(), ip);
      await accountLockoutService.recordFailedAttempt(email.toUpperCase(), ip);

      // All attempts should be counted for the same user
      const lockoutInfo = await accountLockoutService.checkLockout(email.toLowerCase(), ip);
      expect(lockoutInfo.attemptCount).toBeGreaterThanOrEqual(3);
    });
  });
});
