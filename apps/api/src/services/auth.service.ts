/**
 * Authentication Service
 *
 * Orchestrates user registration, login, token refresh, and session management.
 * Combines password service, JWT service, and Prisma operations.
 */

import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { mapPrismaRole, type ApiRole } from '../utils/roles.js';

import { jwtService, type TokenPair } from './jwt.service.js';
import { passwordService } from './password.service.js';

/**
 * Registration input
 */
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

/**
 * Login input
 */
export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Registration result
 */
export interface RegisterResult {
  success: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: ApiRole;
  };
  tokens: TokenPair;
}

export interface RegisterError {
  success: false;
  error: 'email_exists' | 'password_weak' | 'password_common' | 'internal';
  details?: string[];
}

export type RegisterResponse = RegisterResult | RegisterError;

/**
 * Login result
 */
export interface LoginResult {
  success: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    role: ApiRole;
  };
  tokens: TokenPair;
}

export interface LoginError {
  success: false;
  error: 'invalid_credentials' | 'account_inactive' | 'account_locked' | 'internal';
}

export type LoginResponse = LoginResult | LoginError;

/**
 * Refresh result
 */
export interface RefreshResult {
  success: true;
  tokens: TokenPair;
}

export interface RefreshError {
  success: false;
  error: 'invalid_token' | 'expired_token' | 'revoked_token' | 'internal';
}

export type RefreshResponse = RefreshResult | RefreshError;

/**
 * Authentication Service singleton
 */
