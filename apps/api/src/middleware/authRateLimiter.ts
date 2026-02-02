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

import rateLimit from 'express-rate-limit';

import { logger } from '../lib/logger.js';

/**
 * Auth-specific rate limiter with stricter limits than global rate limiter
 *
 * Configuration:
 * - Window: 15 minutes (900,000 ms)
 * - Max requests: 5 attempts per IP per window
 * - Applies to: POST /auth/login, POST /auth/register
 *
 * This is intentionally stricter than the global rate limiter to prevent:
 * - Credential stuffing attacks
 * - Brute force password attempts
 * - Account enumeration through repeated registration attempts
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    code: 'TOO_MANY_AUTH_ATTEMPTS',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  // Log rate limit violations for security monitoring
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
  // Skip rate limiting for health checks (shouldn't hit auth routes, but defensive)
  skip: (req) => {
    return req.path === '/api/health';
  },
  // Use IP address as key for rate limiting
  keyGenerator: (req) => {
    // Try to get real IP from proxy headers (if behind reverse proxy)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    }
    return req.ip ?? 'unknown';
  },
});
