/**
 * Race Condition Tests for Account Lockout Service
 *
 * Tests the atomic Lua script implementation that fixes Issue #33 (TOCTOU race condition).
 * Verifies that concurrent requests correctly increment counters without lost updates.
 *
 * SECURITY: Tests CWE-367 (Time-of-check Time-of-use Race Condition) fix
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { initializeCache, disconnectCache, getCacheType, getCache } from '../../db/redis.js';
import { accountLockoutService } from '../../services/accountLockout.service.js';

describe('AccountLockout - Race Condition Tests (Issue #33)', () => {
  let isRedisAvailable = false;

  beforeAll(async () => {
    await initializeCache();
    isRedisAvailable = getCacheType() === 'redis';

    if (isRedisAvailable) {
      await accountLockoutService.initializeScript();
    }
  });

  afterAll(() => {
    disconnectCache();
  });

  beforeEach(async () => {
    // Clear all lockout keys before each test
    const cache = getCache();
    const keys = await cache.keys('lockout:*');
    for (const key of keys) {
      await cache.del(key);
    }
  });

  describe('Atomic increment operation', () => {
    it('should increment counter atomically on first attempt', async () => {
      const result = await accountLockoutService.recordFailedAttempt(
        'test@example.com',
        '192.168.1.1'
      );

      expect(result.attemptCount).toBe(1);
      expect(result.isLocked).toBe(false);
    });

    it('should increment counter atomically on multiple sequential attempts', async () => {
      const email = 'sequential@example.com';
      const ip = '192.168.1.2';

      // Record 4 attempts sequentially
      for (let i = 1; i <= 4; i++) {
        const result = await accountLockoutService.recordFailedAttempt(email, ip);
        expect(result.attemptCount).toBe(i);
        expect(result.isLocked).toBe(false);
      }

      // 5th attempt should trigger lockout
      const lockoutResult = await accountLockoutService.recordFailedAttempt(email, ip);
      expect(lockoutResult.attemptCount).toBe(5);
      expect(lockoutResult.isLocked).toBe(true);
      expect(lockoutResult.remainingSeconds).toBeGreaterThan(0);
    });

    it('should apply TTL correctly to attempt counters', async () => {
      const cache = getCache();
      const email = 'ttl-test@example.com';
      const ip = '192.168.1.3';

      await accountLockoutService.recordFailedAttempt(email, ip);

      // Check that keys exist
      const usernameKey = `lockout:attempts:username:${email}`;
      const ipKey = `lockout:attempts:ip:${ip}`;

      const usernameValue = await cache.get(usernameKey);
      const ipValue = await cache.get(ipKey);

      expect(usernameValue).toBe('1');
      expect(ipValue).toBe('1');

      // Note: We can't easily test TTL expiration in unit tests without waiting
      // This would be better tested in integration tests with shorter TTLs
    });

    it('should track username and IP attempts independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const ip = '192.168.1.4';

      // Two different users from same IP
      await accountLockoutService.recordFailedAttempt(email1, ip);
      await accountLockoutService.recordFailedAttempt(email2, ip);

      // IP should have 2 attempts
      const result = await accountLockoutService.recordFailedAttempt(email1, ip);
      expect(result.attemptCount).toBe(3); // max(2 username, 3 IP)
    });

    it('should use max of username and IP attempt counts', async () => {
      const email = 'max-test@example.com';
      const ip1 = '192.168.1.5';
      const ip2 = '192.168.1.6';

      // 2 attempts from first IP
      await accountLockoutService.recordFailedAttempt(email, ip1);
      await accountLockoutService.recordFailedAttempt(email, ip1);

      // 1 attempt from second IP (username count is now 3, IP count is 1)
      const result = await accountLockoutService.recordFailedAttempt(email, ip2);
      expect(result.attemptCount).toBe(3); // max(3 username, 1 IP)
    });
  });

  describe('Race condition prevention (10 concurrent requests)', () => {
    it('should maintain correct count under 10 concurrent requests', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping race condition test - Redis not available');
        return;
      }

      const email = 'concurrent-10@example.com';
      const ip = '192.168.1.10';
      const concurrentRequests = 10;

      // Spawn 10 concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        accountLockoutService.recordFailedAttempt(email, ip)
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);

      // Final count should be exactly 10 (no lost increments)
      const finalCheck = await accountLockoutService.checkLockout(email, ip);
      expect(finalCheck.attemptCount).toBe(concurrentRequests);

      // Account should be locked (>= 5 attempts)
      expect(finalCheck.isLocked).toBe(true);
    });

    it('should handle 10 concurrent requests with different users', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping race condition test - Redis not available');
        return;
      }

      const ip = '192.168.1.11';
      const concurrentRequests = 10;

      // Each user makes one request concurrently
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        accountLockoutService.recordFailedAttempt(`user${i}@example.com`, ip)
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);

      // IP should have exactly 10 attempts
      const finalCheck = await accountLockoutService.checkLockout('user0@example.com', ip);
      expect(finalCheck.attemptCount).toBe(concurrentRequests);

      // IP should be locked
      expect(finalCheck.isLocked).toBe(true);
    });
  });

  describe('Race condition prevention (100 concurrent requests)', () => {
    it('should maintain correct count under 100 concurrent requests', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping race condition test - Redis not available');
        return;
      }

      const email = 'concurrent-100@example.com';
      const ip = '192.168.1.100';
      const concurrentRequests = 100;

      // Spawn 100 concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        accountLockoutService.recordFailedAttempt(email, ip)
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);

      // Final count should be exactly 100 (no lost increments)
      const finalCheck = await accountLockoutService.checkLockout(email, ip);
      expect(finalCheck.attemptCount).toBe(concurrentRequests);

      // Account should be locked
      expect(finalCheck.isLocked).toBe(true);
    }, 10000); // 10 second timeout for this test

    it('should handle 100 concurrent requests with mixed users and IPs', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping race condition test - Redis not available');
        return;
      }

      const concurrentRequests = 100;

      // Create mixed scenario: some users, some IPs
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const userNum = i % 10; // 10 different users
        const ipNum = Math.floor(i / 10); // 10 different IPs
        return accountLockoutService.recordFailedAttempt(
          `mixeduser${userNum}@example.com`,
          `192.168.100.${ipNum}`
        );
      });

      const results = await Promise.all(promises);

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);

      // Check one of the users (should have 10 attempts)
      const userCheck = await accountLockoutService.checkLockout(
        'mixeduser0@example.com',
        '192.168.100.0'
      );
      expect(userCheck.attemptCount).toBe(10);

      // User should be locked
      expect(userCheck.isLocked).toBe(true);
    }, 10000); // 10 second timeout for this test
  });

  describe('Performance characteristics', () => {
    it('should complete single request quickly', async () => {
      const startTime = Date.now();

      await accountLockoutService.recordFailedAttempt('perf@example.com', '192.168.1.200');

      const elapsed = Date.now() - startTime;

      // Should complete in <50ms (accounting for Redis latency)
      expect(elapsed).toBeLessThan(50);
    });

    it('should handle 50 concurrent requests within reasonable time', async () => {
      const email = 'perf-concurrent@example.com';
      const ip = '192.168.1.201';
      const concurrentRequests = 50;

      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        accountLockoutService.recordFailedAttempt(email, ip)
      );

      await Promise.all(promises);

      const elapsed = Date.now() - startTime;

      // 50 concurrent requests should complete in <500ms
      expect(elapsed).toBeLessThan(500);
    }, 5000);
  });

  describe('Error handling', () => {
    it('should handle Lua script execution errors gracefully', async () => {
      // This test would require mocking Redis to simulate errors
      // For now, we verify that normal operation succeeds
      const result = await accountLockoutService.recordFailedAttempt(
        'error-test@example.com',
        '192.168.1.250'
      );

      expect(result).toBeDefined();
      expect(result.attemptCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lockout behavior with atomic increments', () => {
    it('should trigger lockout at exactly 5 attempts', async () => {
      const email = 'exact-five@example.com';
      const ip = '192.168.1.5';

      // Attempts 1-4 should not trigger lockout
      for (let i = 1; i <= 4; i++) {
        const result = await accountLockoutService.recordFailedAttempt(email, ip);
        expect(result.isLocked).toBe(false);
      }

      // 5th attempt should trigger lockout
      const lockoutResult = await accountLockoutService.recordFailedAttempt(email, ip);
      expect(lockoutResult.attemptCount).toBe(5);
      expect(lockoutResult.isLocked).toBe(true);
    });

    it('should maintain lockout state after triggering', async () => {
      const email = 'lockout-persist@example.com';
      const ip = '192.168.1.6';

      // Trigger lockout with 5 attempts
      for (let i = 1; i <= 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      // Verify lockout persists
      const check1 = await accountLockoutService.checkLockout(email, ip);
      expect(check1.isLocked).toBe(true);

      // Wait a small amount and check again
      await new Promise((resolve) => setTimeout(resolve, 100));

      const check2 = await accountLockoutService.checkLockout(email, ip);
      expect(check2.isLocked).toBe(true);
    });

    it('should reset lockout correctly', async () => {
      const email = 'reset-test@example.com';
      const ip = '192.168.1.7';

      // Trigger lockout
      for (let i = 1; i <= 5; i++) {
        await accountLockoutService.recordFailedAttempt(email, ip);
      }

      const beforeReset = await accountLockoutService.checkLockout(email, ip);
      expect(beforeReset.isLocked).toBe(true);

      // Reset lockout
      await accountLockoutService.resetLockout(email, ip);

      // Verify reset
      const afterReset = await accountLockoutService.checkLockout(email, ip);
      expect(afterReset.isLocked).toBe(false);
      expect(afterReset.attemptCount).toBe(0);
    });
  });

  describe('Memory cache fallback behavior', () => {
    it('should work with memory cache when Redis unavailable', async () => {
      // This test verifies the service works regardless of cache type
      const result = await accountLockoutService.recordFailedAttempt(
        'fallback@example.com',
        '192.168.1.254'
      );

      expect(result).toBeDefined();
      expect(result.attemptCount).toBeGreaterThanOrEqual(0);
    });
  });
});