export const authService = {
  /**
   * Register a new user
   *
   * @param input - Registration data
   * @returns Registration result with tokens or error
   */
  async register(input: RegisterInput): Promise<RegisterResponse> {
    try {
      // Validate password strength
      const passwordErrors = passwordService.validate(input.password);
      if (passwordErrors.length > 0) {
        // Determine specific error type
        const isCommon = passwordErrors.some((e) => e.includes('common'));
        return {
          success: false,
          error: isCommon ? 'password_common' : 'password_weak',
          details: passwordErrors,
        };
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { id: true },
      });

      if (existingUser) {
        return { success: false, error: 'email_exists' };
      }

      // Hash password
      const passwordHash = await passwordService.hash(input.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name ?? null,
          emailVerified: false,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Generate tokens
      const tokens = await jwtService.generateTokenPair(user.id, user.email);

      logger.info({ userId: user.id }, 'User registered successfully');

      return {
        success: true,
        user: {
          ...user,
          role: mapPrismaRole(user.role),
        },
        tokens,
      };
    } catch (error) {
      logger.error({ error }, 'Registration failed');
      return { success: false, error: 'internal' };
    }
  },

  /**
   * Authenticate user with email and password
   *
   * @param input - Login credentials and metadata
   * @returns Login result with tokens or error
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          emailVerified: true,
          isActive: true,
          passwordHash: true,
          failedLoginAttempts: true,
          lastFailedLoginAt: true,
          accountLockedUntil: true,
          role: true,
        },
      });

      // User not found - return generic error to prevent enumeration
      if (!user) {
        // Perform dummy hash to prevent timing attacks
        await passwordService.hash('dummy-password-for-timing');
        return { success: false, error: 'invalid_credentials' };
      }

      // No password set (OAuth-only user)
      if (!user.passwordHash) {
        // Perform dummy hash to prevent timing attacks
        await passwordService.hash('dummy-password-for-timing');
        return { success: false, error: 'invalid_credentials' };
      }

      // Check if account is active
      if (!user.isActive) {
        return { success: false, error: 'account_inactive' };
      }

      // Check if account is locked (CWE-307 protection)
      const now = new Date();
      if (user.accountLockedUntil && user.accountLockedUntil > now) {
        // Perform dummy hash to prevent timing attacks
        await passwordService.hash('dummy-password-for-timing');
        logger.warn(
          { userId: user.id, lockedUntil: user.accountLockedUntil },
          'SECURITY: Login attempt on locked account'
        );
        return { success: false, error: 'account_locked' };
      }

      // Verify password
      const verification = await passwordService.verify(input.password, user.passwordHash);

      if (!verification.valid) {
        // Track failed login attempt (CWE-307 protection)
        // Use Prisma's atomic increment to prevent race conditions (CWE-362)
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: { increment: 1 },
            lastFailedLoginAt: now,
          },
          select: { id: true, failedLoginAttempts: true },
        });

        const failedAttempts = updatedUser.failedLoginAttempts;

        // Lock account if threshold exceeded after atomic increment
        if (failedAttempts >= config.lockout.maxAttempts) {
          const lockoutDurationMs = config.lockout.durations.first * 1000;
          const lockoutUntil = new Date(now.getTime() + lockoutDurationMs);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              accountLockedUntil: lockoutUntil,
            },
          });
          logger.warn(
            { userId: user.id, failedAttempts, lockedUntil: lockoutUntil },
            'SECURITY: Account locked due to excessive failed login attempts'
          );
        }

        return { success: false, error: 'invalid_credentials' };
      }

      // Reset failed login attempts on successful login (CWE-307 protection)
      if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lastFailedLoginAt: null,
            accountLockedUntil: null,
          },
        });
        logger.debug({ userId: user.id }, 'Failed login attempts reset after successful login');
      }

      // Rehash password if needed (config changed)
      if (verification.needsRehash) {
        const newHash = await passwordService.hash(input.password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
        logger.debug({ userId: user.id }, 'Password rehashed due to config change');
      }

      // Generate tokens
      const tokenOptions: { userAgent?: string; ipAddress?: string } = {};
      if (input.userAgent) {
        tokenOptions.userAgent = input.userAgent;
      }
      if (input.ipAddress) {
        tokenOptions.ipAddress = input.ipAddress;
      }
      const tokens = await jwtService.generateTokenPair(user.id, user.email, tokenOptions);

      logger.info({ userId: user.id }, 'User logged in successfully');

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          role: mapPrismaRole(user.role),
        },
        tokens,
      };
    } catch (error) {
      logger.error({ error }, 'Login failed');
      return { success: false, error: 'internal' };
    }
  },

  /**
   * Refresh tokens using a valid refresh token
   *
   * @param refreshToken - Current refresh token
   * @param options - Session metadata for new token
   * @returns New token pair or error
   */
  async refresh(
    refreshToken: string,
    options?: { userAgent?: string; ipAddress?: string }
  ): Promise<RefreshResponse> {
    try {
      const tokens = await jwtService.rotateRefreshToken(refreshToken, options);

      if (!tokens) {
        // Determine more specific error by verifying token
        const verification = await jwtService.verifyRefreshToken(refreshToken);
        if (!verification.valid) {
          const errorMap: Record<string, RefreshError['error']> = {
            expired: 'expired_token',
            revoked: 'revoked_token',
            invalid: 'invalid_token',
            malformed: 'invalid_token',
          };
          return { success: false, error: errorMap[verification.error] ?? 'invalid_token' };
        }
        return { success: false, error: 'invalid_token' };
      }

      return { success: true, tokens };
    } catch (error) {
      logger.error({ error }, 'Token refresh failed');
      return { success: false, error: 'internal' };
    }
  },

  /**
   * Logout by revoking the refresh token
   *
   * @param refreshToken - Refresh token to revoke
   * @returns Success indicator
   */
  async logout(refreshToken: string): Promise<boolean> {
    try {
      const verification = await jwtService.verifyRefreshToken(refreshToken);

      if (verification.valid) {
        await jwtService.revokeToken(verification.payload.jti);
        logger.debug({ userId: verification.payload.userId }, 'User logged out');
        return true;
      }

      // Token already invalid - still return success (idempotent)
      return true;
    } catch (error) {
      logger.error({ error }, 'Logout failed');
      return false;
    }
  },

  /**
   * Logout from all devices by revoking all user's tokens
   *
   * @param userId - User ID to logout
   * @returns Number of tokens revoked
   */
  async logoutAll(userId: string): Promise<number> {
    try {
      const count = await jwtService.revokeAllUserTokens(userId);
      logger.info({ userId, count }, 'User logged out from all devices');
      return count;
    } catch (error) {
      logger.error({ error, userId }, 'Logout all failed');
      return 0;
    }
  },

  /**
   * Get user profile by ID
   *
   * @param userId - User ID
   * @returns User profile or null
   */
  async getProfile(userId: string) {
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
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      role: mapPrismaRole(user.role),
    };
  },

  /**
   * Update user profile
   *
   * @param userId - User ID
   * @param data - Profile update data
   * @returns Updated user profile
   */
  async updateProfile(
    userId: string,
    data: { name?: string; avatarUrl?: string | null }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        isActive: true,
        rateLimit: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...user,
      role: mapPrismaRole(user.role),
    };
  },

  /**
   * Change user password
   *
   * @param userId - User ID
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @returns Success or error
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    try {
      // Validate new password
      const passwordErrors = passwordService.validate(newPassword);
      if (passwordErrors.length > 0) {
        return { success: false, error: passwordErrors[0] ?? 'Invalid password' };
      }

      // Get current password hash
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user?.passwordHash) {
        return { success: false, error: 'No password set for this account' };
      }

      // Verify current password
      const verification = await passwordService.verify(currentPassword, user.passwordHash);
      if (!verification.valid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash and save new password
      const newHash = await passwordService.hash(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      logger.info({ userId }, 'Password changed successfully');

      return { success: true };
    } catch (error) {
      logger.error({ error, userId }, 'Password change failed');
      return { success: false, error: 'Failed to change password' };
    }
  },

  /**
   * Get active sessions for a user
   *
   * @param userId - User ID
   * @returns List of active sessions
   */
  async getSessions(userId: string) {
    return jwtService.getUserSessions(userId);
  },

  /**
   * Revoke a specific session
   *
   * @param userId - User ID (for authorization check)
   * @param sessionId - Session/token ID to revoke
   * @returns Success indicator
   */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Verify the session belongs to the user
      const session = await prisma.refreshToken.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });

      if (!session || session.userId !== userId) {
        return false;
      }

      await jwtService.revokeToken(sessionId);
      return true;
    } catch (error) {
      logger.error({ error, userId, sessionId }, 'Session revocation failed');
      return false;
    }
  },
};

export type AuthService = typeof authService;
