/**
 * Password Service
 *
 * Handles secure password hashing and verification using Argon2id.
 * Follows OWASP recommendations for password storage.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */

import argon2 from 'argon2';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Result of password verification
 */
export interface PasswordVerifyResult {
  valid: boolean;
  needsRehash: boolean;
}

/**
 * Password Service singleton
 *
 * Uses Argon2id which provides resistance against:
 * - GPU cracking attacks (memory-hard)
 * - Side-channel attacks (data-independent memory access)
 * - Time-memory trade-off attacks
 */
export const passwordService = {
  /**
   * Hash a password using Argon2id
   *
   * @param password - Plain text password to hash
   * @returns Argon2id hash string (includes algorithm parameters)
   */
  async hash(password: string): Promise<string> {
    try {
      const hash = await argon2.hash(password, {
        type: argon2.argon2id, // Hybrid mode (argon2i + argon2d)
        memoryCost: config.argon2.memoryCost, // 64 MB
        timeCost: config.argon2.timeCost, // 3 iterations
        parallelism: config.argon2.parallelism, // 4 threads
        hashLength: 32, // 256 bits output
      });

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to hash password');
      throw new Error('Password hashing failed');
    }
  },

  /**
   * Verify a password against a stored hash
   *
   * Also checks if the hash needs to be upgraded (parameters changed)
   *
   * @param password - Plain text password to verify
   * @param hash - Stored Argon2id hash
   * @returns Verification result with rehash indicator
   */
  async verify(password: string, hash: string): Promise<PasswordVerifyResult> {
    try {
      const valid = await argon2.verify(hash, password);

      if (!valid) {
        return { valid: false, needsRehash: false };
      }

      // Check if hash needs to be upgraded (e.g., memory cost increased)
      // Note: needsRehash compares against current config parameters
      const needsRehash = argon2.needsRehash(hash, {
        memoryCost: config.argon2.memoryCost,
        timeCost: config.argon2.timeCost,
        parallelism: config.argon2.parallelism,
      });

      return { valid: true, needsRehash };
    } catch (error) {
      // Log but don't expose error details (could be timing attack vector)
      logger.warn({ error }, 'Password verification error');
      return { valid: false, needsRehash: false };
    }
  },

  /**
   * Validate password strength requirements
   *
   * Requirements:
   * - Minimum 8 characters
   * - Maximum 128 characters (prevent DoS via very long passwords)
   * - At least one lowercase letter
   * - At least one uppercase letter
   * - At least one digit
   * - At least one special character
   *
   * @param password - Password to validate
   * @returns Array of validation error messages (empty if valid)
   */
  validateStrength(password: string): string[] {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return errors;
  },

  /**
   * Check if a password is in a list of commonly breached passwords
   *
   * This is a basic check - in production, consider integrating with
   * Have I Been Pwned's Passwords API (k-anonymity model)
   *
   * @param password - Password to check
   * @returns true if password appears compromised
   */
  isCommonPassword(password: string): boolean {
    // Top 20 most common passwords (simplified check)
    // In production, use HIBP API or a larger local list
    const commonPasswords = new Set([
      '123456',
      'password',
      '12345678',
      'qwerty',
      '123456789',
      '12345',
      '1234',
      '111111',
      '1234567',
      'dragon',
      '123123',
      'baseball',
      'iloveyou',
      'trustno1',
      'sunshine',
      'master',
      'welcome',
      'shadow',
      'ashley',
      'football',
      'password1',
      'Password1',
      'Password123',
      'Qwerty123',
      'letmein',
      'admin',
      'abc123',
      'monkey',
      '1234567890',
    ]);

    return commonPasswords.has(password) || commonPasswords.has(password.toLowerCase());
  },

  /**
   * Full password validation including strength and common password check
   *
   * @param password - Password to validate
   * @returns Array of all validation errors (empty if valid)
   */
  validate(password: string): string[] {
    const errors = this.validateStrength(password);

    if (this.isCommonPassword(password)) {
      errors.push('This password is too common and has been found in data breaches');
    }

    return errors;
  },

  /**
   * Generate a secure random password
   *
   * Useful for temporary passwords or password reset flows
   *
   * @param length - Desired password length (default: 16)
   * @returns Random password meeting all strength requirements
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = lowercase + uppercase + digits + special;

    // Helper to get random character from string (index is always valid)
    const randomChar = (str: string): string => {
      const idx = Math.floor(Math.random() * str.length);
      return str.charAt(idx);
    };

    // Ensure at least one of each required character type
    const password: string[] = [
      randomChar(lowercase),
      randomChar(uppercase),
      randomChar(digits),
      randomChar(special),
    ];

    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      password.push(randomChar(all));
    }

    // Shuffle the password (Fisher-Yates)
    for (let i = password.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = password[i];
      password[i] = password[j] as string;
      password[j] = temp as string;
    }

    return password.join('');
  },
};

export type PasswordService = typeof passwordService;
