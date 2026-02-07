/**
 * Config Schema Validation Tests
 *
 * Verifies that Zod min() constraints reject nonsensical values
 * (e.g., LOCKOUT_MAX_ATTEMPTS=0 would disable lockout protection).
 */

import { describe, it, expect } from 'vitest';
import { _envSchema } from '../config.js';

/**
 * Base env with all required defaults satisfied.
 * We parse against this, overriding individual fields to test constraints.
 */
const validEnv = {
  NODE_ENV: 'test',
};

function parseWith(overrides: Record<string, string>) {
  return _envSchema.safeParse({ ...validEnv, ...overrides });
}

describe('envSchema validation constraints', () => {
  it('should accept default values (no overrides)', () => {
    const result = _envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  describe('LOCKOUT_MAX_ATTEMPTS', () => {
    it('should reject 0 (would disable lockout)', () => {
      const result = parseWith({ LOCKOUT_MAX_ATTEMPTS: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      const result = parseWith({ LOCKOUT_MAX_ATTEMPTS: '-1' });
      expect(result.success).toBe(false);
    });

    it('should accept 1 (minimum valid)', () => {
      const result = parseWith({ LOCKOUT_MAX_ATTEMPTS: '1' });
      expect(result.success).toBe(true);
    });
  });

  describe('REDIS_MAX_RETRIES_PER_REQUEST', () => {
    it('should accept 0 (disables retries, valid)', () => {
      const result = parseWith({ REDIS_MAX_RETRIES_PER_REQUEST: '0' });
      expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
      const result = parseWith({ REDIS_MAX_RETRIES_PER_REQUEST: '-1' });
      expect(result.success).toBe(false);
    });
  });

  describe('REDIS_RETRY_MAX_DELAY_MS', () => {
    it('should reject value below 100ms', () => {
      const result = parseWith({ REDIS_RETRY_MAX_DELAY_MS: '50' });
      expect(result.success).toBe(false);
    });

    it('should accept 100ms (minimum)', () => {
      const result = parseWith({ REDIS_RETRY_MAX_DELAY_MS: '100' });
      expect(result.success).toBe(true);
    });
  });

  describe('LOCKOUT_WINDOW_SECONDS', () => {
    it('should reject 0', () => {
      const result = parseWith({ LOCKOUT_WINDOW_SECONDS: '0' });
      expect(result.success).toBe(false);
    });
  });

  describe('LOCKOUT_DURATION fields', () => {
    const durationFields = [
      'LOCKOUT_DURATION_FIRST',
      'LOCKOUT_DURATION_SECOND',
      'LOCKOUT_DURATION_THIRD',
      'LOCKOUT_DURATION_EXTENDED',
    ];

    for (const field of durationFields) {
      it(`should reject ${field}=0`, () => {
        const result = parseWith({ [field]: '0' });
        expect(result.success).toBe(false);
      });
    }
  });

  describe('REDIS_RETRY_MAX_ATTEMPTS', () => {
    it('should reject 0', () => {
      const result = parseWith({ REDIS_RETRY_MAX_ATTEMPTS: '0' });
      expect(result.success).toBe(false);
    });

    it('should accept 1', () => {
      const result = parseWith({ REDIS_RETRY_MAX_ATTEMPTS: '1' });
      expect(result.success).toBe(true);
    });
  });
});
