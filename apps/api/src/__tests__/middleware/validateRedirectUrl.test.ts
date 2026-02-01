/**
 * OAuth Redirect URL Validation Tests
 *
 * Tests for validateRedirectUrl middleware to prevent open redirect attacks (CWE-601).
 * Ensures only pre-approved origins can be used as OAuth redirect destinations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRedirectUrl } from '../../middleware/validateRedirectUrl.js';
import { config } from '../../config.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config module
vi.mock('../../config.js', () => ({
  config: {
    nodeEnv: 'production',
    corsOrigins: ['https://ltip.gov', 'https://app.ltip.gov'],
  },
}));

// Type-safe config mock manipulation
interface WritableConfig {
  nodeEnv: string;
  corsOrigins: string[];
}

describe('validateRedirectUrl', () => {
  beforeEach(() => {
    // Reset config to production defaults before each test
    // Note: We directly modify the mocked config object
    (config as WritableConfig).nodeEnv = 'production';
    (config as WritableConfig).corsOrigins = ['https://ltip.gov', 'https://app.ltip.gov'];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('undefined/null URLs', () => {
    it('allows undefined redirect URL (will use application default)', () => {
      const result = validateRedirectUrl(undefined);

      expect(result).toBe(true);
    });

    it('allows empty string redirect URL', () => {
      const result = validateRedirectUrl('');

      // Empty string will be treated as falsy and allowed
      expect(result).toBe(true);
    });
  });

  describe('production mode - allowlist enforcement', () => {
    it('allows redirect URL matching CORS origins allowlist', () => {
      const result = validateRedirectUrl('https://ltip.gov/dashboard');

      expect(result).toBe(true);
    });

    it('allows redirect URL with different path on allowed origin', () => {
      const result = validateRedirectUrl('https://app.ltip.gov/auth/callback');

      expect(result).toBe(true);
    });

    it('allows redirect URL with query parameters on allowed origin', () => {
      const result = validateRedirectUrl('https://ltip.gov/dashboard?tab=bills');

      expect(result).toBe(true);
    });

    it('allows redirect URL with hash fragment on allowed origin', () => {
      const result = validateRedirectUrl('https://app.ltip.gov/home#section');

      expect(result).toBe(true);
    });

    it('rejects redirect URL not in CORS origins allowlist', () => {
      const result = validateRedirectUrl('https://evil.com/phishing');

      expect(result).toBe(false);
    });

    it('rejects subdomain not in allowlist', () => {
      const result = validateRedirectUrl('https://malicious.ltip.gov/fake-login');

      expect(result).toBe(false);
    });

    it('rejects different port on allowed domain', () => {
      // Origin matching is strict: https://ltip.gov:8080 ≠ https://ltip.gov
      const result = validateRedirectUrl('https://ltip.gov:8080/dashboard');

      expect(result).toBe(false);
    });

    it('rejects HTTP when HTTPS is in allowlist', () => {
      // Protocol matters for origin matching
      const result = validateRedirectUrl('http://ltip.gov/dashboard');

      expect(result).toBe(false);
    });

    it('rejects URL with different TLD', () => {
      const result = validateRedirectUrl('https://ltip.com/fake');

      expect(result).toBe(false);
    });

    it('rejects homograph/IDN attack attempt', () => {
      // Internationalized domain name that looks similar
      const result = validateRedirectUrl('https://ltíp.gov/phishing');

      expect(result).toBe(false);
    });
  });

  describe('development mode - localhost support', () => {
    beforeEach(() => {
      (config as WritableConfig).nodeEnv = 'development';
    });

    it('allows localhost on any port in development', () => {
      const result = validateRedirectUrl('http://localhost:3000/auth/callback');

      expect(result).toBe(true);
    });

    it('allows localhost on port 80', () => {
      const result = validateRedirectUrl('http://localhost/dashboard');

      expect(result).toBe(true);
    });

    it('allows localhost with HTTPS in development', () => {
      const result = validateRedirectUrl('https://localhost:3443/secure');

      expect(result).toBe(true);
    });

    it('still enforces allowlist for non-localhost URLs in development', () => {
      const result = validateRedirectUrl('https://evil.com/phishing');

      expect(result).toBe(false);
    });

    it('rejects 127.0.0.1 in development (only localhost hostname allowed)', () => {
      // We only allow "localhost" hostname, not IP addresses
      const result = validateRedirectUrl('http://127.0.0.1:3000/callback');

      expect(result).toBe(false);
    });
  });

  describe('malformed URL handling', () => {
    it('rejects relative URL path', () => {
      const result = validateRedirectUrl('/dashboard');

      expect(result).toBe(false);
    });

    it('rejects relative URL with query', () => {
      const result = validateRedirectUrl('/auth/callback?code=123');

      expect(result).toBe(false);
    });

    it('rejects URL without protocol', () => {
      const result = validateRedirectUrl('ltip.gov/dashboard');

      expect(result).toBe(false);
    });

    it('rejects URL with invalid protocol', () => {
      const result = validateRedirectUrl('javascript:alert(1)');

      expect(result).toBe(false);
    });

    it('rejects URL with data protocol', () => {
      const result = validateRedirectUrl('data:text/html,<script>alert(1)</script>');

      expect(result).toBe(false);
    });

    it('rejects URL with file protocol', () => {
      const result = validateRedirectUrl('file:///etc/passwd');

      expect(result).toBe(false);
    });

    it('rejects completely malformed URL', () => {
      const result = validateRedirectUrl('not-a-valid-url-at-all');

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles URL with unicode characters', () => {
      const result = validateRedirectUrl('https://ltip.gov/路径');

      expect(result).toBe(true);
    });

    it('handles URL with percent-encoded characters', () => {
      const result = validateRedirectUrl('https://ltip.gov/path%20with%20spaces');

      expect(result).toBe(true);
    });

    it('handles URL with multiple query parameters', () => {
      const result = validateRedirectUrl('https://app.ltip.gov/callback?code=123&state=abc&scope=read');

      expect(result).toBe(true);
    });

    it('handles very long URL path', () => {
      const longPath = '/'.repeat(1000) + 'dashboard';
      const result = validateRedirectUrl(`https://ltip.gov${longPath}`);

      expect(result).toBe(true);
    });

    it('handles URL with empty query value', () => {
      const result = validateRedirectUrl('https://ltip.gov/dashboard?tab=');

      expect(result).toBe(true);
    });
  });

  describe('allowlist configuration variations', () => {
    it('works with single origin in allowlist', () => {
      (config as WritableConfig).corsOrigins = ['https://ltip.gov'];

      const result1 = validateRedirectUrl('https://ltip.gov/dashboard');
      const result2 = validateRedirectUrl('https://app.ltip.gov/dashboard');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('works with multiple origins in allowlist', () => {
      (config as WritableConfig).corsOrigins = [
        'https://ltip.gov',
        'https://app.ltip.gov',
        'https://admin.ltip.gov',
      ];

      const result1 = validateRedirectUrl('https://ltip.gov/dashboard');
      const result2 = validateRedirectUrl('https://app.ltip.gov/dashboard');
      const result3 = validateRedirectUrl('https://admin.ltip.gov/dashboard');
      const result4 = validateRedirectUrl('https://evil.com/phishing');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(result4).toBe(false);
    });

    it('works with empty allowlist (rejects all)', () => {
      (config as WritableConfig).corsOrigins = [];

      const result = validateRedirectUrl('https://ltip.gov/dashboard');

      expect(result).toBe(false);
    });
  });
});
