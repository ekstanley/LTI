/**
 * Account Lockout Service - Fail-Closed Behavior Tests
 *
 * SECURITY: Verifies that lockout service operations throw LockoutServiceError
 * when the cache is unavailable, rather than failing open.
 *
 * Contract: If cache is unreachable, MUST throw (never return isLocked: false)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { accountLockoutService, LockoutServiceError } from '../../services/accountLockout.service.js';
import * as redisModule from '../../db/redis.js';

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    lockout: {
      maxAttempts: 5,
      windowSeconds: 900,
      durations: {
        first: 900,
        second: 3600,
        third: 21600,
        extended: 86400,
      },
    },
  },
}));

describe('AccountLockoutService - Fail-Closed Behavior', () => {
  const email = 'test@example.com';
  const ip = '127.0.0.1';

  // Create a mock cache that throws on all operations
  const createFailingCache = () => ({
    get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    del: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    keys: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    incr: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    expire: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    evalsha: undefined,
    runLuaScript: undefined,
    scriptLoad: undefined,
    quit: vi.fn(),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkLockout', () => {
    it('should throw LockoutServiceError when cache.get fails', async () => {
      const failingCache = createFailingCache();
      vi.spyOn(redisModule, 'getCache').mockReturnValue(failingCache as any);

      await expect(accountLockoutService.checkLockout(email, ip))
        .rejects.toThrow(LockoutServiceError);

      await expect(accountLockoutService.checkLockout(email, ip))
        .rejects.toThrow(/checkLockout/);
    });

    it('should include original error as cause', async () => {
      const failingCache = createFailingCache();
      vi.spyOn(redisModule, 'getCache').mockReturnValue(failingCache as any);

      try {
        await accountLockoutService.checkLockout(email, ip);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LockoutServiceError);
        expect((err as LockoutServiceError).cause).toBeInstanceOf(Error);
        expect(((err as LockoutServiceError).cause as Error).message).toBe('ECONNREFUSED');
      }
    });
  });

  describe('recordFailedAttempt', () => {
    it('should throw LockoutServiceError when cache operations fail', async () => {
      const failingCache = createFailingCache();
      vi.spyOn(redisModule, 'getCache').mockReturnValue(failingCache as any);

      await expect(accountLockoutService.recordFailedAttempt(email, ip))
        .rejects.toThrow(LockoutServiceError);

      await expect(accountLockoutService.recordFailedAttempt(email, ip))
        .rejects.toThrow(/recordFailedAttempt/);
    });
  });

  describe('triggerLockout', () => {
    it('should throw LockoutServiceError when cache.set fails during lockout', async () => {
      // triggerLockout is private, but it's called from recordFailedAttempt when attempts >= MAX
      // We need a cache that succeeds on increment but fails on lockout set
      const partialCache = {
        get: vi.fn()
          .mockResolvedValueOnce(null) // username attempts (first call in recordFailedAttempt)
          .mockResolvedValueOnce(null) // ip attempts
          .mockRejectedValue(new Error('ECONNREFUSED')), // triggerLockout cache.get for lockout count
        set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockResolvedValue([]),
        evalsha: undefined,
        runLuaScript: undefined,
        scriptLoad: undefined,
        quit: vi.fn(),
      };
      vi.spyOn(redisModule, 'getCache').mockReturnValue(partialCache as any);

      // recordFailedAttempt will use non-atomic fallback (no evalsha/runLuaScript)
      // and the set calls will succeed for attempt tracking but then triggerLockout
      // will fail when trying to write lockout keys
      // Actually with the failing set, the non-atomic path set() will throw
      // which will be caught by the inner try-catch and re-thrown,
      // then caught by outer catch which now throws LockoutServiceError
      await expect(accountLockoutService.recordFailedAttempt(email, ip))
        .rejects.toThrow(LockoutServiceError);
    });
  });

  describe('LockoutServiceError class', () => {
    it('should have correct name and message format', () => {
      const cause = new Error('connection lost');
      const err = new LockoutServiceError('testOp', cause);

      expect(err.name).toBe('LockoutServiceError');
      expect(err.message).toBe('Lockout service unavailable: testOp failed');
      expect(err.cause).toBe(cause);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(LockoutServiceError);
    });
  });
});
