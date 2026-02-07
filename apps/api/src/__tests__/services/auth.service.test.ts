/**
 * Auth Service Unit Tests
 *
 * Comprehensive test coverage for authentication service including:
 * - User registration with password validation
 * - Login with timing attack prevention
 * - Account lockout mechanism (CWE-307 protection)
 * - Token refresh and session management
 * - Password change operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../services/auth.service.js';
import { prisma } from '../../db/client.js';
import { jwtService } from '../../services/jwt.service.js';
import { passwordService } from '../../services/password.service.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/jwt.service.js', () => ({
  jwtService: {
    generateTokenPair: vi.fn(),
    verifyRefreshToken: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
    getUserSessions: vi.fn(),
  },
}));

vi.mock('../../services/password.service.js', () => ({
  passwordService: {
    validate: vi.fn(),
    hash: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock data
const mockTokenPair = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  accessTokenExpiresAt: new Date('2026-01-01T01:00:00Z'),
  refreshTokenExpiresAt: new Date('2026-01-08T00:00:00Z'),
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  emailVerified: true,
  isActive: true,
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hash',
  failedLoginAttempts: 0,
  lastFailedLoginAt: null,
  accountLockedUntil: null,
  rateLimit: 100,
  role: 'USER' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    const validInput = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      name: 'New User',
    };

    it('should return success with user and tokens for valid input', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(passwordService.hash).mockResolvedValue('hashed-password');
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
      } as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.register(validInput);

      expect(result).toEqual({
        success: true,
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'user',
        },
        tokens: mockTokenPair,
      });
      expect(logger.info).toHaveBeenCalledWith(
        { userId: 'new-user-id' },
        'User registered successfully'
      );
    });

    it('should return password_weak when password validation fails', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([
        'Password must be at least 8 characters',
      ]);

      const result = await authService.register(validInput);

      expect(result).toEqual({
        success: false,
        error: 'password_weak',
        details: ['Password must be at least 8 characters'],
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return password_common when password includes common password error', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([
        'Password is too common and easily guessable',
      ]);

      const result = await authService.register(validInput);

      expect(result).toEqual({
        success: false,
        error: 'password_common',
        details: ['Password is too common and easily guessable'],
      });
    });

    it('should return email_exists when user already exists', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing-id' } as any);

      const result = await authService.register(validInput);

      expect(result).toEqual({
        success: false,
        error: 'email_exists',
      });
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(passwordService.hash).mockResolvedValue('hashed-password');
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
      } as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.register({
        ...validInput,
        email: 'NewUser@EXAMPLE.COM',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
        select: { id: true },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
          name: 'New User',
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
    });

    it('should create user with correct data via prisma', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(passwordService.hash).mockResolvedValue('hashed-password');
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
      } as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.register(validInput);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
          name: 'New User',
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
    });

    it('should call jwtService.generateTokenPair with user id and email', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(passwordService.hash).mockResolvedValue('hashed-password');
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
      } as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.register(validInput);

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith(
        'new-user-id',
        'newuser@example.com'
      );
    });

    it('should return internal error when exception thrown', async () => {
      vi.mocked(passwordService.validate).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await authService.register(validInput);

      expect(result).toEqual({
        success: false,
        error: 'internal',
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Registration failed'
      );
    });
  });

  describe('login', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
    };

    it('should return success with user data and tokens for valid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.login(validInput);

      expect(result).toEqual({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          emailVerified: true,
          role: 'user',
        },
        tokens: mockTokenPair,
      });
      expect(logger.info).toHaveBeenCalledWith({ userId: 'user-123' }, 'User logged in successfully');
    });

    it('should call dummy passwordService.hash when user not found (timing attack prevention)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(passwordService.hash).mockResolvedValue('dummy-hash');

      const result = await authService.login(validInput);

      expect(passwordService.hash).toHaveBeenCalledWith('dummy-password-for-timing');
      expect(result).toEqual({
        success: false,
        error: 'invalid_credentials',
      });
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should call dummy passwordService.hash when no passwordHash (OAuth-only user)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as any);
      vi.mocked(passwordService.hash).mockResolvedValue('dummy-hash');

      const result = await authService.login(validInput);

      expect(passwordService.hash).toHaveBeenCalledWith('dummy-password-for-timing');
      expect(result).toEqual({
        success: false,
        error: 'invalid_credentials',
      });
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should return account_inactive when user.isActive is false', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      const result = await authService.login(validInput);

      expect(result).toEqual({
        success: false,
        error: 'account_inactive',
      });
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should call dummy passwordService.hash when account is locked and return account_locked', async () => {
      const futureDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        accountLockedUntil: futureDate,
      } as any);
      vi.mocked(passwordService.hash).mockResolvedValue('dummy-hash');

      const result = await authService.login(validInput);

      expect(passwordService.hash).toHaveBeenCalledWith('dummy-password-for-timing');
      expect(result).toEqual({
        success: false,
        error: 'account_locked',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        { userId: 'user-123', lockedUntil: futureDate },
        'SECURITY: Login attempt on locked account'
      );
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should NOT call dummy hash when lock is expired (accountLockedUntil < now)', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        accountLockedUntil: pastDate,
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.login(validInput);

      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(passwordService.verify).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should return invalid_credentials and increment failedLoginAttempts atomically on wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: false,
        needsRehash: false,
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user-123',
        failedLoginAttempts: 1,
      } as any);

      const result = await authService.login(validInput);

      expect(result).toEqual({
        success: false,
        error: 'invalid_credentials',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: { increment: 1 },
          lastFailedLoginAt: expect.any(Date),
        },
        select: { id: true, failedLoginAttempts: true },
      });
    });

    it('should lock account when failedLoginAttempts reaches 5 (CWE-307 protection)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: false,
        needsRehash: false,
      });
      // First update returns failedLoginAttempts = 5
      vi.mocked(prisma.user.update)
        .mockResolvedValueOnce({
          id: 'user-123',
          failedLoginAttempts: 5,
        } as any)
        .mockResolvedValueOnce({
          id: 'user-123',
          accountLockedUntil: expect.any(Date),
        } as any);

      const result = await authService.login(validInput);

      expect(result).toEqual({
        success: false,
        error: 'invalid_credentials',
      });
      // Second update should set accountLockedUntil
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'user-123' },
        data: {
          accountLockedUntil: expect.any(Date),
        },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        { userId: 'user-123', failedAttempts: 5, lockedUntil: expect.any(Date) },
        'SECURITY: Account locked due to excessive failed login attempts'
      );
    });

    it('should reset failedLoginAttempts and accountLockedUntil on successful login (when counters > 0)', async () => {
      const pastDate = new Date(Date.now() - 1000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 3,
        accountLockedUntil: pastDate,
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.login(validInput);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          accountLockedUntil: null,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { userId: 'user-123' },
        'Failed login attempts reset after successful login'
      );
    });

    it('should NOT reset counters when they are already 0', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.login(validInput);

      // prisma.user.update should NOT be called for resetting counters
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should trigger password rehash when verification.needsRehash is true', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: true,
      });
      vi.mocked(passwordService.hash).mockResolvedValue('new-hash');
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.login(validInput);

      expect(result.success).toBe(true);
      expect(passwordService.hash).toHaveBeenCalledWith('SecurePassword123!');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'new-hash' },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { userId: 'user-123' },
        'Password rehashed due to config change'
      );
    });

    it('should pass userAgent and ipAddress to generateTokenPair when provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.login(validInput);

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith('user-123', 'test@example.com', {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });
    });

    it('should NOT pass empty options when userAgent and ipAddress not provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(jwtService.generateTokenPair).toHaveBeenCalledWith('user-123', 'test@example.com', {});
    });

    it('should return internal error on exception', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'));

      const result = await authService.login(validInput);

      expect(result).toEqual({
        success: false,
        error: 'internal',
      });
      expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Login failed');
    });

    it('should map ADMIN role to lowercase admin in login response', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'ADMIN' as const,
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair);

      const result = await authService.login(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.role).toBe('admin');
      }
    });
  });

  describe('refresh', () => {
    const validToken = 'valid-refresh-token';

    it('should return success with new tokens when rotation succeeds', async () => {
      vi.mocked(jwtService.rotateRefreshToken).mockResolvedValue(mockTokenPair);

      const result = await authService.refresh(validToken);

      expect(result).toEqual({
        success: true,
        tokens: mockTokenPair,
      });
      expect(jwtService.rotateRefreshToken).toHaveBeenCalledWith(validToken, undefined);
    });

    it('should return expired_token when verification says expired', async () => {
      vi.mocked(jwtService.rotateRefreshToken).mockResolvedValue(null);
      vi.mocked(jwtService.verifyRefreshToken).mockResolvedValue({
        valid: false,
        error: 'expired',
      } as any);

      const result = await authService.refresh(validToken);

      expect(result).toEqual({
        success: false,
        error: 'expired_token',
      });
    });

    it('should return revoked_token when verification says revoked', async () => {
      vi.mocked(jwtService.rotateRefreshToken).mockResolvedValue(null);
      vi.mocked(jwtService.verifyRefreshToken).mockResolvedValue({
        valid: false,
        error: 'revoked',
      } as any);

      const result = await authService.refresh(validToken);

      expect(result).toEqual({
        success: false,
        error: 'revoked_token',
      });
    });

    it('should return invalid_token when rotation returns null and verification says invalid/malformed', async () => {
      vi.mocked(jwtService.rotateRefreshToken).mockResolvedValue(null);
      vi.mocked(jwtService.verifyRefreshToken).mockResolvedValue({
        valid: false,
        error: 'invalid',
      } as any);

      const result = await authService.refresh(validToken);

      expect(result).toEqual({
        success: false,
        error: 'invalid_token',
      });
    });

    it('should return internal error on exception', async () => {
      vi.mocked(jwtService.rotateRefreshToken).mockRejectedValue(new Error('Token error'));

      const result = await authService.refresh(validToken);

      expect(result).toEqual({
        success: false,
        error: 'internal',
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Token refresh failed'
      );
    });
  });

  describe('logout', () => {
    const validToken = 'valid-refresh-token';

    it('should return true and revoke token when token is valid', async () => {
      vi.mocked(jwtService.verifyRefreshToken).mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          jti: 'token-id',
        },
      } as any);

      const result = await authService.logout(validToken);

      expect(result).toBe(true);
      expect(jwtService.revokeToken).toHaveBeenCalledWith('token-id');
      expect(logger.debug).toHaveBeenCalledWith({ userId: 'user-123' }, 'User logged out');
    });

    it('should return true (idempotent) when token is invalid', async () => {
      vi.mocked(jwtService.verifyRefreshToken).mockResolvedValue({
        valid: false,
        error: 'invalid',
      } as any);

      const result = await authService.logout(validToken);

      expect(result).toBe(true);
      expect(jwtService.revokeToken).not.toHaveBeenCalled();
    });

    it('should return false on exception', async () => {
      vi.mocked(jwtService.verifyRefreshToken).mockRejectedValue(new Error('Verification error'));

      const result = await authService.logout(validToken);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Logout failed');
    });
  });

  describe('logoutAll', () => {
    const userId = 'user-123';

    it('should return count from jwtService.revokeAllUserTokens', async () => {
      vi.mocked(jwtService.revokeAllUserTokens).mockResolvedValue(3);

      const result = await authService.logoutAll(userId);

      expect(result).toBe(3);
      expect(jwtService.revokeAllUserTokens).toHaveBeenCalledWith(userId);
      expect(logger.info).toHaveBeenCalledWith(
        { userId, count: 3 },
        'User logged out from all devices'
      );
    });

    it('should return 0 on exception', async () => {
      vi.mocked(jwtService.revokeAllUserTokens).mockRejectedValue(new Error('Revocation error'));

      const result = await authService.logoutAll(userId);

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), userId },
        'Logout all failed'
      );
    });
  });

  describe('getProfile', () => {
    const userId = 'user-123';

    it('should return user profile from prisma', async () => {
      const profile = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
        isActive: true,
        rateLimit: 100,
        role: 'USER' as const,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(profile as any);

      const result = await authService.getProfile(userId);

      expect(result).toEqual({ ...profile, role: 'user' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
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
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await authService.getProfile('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const userId = 'user-123';
    const updateData = {
      name: 'Updated Name',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    };

    it('should update and return user profile', async () => {
      const updatedProfile = {
        id: userId,
        email: 'test@example.com',
        name: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        emailVerified: true,
        isActive: true,
        rateLimit: 100,
        role: 'USER' as const,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      };
      vi.mocked(prisma.user.update).mockResolvedValue(updatedProfile as any);

      const result = await authService.updateProfile(userId, updateData);

      expect(result).toEqual({ ...updatedProfile, role: 'user' });
    });

    it('should pass correct data to prisma.user.update', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ role: 'USER' } as any);

      await authService.updateProfile(userId, updateData);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
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
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'OldPassword123!';
    const newPassword = 'NewPassword123!';

    it('should return success after validating, verifying current, and hashing new', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        passwordHash: 'old-hash',
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: true,
        needsRehash: false,
      });
      vi.mocked(passwordService.hash).mockResolvedValue('new-hash');

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({ success: true });
      expect(passwordService.validate).toHaveBeenCalledWith(newPassword);
      expect(passwordService.verify).toHaveBeenCalledWith(currentPassword, 'old-hash');
      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: 'new-hash' },
      });
      expect(logger.info).toHaveBeenCalledWith({ userId }, 'Password changed successfully');
    });

    it('should return error when new password validation fails', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([
        'Password must be at least 8 characters',
      ]);

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({
        success: false,
        error: 'Password must be at least 8 characters',
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return error when no passwordHash set (OAuth-only)', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        passwordHash: null,
      } as any);

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({
        success: false,
        error: 'No password set for this account',
      });
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('should return error when current password is incorrect', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        passwordHash: 'old-hash',
      } as any);
      vi.mocked(passwordService.verify).mockResolvedValue({
        valid: false,
        needsRehash: false,
      });

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({
        success: false,
        error: 'Current password is incorrect',
      });
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('should return error message from first validation error', async () => {
      vi.mocked(passwordService.validate).mockReturnValue([
        'Password must be at least 8 characters',
        'Password must contain an uppercase letter',
      ]);

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    });

    it('should return error on exception', async () => {
      vi.mocked(passwordService.validate).mockImplementation(() => {
        throw new Error('Validation error');
      });

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toEqual({
        success: false,
        error: 'Failed to change password',
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), userId },
        'Password change failed'
      );
    });
  });

  describe('getSessions', () => {
    const userId = 'user-123';

    it('should delegate to jwtService.getUserSessions', async () => {
      const sessions = [
        {
          id: 'session-1',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ];
      vi.mocked(jwtService.getUserSessions).mockResolvedValue(sessions as any);

      const result = await authService.getSessions(userId);

      expect(result).toEqual(sessions);
      expect(jwtService.getUserSessions).toHaveBeenCalledWith(userId);
    });

    it('should return result from jwtService', async () => {
      const sessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '10.0.0.1',
          createdAt: new Date('2026-01-02T00:00:00Z'),
        },
        {
          id: 'session-2',
          userAgent: 'Firefox',
          ipAddress: '10.0.0.2',
          createdAt: new Date('2026-01-03T00:00:00Z'),
        },
      ];
      vi.mocked(jwtService.getUserSessions).mockResolvedValue(sessions as any);

      const result = await authService.getSessions(userId);

      expect(result).toEqual(sessions);
    });
  });

  describe('revokeSession', () => {
    const userId = 'user-123';
    const sessionId = 'session-1';

    it('should return true and revoke when session belongs to user', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: sessionId,
        userId,
      } as any);

      const result = await authService.revokeSession(userId, sessionId);

      expect(result).toBe(true);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: sessionId },
        select: { userId: true },
      });
      expect(jwtService.revokeToken).toHaveBeenCalledWith(sessionId);
    });

    it('should return false when session not found', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      const result = await authService.revokeSession(userId, sessionId);

      expect(result).toBe(false);
      expect(jwtService.revokeToken).not.toHaveBeenCalled();
    });

    it('should return false when session belongs to different user', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: sessionId,
        userId: 'different-user-id',
      } as any);

      const result = await authService.revokeSession(userId, sessionId);

      expect(result).toBe(false);
      expect(jwtService.revokeToken).not.toHaveBeenCalled();
    });

    it('should return false on exception', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockRejectedValue(new Error('Database error'));

      const result = await authService.revokeSession(userId, sessionId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), userId, sessionId },
        'Session revocation failed'
      );
    });
  });
});
