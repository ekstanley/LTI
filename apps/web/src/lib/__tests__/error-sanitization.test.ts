/**
 * M-1 Error Message Sanitization Test Suite
 *
 * Tests that error messages are properly sanitized to prevent
 * information disclosure vulnerabilities (CVSS 5.3)
 *
 * @security M-1: Prevents exposure of sensitive backend details
 * (database credentials, file paths, SQL queries, stack traces)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBill, ApiError } from '../api';

describe('M-1: Error Message Sanitization', () => {
  beforeEach(() => {
    // Reset all mocks before each test to prevent test pollution
    vi.restoreAllMocks();
  });

  describe('Known error codes return safe messages', () => {
    it('should sanitize DATABASE_ERROR and hide credentials', async () => {
      // Mock fetch to return a backend error with exposed credentials
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'DATABASE_ERROR',
          message: 'Connection failed: postgresql://admin:P@ssw0rd@db.internal:5432/ltip_prod',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe('A database error occurred. Please try again.');
        expect(error.message).not.toContain('postgresql://');
        expect(error.message).not.toContain('P@ssw0rd');
        expect(error.message).not.toContain('db.internal');
      }
    });

    it('should sanitize AUTH_INVALID_CREDENTIALS and hide SQL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'SELECT * FROM users WHERE email=admin@internal.db returned 0 rows',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Invalid username or password.');
        expect(error.message).not.toContain('SELECT');
        expect(error.message).not.toContain('admin@internal.db');
      }
    });

    it('should sanitize CSRF_TOKEN_INVALID and hide file paths', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'CSRF_TOKEN_INVALID',
          message: 'Token verification failed at /var/app/middleware/csrf.js:142',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Security token invalid. Please refresh and try again.');
        expect(error.message).not.toContain('/var/app/');
        expect(error.message).not.toContain('csrf.js');
      }
    });

    it('should sanitize INTERNAL_ERROR and hide stack traces', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'INTERNAL_ERROR',
          message: 'Uncaught exception in module /app/src/controllers/bills.ts at processRequest()',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An internal error occurred. Please try again later.');
        expect(error.message).not.toContain('/app/src/');
        expect(error.message).not.toContain('bills.ts');
        expect(error.message).not.toContain('processRequest');
      }
    });
  });

  describe('Unknown error codes return fallback message', () => {
    it('should return fallback for unknown error code and hide sensitive data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'SOME_UNKNOWN_ERROR_CODE',
          message: 'Secret internal error with sensitive data: API_KEY=sk-1234567890abcdef',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.message).not.toContain('API_KEY');
        expect(error.message).not.toContain('sk-1234567890abcdef');
      }
    });

    it('should return fallback when error code is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          message: 'Stack trace: Error at Function.execute (/app/node_modules/sequelize/lib/query.js:123)',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.message).not.toContain('Stack trace');
        expect(error.message).not.toContain('sequelize');
      }
    });
  });

  describe('Comprehensive security validation', () => {
    it('should never expose database connection strings', async () => {
      const sensitiveStrings = [
        'postgresql://user:pass@localhost:5432/db',
        'mysql://root:secret@db.internal:3306/production',
      ];

      for (const sensitiveString of sensitiveStrings) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
          json: async () => ({
            code: 'UNKNOWN_CODE',
            message: sensitiveString,
          }),
        });

        try {
          await getBill('test-bill-id');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toBe('An unexpected error occurred. Please try again.');
          expect(error.message).not.toContain('postgresql://');
          expect(error.message).not.toContain('mysql://');
          expect(error.message).not.toContain('password');
          expect(error.message).not.toContain('secret');
        }
      }
    });

    it('should never expose file system paths', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'UNKNOWN_CODE',
          message: '/var/www/app/config/database.yml contains invalid schema',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.message).not.toContain('/var/www/');
        expect(error.message).not.toContain('database.yml');
      }
    });

    it('should never expose SQL queries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'UNKNOWN_CODE',
          message: 'Query failed: SELECT * FROM users WHERE password = "admin123"',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.message).not.toContain('SELECT');
        expect(error.message).not.toContain('admin123');
      }
    });
  });

  describe('All critical error codes', () => {
    const criticalErrorCodes = [
      { code: 'AUTH_INVALID_CREDENTIALS', expected: 'Invalid username or password.' },
      { code: 'DATABASE_ERROR', expected: 'A database error occurred. Please try again.' },
      { code: 'CSRF_TOKEN_INVALID', expected: 'Security token invalid. Please refresh and try again.' },
      { code: 'VALIDATION_ERROR', expected: 'The provided data is invalid. Please check your input.' },
      { code: 'INTERNAL_ERROR', expected: 'An internal error occurred. Please try again later.' },
      { code: 'RESOURCE_NOT_FOUND', expected: 'The requested resource could not be found.' },
    ];

    criticalErrorCodes.forEach(({ code, expected }) => {
      it(`should sanitize ${code}`, async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
          json: async () => ({
            code,
            message: 'Sensitive backend error with credentials: postgresql://admin:pass@db.internal/prod',
          }),
        });

        try {
          await getBill('test-bill-id');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toBe(expected);
          expect(error.message).not.toContain('Sensitive');
          expect(error.message).not.toContain('postgresql://');
          expect(error.message).not.toContain('admin:pass'); // Check for actual credentials, not safe word "password"
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null error code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: null,
          message: 'Sensitive internal error',
        }),
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.message).not.toContain('Sensitive');
      }
    });

    it('should handle non-JSON error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      try {
        await getBill('test-bill-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should still create ApiError with safe message
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
      }
    });
  });
});
