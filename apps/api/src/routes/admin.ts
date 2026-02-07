/**
 * Admin Routes
 *
 * Administrative endpoints requiring admin role.
 * Includes account management, lockout control, and system monitoring.
 */

import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { accountLockoutService } from '../services/accountLockout.service.js';

export const adminRouter: RouterType = Router();

// ============================================================================
// Admin Rate Limiting
// ============================================================================

/**
 * Rate limiter for admin endpoints
 *
 * Limits admin API access to 30 requests per 15 minutes per IP.
 * Protects against admin endpoint abuse.
 */
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_ADMIN_REQUESTS',
    message: 'Too many admin requests. Please try again later.',
  },
  handler: (req, res, _next, options) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        userId: req.user?.id,
      },
      'SECURITY: Admin rate limit exceeded'
    );
    res.status(options.statusCode).json(options.message);
  },
});

// Apply rate limiter to all admin routes
adminRouter.use(adminRateLimiter);

// ============================================================================
// Admin Authentication Middleware
// ============================================================================

/**
 * Require admin role
 *
 * Must be used after requireAuth middleware.
 *
 * Primary: Checks req.user.role === 'admin' (database-driven RBAC).
 * Fallback: Checks ADMIN_EMAILS env var for backward compatibility during
 * migration. The ADMIN_EMAILS mechanism is DEPRECATED and will be removed
 * in a future release.
 */
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Primary: Database-driven role check
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Fallback (DEPRECATED): ADMIN_EMAILS env var check during migration
  const adminEmailsStr = process.env.ADMIN_EMAILS ?? '';
  const adminEmails = adminEmailsStr.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  const isLegacyAdmin = adminEmails.length > 0 && adminEmails.includes(req.user.email.toLowerCase());

  if (isLegacyAdmin) {
    logger.info(
      {
        userId: req.user.id,
        email: req.user.email,
      },
      'DEPRECATION: Admin access granted via ADMIN_EMAILS env var. Migrate to database role.'
    );
    next();
    return;
  }

  logger.warn(
    {
      userId: req.user.id,
      email: req.user.email,
      path: req.path,
    },
    'SECURITY: Non-admin user attempted to access admin endpoint'
  );
  throw ApiError.forbidden('Admin access required');
}

// ============================================================================
// Account Lockout Management
// ============================================================================

/**
 * Unlock account schema
 */
const unlockAccountSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/v1/admin/unlock-account
 *
 * Manually unlock a locked account
 *
 * @auth Required (admin role)
 * @body {email}
 * @returns {success, email, wasLocked}
 */
adminRouter.post(
  '/unlock-account',
  requireAuth,
  requireAdmin,
  validate(unlockAccountSchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { email } = unlockAccountSchema.parse(req.body);

      // Perform unlock
      const wasLocked = await accountLockoutService.adminUnlock(
        email,
        req.user.email
      );

      // Audit log (already logged in service, but log here too for completeness)
      logger.info(
        {
          adminId: req.user.id,
          adminEmail: req.user.email,
          unlockedEmail: email,
          wasLocked,
          ip: req.ip,
        },
        'AUDIT: Admin unlock account request'
      );

      res.json({
        success: true,
        email,
        wasLocked,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/lockout-stats
 *
 * Get account lockout statistics
 *
 * @auth Required (admin role)
 * @returns {totalLockedUsers, isRedisAvailable}
 */
adminRouter.get(
  '/lockout-stats',
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const stats = await accountLockoutService.getStats();

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);
