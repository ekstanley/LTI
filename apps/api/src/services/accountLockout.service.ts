/**
 * Account Lockout Service
 *
 * Implements progressive account lockout to prevent brute force attacks.
 * Uses Redis for distributed lockout tracking with exponential backoff.
 *
 * SECURITY: Addresses CWE-307 (Improper Restriction of Excessive Authentication Attempts)
 * Implements OWASP recommendations for account lockout mechanisms.
 *
 * Lockout progression:
 * - 1-4 failures: Track attempts (15min window)
 * - 5 failures: 15 minutes lockout
 * - 6+ failures: Exponential backoff (1hr → 6hr → 24hr)
 */

import { config } from '../config.js';
import { getCache,  getCacheType } from '../db/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Error thrown when lockout service cannot verify or record lockout state.
 * Callers MUST treat this as "deny access" (fail-closed).
 */
export class LockoutServiceError extends Error {
  public readonly cause: unknown;
  constructor(operation: string, cause: unknown) {
    super(`Lockout service unavailable: ${operation} failed`);
    this.name = 'LockoutServiceError';
    this.cause = cause;
  }
}

/**
 * Lockout configuration — reads from environment at call time
 * so that test overrides and runtime changes are respected.
 */
function getLockoutConfig() {
  return {
    MAX_ATTEMPTS: config.lockout.maxAttempts,
    ATTEMPT_WINDOW_SEC: config.lockout.windowSeconds,
    LOCKOUT_DURATIONS: {
      FIRST: config.lockout.durations.first,
      SECOND: config.lockout.durations.second,
      THIRD: config.lockout.durations.third,
      EXTENDED: config.lockout.durations.extended,
    },
  };
}

/**
 * Lockout information
 */
export interface LockoutInfo {
  isLocked: boolean;
  remainingSeconds: number;
  attemptCount: number;
  lockoutExpiresAt: number;
}

/**
 * Account lockout tracking keys
 */
class LockoutKeys {
  static attemptsByUsername(email: string): string {
    return `lockout:attempts:username:${email.toLowerCase()}`;
  }

  static attemptsByIP(ip: string): string {
    return `lockout:attempts:ip:${ip}`;
  }

  static lockoutByUsername(email: string): string {
    return `lockout:locked:username:${email.toLowerCase()}`;
  }

  static lockoutByIP(ip: string): string {
    return `lockout:locked:ip:${ip}`;
  }

  static lockoutCount(email: string): string {
    return `lockout:count:${email.toLowerCase()}`;
  }
}

/**
 * Lua script for atomic increment and check
 *
 * KEYS[1]: lockout:attempts:username:<email>
 * KEYS[2]: lockout:attempts:ip:<ip>
 * ARGV[1]: TTL in seconds (900 for 15-minute window)
 *
 * Returns: [usernameAttempts, ipAttempts]
 *
 * Atomicity Guarantee:
 * - INCR and EXPIRE execute atomically within Redis
 * - No interleaving between operations possible
 * - Eliminates TOCTOU race condition (CWE-367)
 * - Consistent count under concurrent access
 */
const ATOMIC_INCREMENT_SCRIPT = `
local usernameAttempts = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))

local ipAttempts = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[1]))

return {usernameAttempts, ipAttempts}
`;

/**
 * Account Lockout Service
 */
class AccountLockoutService {
  private scriptSha: string | null = null;

  /**
   * Preload Lua script into Redis for optimal performance
   * Called on service initialization
   */
  async initializeScript(): Promise<void> {
    const cache = getCache();
    try {
      if (!cache.scriptLoad) {
        logger.warn('Cache client does not support Lua scripts (memory fallback)');
        return;
      }
      this.scriptSha = await cache.scriptLoad(ATOMIC_INCREMENT_SCRIPT);
      logger.info({ scriptSha: this.scriptSha }, 'Account lockout Lua script preloaded');
    } catch (error) {
      logger.error({ error }, 'Failed to preload Lua script, will use EVAL fallback');
      this.scriptSha = null;
    }
  }

