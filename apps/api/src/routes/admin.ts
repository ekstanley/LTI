/**
 * Admin Routes
 *
 * Administrative endpoints requiring admin role.
 * Includes account management, lockout control, and system monitoring.
 */

import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { accountLockoutService } from '../services/accountLockout.service.js';

export const adminRouter: RouterType = Router();

// ============================================================================
// Admin Authentication Middleware
// ============================================================================

/**
 * Require admin role
 *
 * Must be used after requireAuth middleware.
 *
 * TEMPORARY IMPLEMENTATION: Uses ADMIN_EMAILS environment variable.
 * TODO: Replace with proper role-based access control from database (see Issue #TBD)
 */
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Get admin emails from environment (comma-separated list)
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);

  // Check if user email is in admin list
  const isAdmin = adminEmails.includes(req.user.email.toLowerCase());

  if (!isAdmin) {
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

  next();
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
