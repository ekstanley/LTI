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

import { getCache,  getCacheType } from '../db/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Lockout configuration
 */
const LOCKOUT_CONFIG = {
  MAX_ATTEMPTS: 5,
  ATTEMPT_WINDOW_SEC: 900,
  LOCKOUT_DURATIONS: {
    FIRST: 900,
    SECOND: 3600,
    THIRD: 21600,
    EXTENDED: 86400,
  },
} as const;

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
 * Account Lockout Service
 */
class AccountLockoutService {
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
      logger.error({ error, email, ip }, 'Failed to check lockout status');
      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount: 0,
        lockoutExpiresAt: 0,
      };
    }
  }

  async recordFailedAttempt(email: string, ip: string): Promise<LockoutInfo> {
    const cache = getCache();

    try {
      const usernameKey = LockoutKeys.attemptsByUsername(email);
      const ipKey = LockoutKeys.attemptsByIP(ip);

      const usernameVal = await cache.get(usernameKey);
      const ipVal = await cache.get(ipKey);
      
      const usernameAttempts = parseInt((usernameVal as string) || '0', 10) + 1;
      const ipAttempts = parseInt((ipVal as string) || '0', 10) + 1;

      await cache.set(usernameKey, usernameAttempts.toString(), LOCKOUT_CONFIG.ATTEMPT_WINDOW_SEC);
      await cache.set(ipKey, ipAttempts.toString(), LOCKOUT_CONFIG.ATTEMPT_WINDOW_SEC);

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

      if (maxAttempts >= LOCKOUT_CONFIG.MAX_ATTEMPTS) {
        return await this.triggerLockout(email, ip, maxAttempts);
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount: maxAttempts,
        lockoutExpiresAt: 0,
      };
    } catch (error) {
      logger.error({ error, email, ip }, 'Failed to record failed attempt');
      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount: 0,
        lockoutExpiresAt: 0,
      };
    }
  }

  private async triggerLockout(
    email: string,
    ip: string,
    attemptCount: number
  ): Promise<LockoutInfo> {
    const cache = getCache();

    try {
      const lockoutCountKey = LockoutKeys.lockoutCount(email);
      const lockoutCountVal = await cache.get(lockoutCountKey);
      const lockoutCount = parseInt((lockoutCountVal as string) || '0', 10);

      let duration: number;
      if (lockoutCount === 0) {
        duration = LOCKOUT_CONFIG.LOCKOUT_DURATIONS.FIRST;
      } else if (lockoutCount === 1) {
        duration = LOCKOUT_CONFIG.LOCKOUT_DURATIONS.SECOND;
      } else if (lockoutCount === 2) {
        duration = LOCKOUT_CONFIG.LOCKOUT_DURATIONS.THIRD;
      } else {
        duration = LOCKOUT_CONFIG.LOCKOUT_DURATIONS.EXTENDED;
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
      logger.error({ error, email, ip }, 'Failed to trigger lockout');
      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptCount,
        lockoutExpiresAt: 0,
      };
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