  async checkLockout(email: string, ip: string): Promise<LockoutInfo> {
    const cache = getCache();
    
    try {
      const [usernameLockout, ipLockout, usernameAttempts, ipAttempts] = await Promise.all([
        cache.get(LockoutKeys.lockoutByUsername(email)),
        cache.get(LockoutKeys.lockoutByIP(ip)),
        cache.get(LockoutKeys.attemptsByUsername(email)),
        cache.get(LockoutKeys.attemptsByIP(ip)),
      ]);

      if (usernameLockout || ipLockout) {
        const lockoutValue = (usernameLockout || ipLockout) as string;
        const expiresAt = parseInt(lockoutValue, 10);
        const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

        return {
          isLocked: true,
          remainingSeconds,
          attemptCount: Math.max(
            parseInt((usernameAttempts as string) || '0', 10),
            parseInt((ipAttempts as string) || '0', 10)
          ),
          lockoutExpiresAt: expiresAt,
        };
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount: Math.max(
          parseInt((usernameAttempts as string) || '0', 10),
          parseInt((ipAttempts as string) || '0', 10)
        ),
        lockoutExpiresAt: 0,
      };
    } catch (error) {
      logger.error({ error, email, ip }, 'SECURITY: Lockout check failed - denying request (fail-closed)');
      throw new LockoutServiceError('checkLockout', error);
    }
  }

  /**
   * Record a failed login attempt atomically
   *
   * Uses Lua script to increment counters atomically, eliminating TOCTOU race condition.
   * Single Redis operation ensures correct count under concurrent access.
   *
   * SECURITY FIX: Issue #33 - Replaces non-atomic GET+SET with atomic INCR+EXPIRE
   *
   * @param email - User email address
   * @param ip - Client IP address
   * @returns Lockout information including current attempt count and lock status
   */
  async recordFailedAttempt(email: string, ip: string): Promise<LockoutInfo> {
    const cache = getCache();
    const lockoutCfg = getLockoutConfig();

    try {
      const usernameKey = LockoutKeys.attemptsByUsername(email);
      const ipKey = LockoutKeys.attemptsByIP(ip);

      // Execute atomic increment via Lua script
      // Returns [usernameAttempts, ipAttempts] as array
      let usernameAttempts: number = 0;
      let ipAttempts: number = 0;

      try {
        // Check if Lua script support is available (Redis only, not memory cache)
        if (!cache.evalsha || !cache.runLuaScript) {
          // Memory cache fallback: use non-atomic operations
          logger.warn('Lua scripts not supported, using non-atomic fallback');
          const usernameVal = await cache.get(usernameKey);
          const ipVal = await cache.get(ipKey);

          usernameAttempts = parseInt((usernameVal as string) || '0', 10) + 1;
          ipAttempts = parseInt((ipVal as string) || '0', 10) + 1;

          await cache.set(usernameKey, usernameAttempts.toString(), lockoutCfg.ATTEMPT_WINDOW_SEC);
          await cache.set(ipKey, ipAttempts.toString(), lockoutCfg.ATTEMPT_WINDOW_SEC);
        } else {
          // Execute Lua script for atomic increment
          let result: unknown;

          if (this.scriptSha) {
            // Use preloaded script SHA for performance (1 RTT)
            result = await cache.evalsha(
              this.scriptSha,
              2,
              usernameKey,
              ipKey,
              lockoutCfg.ATTEMPT_WINDOW_SEC.toString()
            );
          } else {
            // Fallback to EVAL if script not preloaded
            // Note: This is Redis EVAL command for Lua scripts, not JavaScript eval()
            result = await cache.runLuaScript!(
              ATOMIC_INCREMENT_SCRIPT,
              2,
              usernameKey,
              ipKey,
              lockoutCfg.ATTEMPT_WINDOW_SEC.toString()
            );
          }

          // Parse Lua script response
          if (!Array.isArray(result) || result.length !== 2) {
            throw new Error('Invalid Lua script response format');
          }

          usernameAttempts = parseInt(String(result[0]), 10);
          ipAttempts = parseInt(String(result[1]), 10);

          if (isNaN(usernameAttempts) || isNaN(ipAttempts)) {
            throw new Error('Invalid attempt count from Lua script');
          }
        }
      } catch (scriptError) {
        logger.error(
          { error: scriptError, email, ip },
          'Lua script execution failed, cannot record attempt'
        );
        throw scriptError;
      }

      const maxAttempts = Math.max(usernameAttempts, ipAttempts);

      logger.info(
        {
          email,
          ip,
          usernameAttempts,
          ipAttempts,
          maxAttempts,
        },
        'Failed login attempt recorded'
      );

      if (maxAttempts >= lockoutCfg.MAX_ATTEMPTS) {
        return await this.triggerLockout(email, ip, maxAttempts);
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount: maxAttempts,
        lockoutExpiresAt: 0,
      };
    } catch (error) {
      logger.error({ error, email, ip }, 'SECURITY: Failed to record attempt - denying request (fail-closed)');
      throw new LockoutServiceError('recordFailedAttempt', error);
    }
  }

