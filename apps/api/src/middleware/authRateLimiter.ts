/**
 * Authentication Rate Limiter Middleware
 *
 * SECURITY: Prevents brute force attacks on authentication endpoints (CWE-307).
 * Applies stricter IP-based rate limiting than the global rate limiter.
 *
 * Attack Vector Example:
 * Attacker attempts credential stuffing or brute force attacks by sending
 * thousands of login/register requests from the same IP address.
 *
 * Protection: Limits authentication attempts to 5 requests per 15 minutes per IP.
 */

import rateLimit, { type Store } from 'express-rate-limit';

import { logger } from '../lib/logger.js';

/**
 * Factory: creates auth-specific rate limiter with stricter limits.
 * Accepts optional store for Redis-backed rate limiting in production.
 * Defaults to express-rate-limit's built-in MemoryStore.
 *
 * Configuration:
 * - Window: 15 minutes (900,000 ms)
 * - Max requests: 5 attempts per IP per window
 * - Applies to: POST /auth/login, POST /auth/register
 *
 * Prevents: credential stuffing, brute force, account enumeration.
 */
export function createAuthRateLimiter(store?: Store) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
    handler: (req, res, _next, options) => {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          userAgent: req.headers['user-agent'],
        },
        'SECURITY: Auth rate limit exceeded'
      );
      res.status(options.statusCode).json(options.message);
    },
    skip: (req) => {
      return req.path === '/api/health';
    },
    keyGenerator: (req) => {
      const forwardedFor = req.headers['x-forwarded-for'];
      if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
      }
      return req.ip ?? 'unknown';
    },
    ...(store ? { store } : {}),
  });
}

/** Default instance (MemoryStore) — preserves existing import sites */
export const authRateLimiter = createAuthRateLimiter();
