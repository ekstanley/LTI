/**
 * Tests for centralized environment configuration
 * @module config/__tests__/env.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to test module-level evaluation, so we dynamically import
// after setting env vars

describe('config/env', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('parseEnvInt (tested via config exports)', () => {
    it('should use default when env var is undefined', async () => {
      delete process.env.NEXT_PUBLIC_API_MAX_RETRIES;
      const { apiConfig } = await import('../env');
      expect(apiConfig.maxRetries).toBe(3);
    });

    it('should use default when env var is empty string', async () => {
      process.env.NEXT_PUBLIC_API_MAX_RETRIES = '';
      const { apiConfig } = await import('../env');
      expect(apiConfig.maxRetries).toBe(3);
    });

    it('should use default when env var is NaN', async () => {
      process.env.NEXT_PUBLIC_API_MAX_RETRIES = 'not-a-number';
      const { apiConfig } = await import('../env');
      expect(apiConfig.maxRetries).toBe(3);
    });

    it('should parse valid integer from env var', async () => {
      process.env.NEXT_PUBLIC_API_MAX_RETRIES = '7';
      const { apiConfig } = await import('../env');
      expect(apiConfig.maxRetries).toBe(7);
    });

    it('should parse zero as valid integer', async () => {
      process.env.NEXT_PUBLIC_SWR_DEDUPING_INTERVAL = '0';
      const { swrConfig } = await import('../env');
      expect(swrConfig.dedupingInterval).toBe(0);
    });
  });

  describe('apiConfig defaults', () => {
    beforeEach(() => {
      // Clear all relevant env vars
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_API_MAX_RETRIES;
      delete process.env.NEXT_PUBLIC_API_INITIAL_BACKOFF_MS;
      delete process.env.NEXT_PUBLIC_API_MAX_BACKOFF_MS;
      delete process.env.NEXT_PUBLIC_API_MAX_CSRF_REFRESH_ATTEMPTS;
    });

    it('should have sensible defaults for all API config values', async () => {
      const { apiConfig } = await import('../env');
      expect(apiConfig.baseUrl).toBe('http://localhost:4000');
      expect(apiConfig.maxRetries).toBe(3);
      expect(apiConfig.initialBackoffMs).toBe(1000);
      expect(apiConfig.maxBackoffMs).toBe(30000);
      expect(apiConfig.maxCsrfRefreshAttempts).toBe(2);
    });

    it('should use custom API URL from env', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      const { apiConfig } = await import('../env');
      expect(apiConfig.baseUrl).toBe('https://api.example.com');
    });
  });

  describe('swrConfig defaults', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SWR_DEDUPING_INTERVAL;
      delete process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS;
    });

    it('should have sensible defaults for SWR config', async () => {
      const { swrConfig } = await import('../env');
      expect(swrConfig.dedupingInterval).toBe(5000);
      expect(swrConfig.revalidateOnFocus).toBe(false);
    });

    it('should enable revalidateOnFocus when env is "true"', async () => {
      process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS = 'true';
      const { swrConfig } = await import('../env');
      expect(swrConfig.revalidateOnFocus).toBe(true);
    });

    it('should keep revalidateOnFocus false for non-"true" values', async () => {
      process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS = 'yes';
      const { swrConfig } = await import('../env');
      expect(swrConfig.revalidateOnFocus).toBe(false);
    });
  });

  describe('combined config export', () => {
    it('should expose api and swr sub-configs', async () => {
      const { config } = await import('../env');
      expect(config).toHaveProperty('api');
      expect(config).toHaveProperty('swr');
      expect(config.api.baseUrl).toBeDefined();
      expect(config.swr.dedupingInterval).toBeDefined();
    });
  });
});
