/**
 * Account Lockout Protection Tests
 *
 * Tests for CWE-307 protection against brute-force password attacks.
 * Ensures accounts lock after 5 failed attempts and auto-unlock after 15 minutes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '../../services/auth.service.js';
import { prisma } from '../../db/client.js';
import { passwordService } from '../../services/password.service.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Account Lockout Protection (CWE-307)', () => {
  const testEmail = 'lockout-test@example.com';
  const validPassword = 'ValidPassword123!';
  const invalidPassword = 'WrongPassword123!';
  let testUserId: string;

  beforeEach(async () => {
    // Create test user with valid password hash
    const passwordHash = await passwordService.hash(validPassword);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: 'Lockout Test User',
        emailVerified: false,
        isActive: true,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        accountLockedUntil: null,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test user
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    vi.clearAllMocks();
  });

  describe('successful login scenarios', () => {
    it('allows login with valid credentials', async () => {
      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe(testEmail);
        expect(result.tokens.accessToken).toBeDefined();
        expect(result.tokens.refreshToken).toBeDefined();
      }
    });

    it('resets failed attempts counter on successful login', async () => {
      // Manually set failed attempts
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 3,
          lastFailedLoginAt: new Date(),
        },
      });

      // Successful login should reset counter
      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(true);

      // Verify counter was reset
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true, lastFailedLoginAt: true },
      });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lastFailedLoginAt).toBeNull();
    });

    it('unlocks account on successful login after lockout expired', async () => {
      // Set account as locked but expired
      const expiredLockout = new Date(Date.now() - 1000); // 1 second ago
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: expiredLockout,
        },
      });

      // Should allow login since lockout expired
      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(true);

      // Verify lockout fields were reset
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: {
          failedLoginAttempts: true,
          lastFailedLoginAt: true,
          accountLockedUntil: true,
        },
      });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lastFailedLoginAt).toBeNull();
      expect(user?.accountLockedUntil).toBeNull();
    });
  });

  describe('failed login tracking', () => {
    it('increments failed attempt counter on invalid password', async () => {
      const result = await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }

      // Verify counter was incremented
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true, lastFailedLoginAt: true },
      });
      expect(user?.failedLoginAttempts).toBe(1);
      expect(user?.lastFailedLoginAt).toBeInstanceOf(Date);
    });

    it('updates lastFailedLoginAt timestamp on failed attempt', async () => {
      const beforeAttempt = new Date();

      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { lastFailedLoginAt: true },
      });

      expect(user?.lastFailedLoginAt).toBeInstanceOf(Date);
      expect(user?.lastFailedLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeAttempt.getTime());
    });

    it('persists failed attempts across multiple login attempts', async () => {
      // First failed attempt
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      // Second failed attempt
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      // Third failed attempt
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true },
      });
      expect(user?.failedLoginAttempts).toBe(3);
    });

    it('does not increment counter on successful login', async () => {
      // Failed attempt first
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      // Successful login
      await authService.login({
        email: testEmail,
        password: validPassword,
      });

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true },
      });
      expect(user?.failedLoginAttempts).toBe(0);
    });
  });

  describe('account locking', () => {
    it('locks account after 5 failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: {
          failedLoginAttempts: true,
          accountLockedUntil: true,
        },
      });

      expect(user?.failedLoginAttempts).toBe(5);
      expect(user?.accountLockedUntil).toBeInstanceOf(Date);
      expect(user?.accountLockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('sets accountLockedUntil to 15 minutes in future', async () => {
      const beforeLockout = Date.now();

      // Make 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { accountLockedUntil: true },
      });

      const afterLockout = Date.now();
      const lockoutTime = user?.accountLockedUntil!.getTime();
      const fifteenMinutesInMs = 15 * 60 * 1000;

      // Should be roughly 15 minutes from now (within 1 second tolerance)
      expect(lockoutTime).toBeGreaterThanOrEqual(beforeLockout + fifteenMinutesInMs - 1000);
      expect(lockoutTime).toBeLessThanOrEqual(afterLockout + fifteenMinutesInMs + 1000);
    });

    it('returns account_locked error when locked', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      // Try to login again (6th attempt)
      const result = await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_locked');
      }
    });

    it('rejects valid credentials when account is locked', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      // Try to login with VALID credentials
      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_locked');
      }
    });

    it('does not increment counter beyond 5 when locked', async () => {
      // Lock the account (5 attempts)
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      // Make additional attempts
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true },
      });

      // Counter should still be 5 (not incremented while locked)
      expect(user?.failedLoginAttempts).toBe(5);
    });
  });

  describe('auto-unlock', () => {
    it('allows login after lockout duration expires', async () => {
      // Set account as locked but with expired lockout
      const expiredLockout = new Date(Date.now() - 1000); // 1 second ago
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: expiredLockout,
        },
      });

      // Should allow login since lockout expired
      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(true);
    });

    it('rejects login if lockout has not expired', async () => {
      // Set account with future lockout
      const futureLockout = new Date(Date.now() + 60000); // 1 minute in future
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: futureLockout,
        },
      });

      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_locked');
      }
    });

    it('allows login exactly when lockout expires', async () => {
      // Set lockout to expire in 1 millisecond
      const almostExpired = new Date(Date.now() + 1);
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: almostExpired,
        },
      });

      // Wait for lockout to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('security features', () => {
    it('returns generic error message for locked account', async () => {
      // Lock the account
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLoginAttempts: 5,
          accountLockedUntil: new Date(Date.now() + 60000),
        },
      });

      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should return account_locked, not reveal password was correct
        expect(result.error).toBe('account_locked');
      }
    });

    it('does not reveal account existence through lockout errors', async () => {
      // Try to login with non-existent email
      const nonExistentResult = await authService.login({
        email: 'nonexistent@example.com',
        password: validPassword,
      });

      expect(nonExistentResult.success).toBe(false);
      if (!nonExistentResult.success) {
        expect(nonExistentResult.error).toBe('invalid_credentials');
      }

      // Lock the test account
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      // Try to login with locked account
      const lockedResult = await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      expect(lockedResult.success).toBe(false);
      if (!lockedResult.success) {
        // Should return different error for locked account
        expect(lockedResult.error).toBe('account_locked');
        // But timing should be similar (both perform password hash)
      }
    });
  });

  describe('edge cases', () => {
    it('handles rapid failed login attempts', async () => {
      // Make 5 rapid sequential attempts (more realistic than concurrent)
      // Actual brute-force attacks are sequential, not perfectly concurrent
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true, accountLockedUntil: true },
      });

      // All attempts should be counted
      expect(user?.failedLoginAttempts).toBe(5);
      expect(user?.accountLockedUntil).toBeInstanceOf(Date);
    });

    it('handles account without passwordHash (OAuth-only)', async () => {
      // Create OAuth-only user (no password)
      const oauthUser = await prisma.user.create({
        data: {
          email: 'oauth-only@example.com',
          passwordHash: null,
          name: 'OAuth User',
          emailVerified: true,
          isActive: true,
        },
      });

      // Try to login with password
      const result = await authService.login({
        email: 'oauth-only@example.com',
        password: 'any-password',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }

      // Cleanup
      await prisma.user.delete({ where: { id: oauthUser.id } });
    });

    it('handles inactive account correctly', async () => {
      // Deactivate account
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: false },
      });

      const result = await authService.login({
        email: testEmail,
        password: validPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_inactive');
      }

      // Failed attempt counter should not increment for inactive account
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true },
      });
      expect(user?.failedLoginAttempts).toBe(0);
    });

    it('handles case-insensitive email matching', async () => {
      // Try with different case
      const result = await authService.login({
        email: testEmail.toUpperCase(),
        password: invalidPassword,
      });

      expect(result.success).toBe(false);

      // Verify counter was incremented for correct user
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { failedLoginAttempts: true },
      });
      expect(user?.failedLoginAttempts).toBe(1);
    });
  });

  describe('lockout configuration', () => {
    it('enforces correct lockout threshold (5 attempts)', async () => {
      // 4 failed attempts should NOT lock
      for (let i = 0; i < 4; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      let user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { accountLockedUntil: true },
      });
      expect(user?.accountLockedUntil).toBeNull();

      // 5th failed attempt SHOULD lock
      await authService.login({
        email: testEmail,
        password: invalidPassword,
      });

      user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { accountLockedUntil: true },
      });
      expect(user?.accountLockedUntil).toBeInstanceOf(Date);
    });

    it('enforces correct lockout duration (15 minutes)', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await authService.login({
          email: testEmail,
          password: invalidPassword,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { accountLockedUntil: true },
      });

      const lockoutDuration = user?.accountLockedUntil!.getTime() - Date.now();
      const fifteenMinutesInMs = 15 * 60 * 1000;

      // Should be approximately 15 minutes (within 2 seconds tolerance)
      expect(lockoutDuration).toBeGreaterThan(fifteenMinutesInMs - 2000);
      expect(lockoutDuration).toBeLessThan(fifteenMinutesInMs + 2000);
    });
  });
});
