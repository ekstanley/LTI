/**
 * OAuth Redirect URL Validation Tests
 *
 * SECURITY: Tests for CWE-601 (Open Redirect) prevention in OAuth flows
 * Validates that only pre-approved redirect URLs are accepted
 *
 * Test Coverage: 15 tests
 * - Valid redirect URLs (localhost development, production origins)
 * - Invalid redirect URLs (external domains, phishing attempts)
 * - Edge cases (null, empty, malformed URLs, subdomain attacks)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock logger to prevent initialization errors
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('OAuth Redirect URL Validation', () => {
  beforeEach(() => {
    // Clear module cache before each test to allow fresh config imports
    vi.resetModules();
    // Mock logger for all tests
    vi.doMock('../../lib/logger.js', () => ({
      logger: mockLogger,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('Development Environment - Localhost', () => {
    beforeEach(() => {
      vi.resetModules();
      // Mock logger
      vi.doMock('../../lib/logger.js', () => ({
        logger: mockLogger,
      }));
      // Mock config for development mode
      vi.doMock('../../config.js', () => ({
        config: {
          nodeEnv: 'development',
          isDev: true,
          isProd: false,
          corsOrigins: ['http://localhost:3000'],
        },
      }));
    });

    it('should allow localhost with default port', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('http://localhost:3000/auth/callback');
      expect(result).toBe(true);
    });

    it('should allow localhost with custom port', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('http://localhost:4000/auth/callback');
      expect(result).toBe(true);
    });

    it('should allow localhost with HTTPS', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://localhost:3000/auth/callback');
      expect(result).toBe(true);
    });

    it('should reject non-localhost domains in development', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://evil.com/phishing');
      expect(result).toBe(false);
    });
  });

  describe('Production Environment - Allowlist Validation', () => {
    beforeEach(() => {
      vi.resetModules();
      // Mock logger
      vi.doMock('../../lib/logger.js', () => ({
        logger: mockLogger,
      }));
      // Mock config for production mode
      vi.doMock('../../config.js', () => ({
        config: {
          nodeEnv: 'production',
          isDev: false,
          isProd: true,
          corsOrigins: ['https://app.ltip.gov', 'https://ltip.gov'],
        },
      }));
    });

    it('should allow redirect to approved origin', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://app.ltip.gov/auth/callback');
      expect(result).toBe(true);
    });

    it('should reject redirect to unapproved external domain', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://evil.com/phishing');
      expect(result).toBe(false);
    });

    it('should reject redirect to subdomain attack', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://evil.app.ltip.gov.evil.com/phishing');
      expect(result).toBe(false);
    });

    it('should reject redirect with suspicious path', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://evil.com/callback?redirect=https://app.ltip.gov');
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Attack Vectors', () => {
    beforeEach(() => {
      vi.resetModules();
      // Mock logger
      vi.doMock('../../lib/logger.js', () => ({
        logger: mockLogger,
      }));
      // Mock config for production mode with single origin
      vi.doMock('../../config.js', () => ({
        config: {
          nodeEnv: 'production',
          isDev: false,
          isProd: true,
          corsOrigins: ['https://app.ltip.gov'],
        },
      }));
    });

    it('should allow undefined redirect URL (will use application default)', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl(undefined);
      expect(result).toBe(true);
    });

    it('should allow empty string (will use application default)', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('');
      expect(result).toBe(true);
    });

    it('should reject malformed URL', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('not-a-valid-url');
      expect(result).toBe(false);
    });

    it('should reject relative URL path', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('/auth/callback');
      expect(result).toBe(false);
    });

    it('should reject javascript: protocol (XSS attempt)', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('javascript:alert(document.cookie)');
      expect(result).toBe(false);
    });

    it('should reject data: protocol (XSS attempt)', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('data:text/html,<script>alert(1)</script>');
      expect(result).toBe(false);
    });

    it('should reject open redirect with @ symbol', async () => {
      const { validateRedirectUrl } = await import('../../middleware/validateRedirectUrl.js');
      const result = validateRedirectUrl('https://app.ltip.gov@evil.com/phishing');
      expect(result).toBe(false);
    });
  });
});
