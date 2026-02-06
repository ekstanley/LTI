/**
 * Password Service Tests
 *
 * Tests password hashing, verification, validation, and generation.
 * Mocks argon2 and logger to isolate service behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock argon2 before importing
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
    needsRehash: vi.fn(),
    argon2id: 2, // Enum value matching argon2 library
  },
}));

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import argon2 from 'argon2';
import { passwordService } from '../../services/password.service.js';
import { logger } from '../../lib/logger.js';

describe('PasswordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hash', () => {
    it('produces a hash string for valid password', async () => {
      const password = 'Test123!@#';
      const expectedHash = '$argon2id$v=19$m=65536,t=3,p=4$...';

      vi.mocked(argon2.hash).mockResolvedValue(expectedHash);

      const result = await passwordService.hash(password);

      expect(result).toBe(expectedHash);
      expect(argon2.hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        hashLength: 32,
      });
    });

    it('uses argon2id algorithm', async () => {
      const password = 'Test123!@#';
      vi.mocked(argon2.hash).mockResolvedValue('$argon2id$...');

      await passwordService.hash(password);

      expect(argon2.hash).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: argon2.argon2id,
        })
      );
    });

    it('produces different hashes for same input (salted)', async () => {
      const password = 'Test123!@#';
      const hash1 = '$argon2id$v=19$m=65536,t=3,p=4$salt1$hash1';
      const hash2 = '$argon2id$v=19$m=65536,t=3,p=4$salt2$hash2';

      vi.mocked(argon2.hash)
        .mockResolvedValueOnce(hash1)
        .mockResolvedValueOnce(hash2);

      const result1 = await passwordService.hash(password);
      const result2 = await passwordService.hash(password);

      expect(result1).not.toBe(result2);
    });

    it('throws error on argon2 internal error', async () => {
      const password = 'Test123!@#';
      const error = new Error('Argon2 internal error');

      vi.mocked(argon2.hash).mockRejectedValue(error);

      await expect(passwordService.hash(password)).rejects.toThrow('Password hashing failed');
      expect(logger.error).toHaveBeenCalledWith({ error }, 'Failed to hash password');
    });
  });

  describe('verify', () => {
    it('returns valid:true for correct password match', async () => {
      const password = 'Test123!@#';
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$...';

      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.needsRehash).mockReturnValue(false);

      const result = await passwordService.verify(password, hash);

      expect(result).toEqual({ valid: true, needsRehash: false });
      expect(argon2.verify).toHaveBeenCalledWith(hash, password);
    });

    it('returns valid:false for incorrect password', async () => {
      const password = 'WrongPassword123!';
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$...';

      vi.mocked(argon2.verify).mockResolvedValue(false);

      const result = await passwordService.verify(password, hash);

      expect(result).toEqual({ valid: false, needsRehash: false });
    });

    it('returns needsRehash:false when config matches', async () => {
      const password = 'Test123!@#';
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$...';

      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.needsRehash).mockReturnValue(false);

      const result = await passwordService.verify(password, hash);

      expect(result.needsRehash).toBe(false);
      expect(argon2.needsRehash).toHaveBeenCalledWith(hash, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    });

    it('returns needsRehash:true when config changed', async () => {
      const password = 'Test123!@#';
      const hash = '$argon2id$v=19$m=32768,t=2,p=2$...'; // Old params

      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.needsRehash).mockReturnValue(true); // Needs upgrade

      const result = await passwordService.verify(password, hash);

      expect(result).toEqual({ valid: true, needsRehash: true });
    });

    it('returns valid:false on argon2 error (graceful)', async () => {
      const password = 'Test123!@#';
      const hash = 'invalid-hash';
      const error = new Error('Invalid hash format');

      vi.mocked(argon2.verify).mockRejectedValue(error);

      const result = await passwordService.verify(password, hash);

      expect(result).toEqual({ valid: false, needsRehash: false });
      expect(logger.warn).toHaveBeenCalledWith({ error }, 'Password verification error');
    });
  });

  describe('validateStrength', () => {
    it('accepts strong password meeting all rules', () => {
      const password = 'StrongP@ssw0rd';

      const errors = passwordService.validateStrength(password);

      expect(errors).toEqual([]);
    });

    it('rejects password shorter than minimum length', () => {
      const password = 'Sh0rt!';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects password longer than maximum length', () => {
      const password = 'A'.repeat(129) + 'a1!';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must not exceed 128 characters');
    });

    it('requires lowercase letter', () => {
      const password = 'UPPERCASE123!';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must contain at least one lowercase letter');
    });

    it('requires uppercase letter', () => {
      const password = 'lowercase123!';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must contain at least one uppercase letter');
    });

    it('requires digit', () => {
      const password = 'NoDigits!@#';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must contain at least one digit');
    });

    it('requires special character', () => {
      const password = 'NoSpecial123';

      const errors = passwordService.validateStrength(password);

      expect(errors).toContain('Password must contain at least one special character');
    });

    it('returns multiple errors for multiple violations', () => {
      const password = 'weak';

      const errors = passwordService.validateStrength(password);

      expect(errors).toHaveLength(4); // Too short, no uppercase, no digit, no special
      expect(errors).toContain('Password must be at least 8 characters long');
      expect(errors).toContain('Password must contain at least one uppercase letter');
      expect(errors).toContain('Password must contain at least one digit');
      expect(errors).toContain('Password must contain at least one special character');
    });

    it('accepts password at exact minimum length', () => {
      const password = 'Good123!';

      const errors = passwordService.validateStrength(password);

      expect(errors).toEqual([]);
    });

    it('accepts all valid special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{};\':"|,.<>/?`~';
      const basePassword = 'Pass123';

      for (const char of specialChars) {
        const password = basePassword + char;
        const errors = passwordService.validateStrength(password);

        expect(errors).not.toContain('Password must contain at least one special character');
      }
    });
  });

  describe('isCommonPassword', () => {
    it('detects common passwords', () => {
      expect(passwordService.isCommonPassword('password')).toBe(true);
      expect(passwordService.isCommonPassword('123456')).toBe(true);
      expect(passwordService.isCommonPassword('qwerty')).toBe(true);
      expect(passwordService.isCommonPassword('admin')).toBe(true);
    });

    it('case-insensitive detection', () => {
      expect(passwordService.isCommonPassword('PASSWORD')).toBe(true);
      expect(passwordService.isCommonPassword('Password')).toBe(true);
      expect(passwordService.isCommonPassword('PaSsWoRd')).toBe(true);
    });

    it('detects mixed-case common passwords', () => {
      expect(passwordService.isCommonPassword('Password1')).toBe(true);
      expect(passwordService.isCommonPassword('Password123')).toBe(true);
      expect(passwordService.isCommonPassword('Qwerty123')).toBe(true);
    });

    it('does not flag uncommon passwords', () => {
      expect(passwordService.isCommonPassword('UniqueP@ssw0rd123')).toBe(false);
      expect(passwordService.isCommonPassword('MyS3cur3P@ss!')).toBe(false);
      expect(passwordService.isCommonPassword('Th1s1sN0tC0mm0n!')).toBe(false);
    });
  });

  describe('validate', () => {
    it('combines strength and common password checks', () => {
      const password = 'StrongP@ssw0rd123';

      const errors = passwordService.validate(password);

      expect(errors).toEqual([]);
    });

    it('returns common password error', () => {
      const password = 'password';

      const errors = passwordService.validate(password);

      expect(errors).toContain('This password is too common and has been found in data breaches');
    });

    it('returns multiple errors for weak common password', () => {
      const password = 'password'; // Common + missing uppercase + missing digit + missing special

      const errors = passwordService.validate(password);

      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('This password is too common and has been found in data breaches');
    });

    it('returns empty array for valid strong password', () => {
      const password = 'V3ry$tr0ngP@ssw0rd!';

      const errors = passwordService.validate(password);

      expect(errors).toEqual([]);
    });

    it('returns strength errors even if not common', () => {
      const password = 'short';

      const errors = passwordService.validate(password);

      expect(errors).not.toContain('This password is too common and has been found in data breaches');
      expect(errors.length).toBeGreaterThan(0); // Has strength errors
    });
  });

  describe('generateSecurePassword', () => {
    it('generates password of specified length', () => {
      const length = 16;

      const password = passwordService.generateSecurePassword(length);

      expect(password).toHaveLength(length);
    });

    it('generates password of custom length', () => {
      const length = 24;

      const password = passwordService.generateSecurePassword(length);

      expect(password).toHaveLength(length);
    });

    it('includes required character types', () => {
      const password = passwordService.generateSecurePassword(16);

      // Should pass validation (includes all required types)
      const errors = passwordService.validateStrength(password);

      expect(errors).toEqual([]);
      expect(/[a-z]/.test(password)).toBe(true); // Has lowercase
      expect(/[A-Z]/.test(password)).toBe(true); // Has uppercase
      expect(/\d/.test(password)).toBe(true); // Has digit
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(true); // Has special
    });

    it('generates different passwords each call', () => {
      const password1 = passwordService.generateSecurePassword(16);
      const password2 = passwordService.generateSecurePassword(16);
      const password3 = passwordService.generateSecurePassword(16);

      // Extremely unlikely to be the same (cryptographically secure random)
      expect(password1).not.toBe(password2);
      expect(password2).not.toBe(password3);
      expect(password1).not.toBe(password3);
    });

    it('generates minimum viable password length', () => {
      // Minimum length to include all 4 required types
      const password = passwordService.generateSecurePassword(8);

      expect(password).toHaveLength(8);
      expect(passwordService.validateStrength(password)).toEqual([]);
    });

    it('does not produce common passwords', () => {
      // Generate multiple passwords and check none are common
      const passwords = Array.from({ length: 10 }, () =>
        passwordService.generateSecurePassword(12)
      );

      for (const password of passwords) {
        expect(passwordService.isCommonPassword(password)).toBe(false);
      }
    });

    it('uses default length when not specified', () => {
      const password = passwordService.generateSecurePassword();

      expect(password).toHaveLength(16); // Default length
    });
  });
});
