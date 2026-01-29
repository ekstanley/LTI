/**
 * Retry Handler Unit Tests
 *
 * Tests for exponential backoff and retry logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  fetchWithRetry,
  calculateBackoffDelay,
  isRetryableResponse,
  isRetryableError,
  getRetryAfterMs,
  RetryExhaustedError,
} from '../../ingestion/retry-handler.js';

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateBackoffDelay', () => {
    it('calculates exponential delay without jitter', () => {
      const options = {
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        useJitter: false,
      };

      expect(calculateBackoffDelay(0, options)).toBe(1000);
      expect(calculateBackoffDelay(1, options)).toBe(2000);
      expect(calculateBackoffDelay(2, options)).toBe(4000);
      expect(calculateBackoffDelay(3, options)).toBe(8000);
    });

    it('caps delay at maxDelayMs', () => {
      const options = {
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        useJitter: false,
      };

      expect(calculateBackoffDelay(10, options)).toBe(5000);
    });

    it('applies jitter when enabled', () => {
      const options = {
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        useJitter: true,
      };

      // With jitter, delay should be between 0 and calculated max
      const delay = calculateBackoffDelay(2, options);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(4000);
    });
  });

  describe('isRetryableResponse', () => {
    it('returns true for retryable status codes', () => {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];

      for (const status of retryableStatuses) {
        const response = { status } as Response;
        expect(isRetryableResponse(response, retryableStatuses)).toBe(true);
      }
    });

    it('returns false for non-retryable status codes', () => {
      const retryableStatuses = [429, 500, 502, 503, 504];
      const response = { status: 400 } as Response;

      expect(isRetryableResponse(response, retryableStatuses)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      const networkErrors = [
        new Error('Network error'),
        new Error('timeout exceeded'),
        new Error('ECONNRESET'),
        new Error('ECONNREFUSED'),
        new Error('ENOTFOUND'),
        new Error('socket hang up'),
        new Error('fetch failed'),
      ];

      for (const error of networkErrors) {
        expect(isRetryableError(error)).toBe(true);
      }
    });

    it('returns false for non-network errors', () => {
      const otherErrors = [
        new Error('Invalid argument'),
        new Error('Not found'),
        new Error('Unauthorized'),
      ];

      for (const error of otherErrors) {
        expect(isRetryableError(error)).toBe(false);
      }
    });

    it('returns false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('returns result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        useJitter: false,
      });

      // Advance timer to allow retry
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('throws RetryExhaustedError after max retries', async () => {
      const error = new Error('Network error');
      const operation = vi.fn().mockRejectedValue(error);

      const promise = withRetry(operation, {
        maxRetries: 2,
        baseDelayMs: 10,
        useJitter: false,
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow(RetryExhaustedError);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('does not retry non-retryable errors', async () => {
      const error = new Error('Invalid input');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          isRetryable: () => false,
        })
      ).rejects.toThrow('Invalid input');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
      const onRetry = vi.fn();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        useJitter: false,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });

  describe('fetchWithRetry', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns response on success', async () => {
      const mockResponse = { ok: true, status: 200 } as Response;
      vi.mocked(fetch).mockResolvedValue(mockResponse);

      const result = await fetchWithRetry('https://api.example.com');

      expect(result).toBe(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 status', async () => {
      const retryableResponse = { ok: false, status: 429, statusText: 'Too Many Requests' } as Response;
      const successResponse = { ok: true, status: 200 } as Response;

      vi.mocked(fetch)
        .mockResolvedValueOnce(retryableResponse)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry('https://api.example.com', undefined, {
        maxRetries: 3,
        baseDelayMs: 100,
        useJitter: false,
      });

      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;
      expect(result.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 status', async () => {
      const retryableResponse = { ok: false, status: 500, statusText: 'Server Error' } as Response;
      const successResponse = { ok: true, status: 200 } as Response;

      vi.mocked(fetch)
        .mockResolvedValueOnce(retryableResponse)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry('https://api.example.com', undefined, {
        maxRetries: 3,
        baseDelayMs: 100,
        useJitter: false,
      });

      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;
      expect(result.status).toBe(200);
    });

    it('does not retry on 400 status', async () => {
      const response = { ok: false, status: 400, statusText: 'Bad Request' } as Response;
      vi.mocked(fetch).mockResolvedValue(response);

      const result = await fetchWithRetry('https://api.example.com');

      expect(result.status).toBe(400);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRetryAfterMs', () => {
    it('parses delta-seconds format', () => {
      const response = {
        headers: new Headers({ 'Retry-After': '60' }),
      } as Response;

      expect(getRetryAfterMs(response)).toBe(60000);
    });

    it('parses HTTP-date format', () => {
      const futureDate = new Date(Date.now() + 30000);
      const response = {
        headers: new Headers({ 'Retry-After': futureDate.toUTCString() }),
      } as Response;

      const result = getRetryAfterMs(response);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(30000);
    });

    it('returns null when header not present', () => {
      const response = {
        headers: new Headers(),
      } as Response;

      expect(getRetryAfterMs(response)).toBeNull();
    });

    it('returns null for invalid format', () => {
      const response = {
        headers: new Headers({ 'Retry-After': 'invalid' }),
      } as Response;

      expect(getRetryAfterMs(response)).toBeNull();
    });
  });

  describe('RetryExhaustedError', () => {
    it('includes attempt count and last error', () => {
      const lastError = new Error('Network error');
      const error = new RetryExhaustedError('Failed after 3 attempts', 3, lastError);

      expect(error.name).toBe('RetryExhaustedError');
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBe(lastError);
      expect(error.message).toBe('Failed after 3 attempts');
    });
  });
});
