import rateLimit, { type Store } from 'express-rate-limit';

import { config } from '../config.js';

/**
 * Factory: creates global rate limiter middleware.
 * Accepts optional store for Redis-backed rate limiting in production.
 * Defaults to express-rate-limit's built-in MemoryStore.
 */
export function createRateLimiter(store?: Store) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later',
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    },
    ...(store ? { store } : {}),
  });
}

/** Default instance (MemoryStore) — preserves existing import sites */
export const rateLimiter = createRateLimiter();
