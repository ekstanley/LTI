/**
 * Authentication Middleware
 *
 * Provides JWT-based authentication for Express routes.
 * Supports both required and optional authentication patterns.
 */

import type { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwt.service.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { ApiError } from './error.js';
import type { AuthenticatedUser } from '../types/express.js';

/**
 * Extract Bearer token from Authorization header
 *
 * @param req - Express request
 * @returns Token string or null if not present/malformed
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Must be "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Fetch user from database and convert to AuthenticatedUser
 *
 * @param userId - User's database ID
 * @returns AuthenticatedUser or null if not found/inactive
 */
async function fetchAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      emailVerified: true,
      isActive: true,
      rateLimit: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

/**
 * Middleware that requires valid JWT authentication.
 *
 * Extracts Bearer token from Authorization header, verifies it,
 * fetches the user from database, and attaches to req.user.
 *
 * Returns 401 Unauthorized if:
 * - No Authorization header
 * - Malformed header
 * - Invalid/expired token
 * - User not found or inactive
 *
 * @example
 * router.get('/protected', requireAuth, (req, res) => {
 *   // req.user is guaranteed to be defined here
 *   res.json({ userId: req.user.id });
 * });
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw ApiError.unauthorized('Authentication required');
    }

    const result = jwtService.verifyAccessToken(token);

    if (!result.valid) {
      // Map verification errors to appropriate messages
      const errorMessages: Record<string, string> = {
        expired: 'Token has expired',
        invalid: 'Invalid token',
        malformed: 'Malformed token',
        revoked: 'Token has been revoked',
      };

      throw ApiError.unauthorized(errorMessages[result.error] ?? 'Invalid token');
    }

    // Fetch user from database
    const user = await fetchAuthenticatedUser(result.payload.sub);

    if (!user) {
      logger.warn({ userId: result.payload.sub }, 'Token valid but user not found/inactive');
      throw ApiError.unauthorized('User account not found or inactive');
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error({ error }, 'Unexpected error in requireAuth middleware');
      next(ApiError.unauthorized('Authentication failed'));
    }
  }
}

/**
 * Middleware that optionally authenticates if token is present.
 *
 * If a valid Bearer token is provided, verifies it and attaches user.
 * If no token or invalid token, continues without setting req.user.
 * Never returns 401 - useful for routes that work differently for
 * authenticated vs anonymous users.
 *
 * @example
 * router.get('/items', optionalAuth, (req, res) => {
 *   if (req.user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      // No token provided - continue without authentication
      next();
      return;
    }

    const result = jwtService.verifyAccessToken(token);

    if (!result.valid) {
      // Invalid token - log and continue without authentication
      logger.debug({ error: result.error }, 'Optional auth: invalid token, continuing unauthenticated');
      next();
      return;
    }

    // Fetch user from database
    const user = await fetchAuthenticatedUser(result.payload.sub);

    if (user) {
      req.user = user;
    } else {
      logger.debug({ userId: result.payload.sub }, 'Optional auth: user not found, continuing unauthenticated');
    }

    next();
  } catch (error) {
    // SECURITY: Fail closed on unexpected errors instead of silently downgrading to unauthenticated
    // This prevents attackers from exploiting error conditions to bypass authentication
    logger.error({ error }, 'Unexpected error in optionalAuth middleware');
    next(ApiError.internal('Authentication service temporarily unavailable'));
  }
}

/**
 * Higher-order middleware that requires email verification.
 *
 * Must be used after requireAuth. Returns 403 if user's email
 * is not verified.
 *
 * @example
 * router.post('/sensitive', requireAuth, requireEmailVerified, handler);
 */
export function requireEmailVerified(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    // This shouldn't happen if used after requireAuth
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  if (!req.user.emailVerified) {
    next(ApiError.forbidden('Email verification required'));
    return;
  }

  next();
}
