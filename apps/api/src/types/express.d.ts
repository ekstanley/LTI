/**
 * Express Type Augmentation
 *
 * Extends Express Request interface to include authenticated user and session.
 * This provides type safety for auth and CSRF middleware consumers.
 */

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

/**
 * Session data attached to request.
 * Used for CSRF protection and session management.
 */
export interface SessionData {
  id: string;
  userId?: string;
  createdAt?: number;
  lastActivity?: number;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user, populated by requireAuth or optionalAuth middleware.
       * Will be undefined if optionalAuth is used and no valid token provided.
       */
      user?: AuthenticatedUser;

      /**
       * Session data, populated by session middleware.
       * Contains session ID and optional user data.
       */
      session?: SessionData;
    }
  }
}

export {};
