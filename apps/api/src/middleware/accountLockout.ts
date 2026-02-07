/**
 * Account Lockout Middleware
 *
 * Prevents brute force attacks by implementing account lockout.
 * Checks lockout status before login and tracks failed attempts after.
 *
 * SECURITY: CWE-307 mitigation - Improper Restriction of Excessive Authentication Attempts
 *
 * Usage:
 *   router.post('/login', accountLockout, validate(loginSchema), async (req, res) => {
 *     // Login handler - middleware has already checked/tracked lockout
 *   });
 */

import type { Request, Response, NextFunction } from 'express';

import { logger } from '../lib/logger.js';
import { accountLockoutService } from '../services/accountLockout.service.js';
import { getClientIP } from '../utils/ip.js';
// LockoutServiceError is checked by err.name in the error handler (middleware/error.ts)

/**
 * Account lockout middleware
 *
 * Pre-checks lockout status and post-processes login results.
 * Integrates with auth route to track failed attempts.
 */
export async function accountLockout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Only process login requests
    if (req.path !== '/login' && !req.path.endsWith('/login')) {
      next();
      return;
    }

    // Extract email and IP - cast req.body from Express `any` to typed record
    const body = req.body as Record<string, unknown> | undefined;
    const email = typeof body?.email === 'string' ? body.email : undefined;
    const ip = getClientIP(req);

    if (!email || typeof email !== 'string') {
      // No email in body - let validation middleware handle it
      next();
      return;
    }

    // Check if account is currently locked
    const lockoutInfo = await accountLockoutService.checkLockout(email, ip);

    if (lockoutInfo.isLocked) {
      logger.warn(
        {
          email,
          ip,
          remainingSeconds: lockoutInfo.remainingSeconds,
          attemptCount: lockoutInfo.attemptCount,
        },
        'Login attempt blocked - account locked'
      );

      res.status(429).set('Retry-After', lockoutInfo.remainingSeconds.toString()).json({
        error: 'account_locked',
        message: 'Account temporarily locked due to multiple failed login attempts',
        retryAfter: lockoutInfo.remainingSeconds,
        expiresAt: new Date(lockoutInfo.lockoutExpiresAt).toISOString(),
      });
      return;
    }

    // Account not locked - proceed with login attempt
    // We'll track the result in the route handler
    next();
  } catch (error) {
    logger.error({ error }, 'SECURITY: Account lockout check failed - blocking request (fail-closed)');
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Authentication service temporarily unavailable. Please try again later.',
    });
  }
}

/**
 * Post-login handler to track failed attempts
 *
 * Call this after login attempt to record success/failure.
 * This is exported as a utility function rather than middleware
 * so the auth route can call it explicitly after checking credentials.
 *
 * @param email - User email
 * @param ip - Client IP
 * @param success - Whether login was successful
 */
export async function trackLoginAttempt(
  email: string,
  ip: string,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      // Reset lockout on successful login
      await accountLockoutService.resetLockout(email, ip);
    } else {
      // Record failed attempt (may trigger lockout)
      const lockoutInfo = await accountLockoutService.recordFailedAttempt(email, ip);

      if (lockoutInfo.isLocked) {
        logger.warn(
          {
            email,
            ip,
            attemptCount: lockoutInfo.attemptCount,
            lockoutDuration: lockoutInfo.remainingSeconds,
          },
          'SECURITY: Account locked after failed login attempts'
        );
      }
    }
  } catch (error) {
    if (!success) {
      // SECURITY: Failed login + Redis error = must propagate (fail-closed)
      logger.error({ error, email, ip }, 'SECURITY: Failed to record failed attempt - propagating (fail-closed)');
      throw error;
    }
    // Successful login + Redis error = non-critical (lockout TTL will expire)
    logger.warn({ error, email, ip }, 'Failed to reset lockout after successful login (non-critical)');
  }
}