  private async triggerLockout(
    email: string,
    ip: string,
    attemptCount: number
  ): Promise<LockoutInfo> {
    const cache = getCache();
    const lockoutCfg = getLockoutConfig();

    try {
      const lockoutCountKey = LockoutKeys.lockoutCount(email);
      const lockoutCountVal = await cache.get(lockoutCountKey);
      const lockoutCount = parseInt((lockoutCountVal as string) || '0', 10);

      let duration: number;
      if (lockoutCount === 0) {
        duration = lockoutCfg.LOCKOUT_DURATIONS.FIRST;
      } else if (lockoutCount === 1) {
        duration = lockoutCfg.LOCKOUT_DURATIONS.SECOND;
      } else if (lockoutCount === 2) {
        duration = lockoutCfg.LOCKOUT_DURATIONS.THIRD;
      } else {
        duration = lockoutCfg.LOCKOUT_DURATIONS.EXTENDED;
      }

      const expiresAt = Date.now() + duration * 1000;

      await cache.set(LockoutKeys.lockoutByUsername(email), expiresAt.toString(), duration);
      await cache.set(LockoutKeys.lockoutByIP(ip), expiresAt.toString(), duration);
      await cache.set(lockoutCountKey, (lockoutCount + 1).toString(), 30 * 24 * 60 * 60);

      logger.warn(
        {
          email,
          ip,
          attemptCount,
          lockoutCount: lockoutCount + 1,
          duration,
          expiresAt: new Date(expiresAt).toISOString(),
        },
        'SECURITY: Account locked due to repeated failed login attempts'
      );

      return {
        isLocked: true,
        remainingSeconds: duration,
        attemptCount,
        lockoutExpiresAt: expiresAt,
      };
    } catch (error) {
      logger.error({ error, email, ip }, 'SECURITY: Failed to trigger lockout - denying request (fail-closed)');
      throw new LockoutServiceError('triggerLockout', error);
    }
  }

  async resetLockout(email: string, ip: string): Promise<void> {
    const cache = getCache();

    try {
      await Promise.all([
        cache.del(LockoutKeys.attemptsByUsername(email)),
        cache.del(LockoutKeys.attemptsByIP(ip)),
        cache.del(LockoutKeys.lockoutByUsername(email)),
        cache.del(LockoutKeys.lockoutByIP(ip)),
      ]);

      logger.info({ email, ip }, 'Lockout state reset after successful login');
    } catch (error) {
      logger.error({ error, email, ip }, 'Failed to reset lockout');
    }
  }

  async adminUnlock(email: string, adminEmail: string): Promise<boolean> {
    const cache = getCache();

    try {
      await Promise.all([
        cache.del(LockoutKeys.attemptsByUsername(email)),
        cache.del(LockoutKeys.lockoutByUsername(email)),
        cache.del(LockoutKeys.lockoutCount(email)),
      ]);

      logger.info(
        {
          email,
          adminEmail,
        },
        'AUDIT: Admin unlocked account'
      );

      return true;
    } catch (error) {
      logger.error({ error, email, adminEmail }, 'Failed to perform admin unlock');
      return false;
    }
  }

  async getStats(): Promise<{
    totalLockedUsers: number;
    isRedisAvailable: boolean;
  }> {
    const cache = getCache();
    const cacheType = getCacheType();

    try {
      const keys = await cache.keys('lockout:locked:username:*');

      return {
        totalLockedUsers: keys.length,
        isRedisAvailable: cacheType === 'redis',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get lockout stats');
      return {
        totalLockedUsers: 0,
        isRedisAvailable: false,
      };
    }
  }
}

export const accountLockoutService = new AccountLockoutService();
