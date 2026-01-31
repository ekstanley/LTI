/**
 * Express Type Augmentation
 *
 * Extends Express Request interface to include authenticated user.
 * This provides type safety for auth middleware consumers.
 */

import type { User } from '@prisma/client';

/**
 * Authenticated user attached to request by auth middleware.
 * Excludes sensitive fields like passwordHash.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  rateLimit: number;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user, populated by requireAuth or optionalAuth middleware.
       * Will be undefined if optionalAuth is used and no valid token provided.
       */
      user?: AuthenticatedUser;
    }
  }
}

export {};
