/**
 * CSRF Protection Middleware
 *
 * Implements Synchronizer Token Pattern middleware for Express.js:
 * - Extracts CSRF token from X-CSRF-Token header
 * - Validates token against session-bound token in Redis
 * - Enforces single-use token invalidation
 * - Returns 403 Forbidden on validation failure
 *
 * Usage:
 *   router.post('/endpoint', csrfProtection, handler);
 *   router.post('/endpoint', csrfProtectionOptional, handler);
 *
 * Configuration:
 *   - Exempt GET/HEAD/OPTIONS methods (safe methods)
 *   - Requires authentication middleware to run first
 *   - Feature flag: CSRF_PROTECTION_ENABLED (default: true in production)
 */

import type { Request, Response, NextFunction } from 'express';
import {
  validateCsrfToken,
  invalidateCsrfToken,
  generateCsrfToken,
} from '../services/csrf.service.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/error.js';
import { hasSession } from '../utils/type-guards.js';

/**
 * Feature flag for CSRF protection
 * Can be disabled for testing or gradual rollout
 */
const CSRF_ENABLED = config.nodeEnv === 'production' || process.env.CSRF_PROTECTION_ENABLED === 'true';

/**
 * HTTP methods exempt from CSRF protection (safe methods per RFC 7231)
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection middleware (strict enforcement)
 *
 * Validates CSRF token for all state-changing requests.
 * Returns 403 Forbidden if validation fails.
 *
 * @throws ApiError.forbidden - If CSRF token is missing or invalid
 */
export async function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip CSRF check if feature flag is disabled
    if (!CSRF_ENABLED) {
      logger.debug('CSRF protection disabled by feature flag');
      return next();
    }

    // Exempt safe methods (GET, HEAD, OPTIONS)
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    // Require authentication - CSRF protection requires session
    if (!hasSession(req)) {
      logger.warn(
        { method: req.method, path: req.path },
        'CSRF protection requires authentication'
      );
      throw ApiError.unauthorized('Authentication required for CSRF protection');
    }

    const sessionId = req.session.id;

    // Extract CSRF token from header
    const csrfToken = req.headers['x-csrf-token'];

    if (!csrfToken || typeof csrfToken !== 'string') {
      logger.warn(
        { method: req.method, path: req.path, sessionId },
        'CSRF token missing from request'
      );
      throw ApiError.forbidden('CSRF token required');
    }

    // Validate CSRF token
    const isValid = await validateCsrfToken(sessionId, csrfToken);

    if (!isValid) {
      logger.warn(
        { method: req.method, path: req.path, sessionId },
        'CSRF token validation failed'
      );
      throw ApiError.forbidden('Invalid or expired CSRF token');
    }

    // Invalidate token after successful validation (single-use enforcement)
    await invalidateCsrfToken(sessionId, csrfToken);

    logger.debug(
      { method: req.method, path: req.path, sessionId },
      'CSRF token validated successfully'
    );

    // Generate new token for next request (automatic rotation)
    const newToken = await generateCsrfToken(sessionId);
    res.setHeader('X-CSRF-Token', newToken);

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error({ error }, 'CSRF validation error');
      next(ApiError.internal('CSRF validation failed'));
    }
  }
}

/**
 * Optional CSRF protection middleware
 *
 * Validates CSRF token if present, but allows request to proceed if missing.
 * Useful for endpoints that support both authenticated and unauthenticated access.
 */
export async function csrfProtectionOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip CSRF check if feature flag is disabled
    if (!CSRF_ENABLED) {
      return next();
    }

    // Exempt safe methods
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    // Skip CSRF check if no session (unauthenticated request)
    if (!hasSession(req)) {
      return next();
    }

    const sessionId = req.session.id;
    const csrfToken = req.headers['x-csrf-token'];

    // If token is provided, validate it
    if (csrfToken && typeof csrfToken === 'string') {
      const isValid = await validateCsrfToken(sessionId, csrfToken);

      if (!isValid) {
        logger.warn(
          { method: req.method, path: req.path, sessionId },
          'Optional CSRF token validation failed'
        );
        throw ApiError.forbidden('Invalid CSRF token');
      }

      // Invalidate token after successful validation
      await invalidateCsrfToken(sessionId, csrfToken);

      // Generate new token for next request
      const newToken = await generateCsrfToken(sessionId);
      res.setHeader('X-CSRF-Token', newToken);

      logger.debug(
        { method: req.method, path: req.path, sessionId },
        'Optional CSRF token validated successfully'
      );
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error({ error }, 'Optional CSRF validation error');
      next(ApiError.internal('CSRF validation failed'));
    }
  }
}

/**
 * Generate CSRF token endpoint
 *
 * GET /api/v1/csrf-token
 * Returns a new CSRF token for the current session.
 *
 * Response:
 * {
 *   "csrfToken": "base64url-encoded-token"
 * }
 */
export async function getCsrfToken(req: Request, res: Response): Promise<void> {
  try {
    // Require authentication
    if (!hasSession(req)) {
      throw ApiError.unauthorized('Authentication required to obtain CSRF token');
    }

    const sessionId = req.session.id;

    // Generate new CSRF token
    const csrfToken = await generateCsrfToken(sessionId);

    // Return token in response body and header
    res.setHeader('X-CSRF-Token', csrfToken);
    res.json({ csrfToken });

    logger.debug({ sessionId }, 'CSRF token generated for client');
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error({ error }, 'Failed to generate CSRF token');
    throw ApiError.internal('Failed to generate CSRF token');
  }
}
