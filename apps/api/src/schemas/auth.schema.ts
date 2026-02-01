/**
 * Authentication Validation Schemas
 *
 * Centralized Zod schemas for authentication-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Registration & Login
// =============================================================================

/**
 * Schema for user registration
 *
 * Validates:
 * - email: valid format, max 255 chars
 * - password: 8-128 chars
 * - name: optional, max 100 chars
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Schema for user login
 *
 * Validates:
 * - email: valid format
 * - password: required, any length
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// =============================================================================
// Profile Management
// =============================================================================

/**
 * Schema for profile updates
 *
 * Validates:
 * - name: optional, max 100 chars
 * - avatarUrl: optional URL or null, max 500 chars
 */
export const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  avatarUrl: z.string().url('Invalid URL format').max(500).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// =============================================================================
// Password Management
// =============================================================================

/**
 * Schema for password changes
 *
 * Validates:
 * - currentPassword: required
 * - newPassword: 8-128 chars
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// =============================================================================
// Session Management
// =============================================================================

/**
 * Schema for revoking a specific session
 *
 * Validates:
 * - sessionId: required, non-empty string
 */
export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
