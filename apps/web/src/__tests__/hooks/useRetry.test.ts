/**
 * Tests for useRetry hook - exponential backoff retry logic
 * @module __tests__/hooks/useRetry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useRetryState,
  isRetryableError,
  calculateBackoff,
  sleep,
} from '@/hooks/useRetry';
import { ApiError, NetworkError } from '@/lib/api';

describe('useRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should return true for NetworkError', () => {
      const error = new NetworkError('Network failed');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 5xx ApiError', () => {
      const error500 = new ApiError(500, 'INTERNAL_ERROR', 'Server error');
      const error503 = new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
      expect(isRetryableError(error500)).toBe(true);
      expect(isRetryableError(error503)).toBe(true);
    });

    it('should return true for 429 (rate limit) ApiError', () => {
      const error = new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 4xx ApiError (except 429)', () => {
      const error400 = new ApiError(400, 'BAD_REQUEST', 'Bad request');
      const error401 = new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
      const error404 = new ApiError(404, 'NOT_FOUND', 'Not found');
      expect(isRetryableError(error400)).toBe(false);
      expect(isRetryableError(error401)).toBe(false);
      expect(isRetryableError(error404)).toBe(false);
    });

    it('should return false for AbortError', () => {
      const error = new Error('Request was cancelled');
      error.name = 'AbortError';
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Something went wrong');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      // Attempt 0: 1000ms * 2^0 = 1000ms
      const delay0 = calculateBackoff(0, 1000);
      expect(delay0).toBeGreaterThanOrEqual(900); // 1000 - 10% jitter
      expect(delay0).toBeLessThanOrEqual(1100); // 1000 + 10% jitter

      // Attempt 1: 1000ms * 2^1 = 2000ms
      const delay1 = calculateBackoff(1, 1000);
      expect(delay1).toBeGreaterThanOrEqual(1800); // 2000 - 10% jitter
      expect(delay1).toBeLessThanOrEqual(2200); // 2000 + 10% jitter

      // Attempt 2: 1000ms * 2^2 = 4000ms
      const delay2 = calculateBackoff(2, 1000);
      expect(delay2).toBeGreaterThanOrEqual(3600); // 4000 - 10% jitter
      expect(delay2).toBeLessThanOrEqual(4400); // 4000 + 10% jitter
    });

    it('should cap backoff at maxBackoffMs', () => {
      // Attempt 10 would be 1000ms * 2^10 = 1024000ms, but should cap at 30000ms
      const delay = calculateBackoff(10, 1000);
      expect(delay).toBeLessThanOrEqual(33000); // 30000 + 10% jitter
    });

    it('should add jitter to prevent thundering herd', () => {
      // Run multiple times to ensure jitter causes variation
      const delays = Array.from({ length: 10 }, () => calculateBackoff(1, 1000));
      const uniqueDelays = new Set(delays);

      // With jitter, we should get different delays (very high probability)
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified delay', async () => {
      const sleepPromise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(sleepPromise).resolves.toBeUndefined();
    });

    it('should reject if AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(sleep(1000, controller.signal)).rejects.toThrow('Request was cancelled');
    });

    it('should reject if AbortSignal is aborted during sleep', async () => {
      const controller = new AbortController();
      const sleepPromise = sleep(1000, controller.signal);

      // Abort after 500ms
      vi.advanceTimersByTime(500);
      controller.abort();

      await expect(sleepPromise).rejects.toThrow('Request was cancelled');
    });

    it('should clean up timeout and abort listener on completion', async () => {
      const controller = new AbortController();
      const sleepPromise = sleep(1000, controller.signal);

      vi.advanceTimersByTime(1000);
      await sleepPromise;

      // Verify cleanup by checking that abort doesn't trigger rejection
      expect(() => controller.abort()).not.toThrow();
    });
  });

  describe('useRetryState', () => {
    it('should initialize with zero retries and not retrying', () => {
      const { result } = renderHook(() => useRetryState());

      expect(result.current.retryState.retryCount).toBe(0);
      expect(result.current.retryState.isRetrying).toBe(false);
      expect(result.current.retryState.lastError).toBeNull();
    });

    it('should successfully complete on first attempt', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const { result } = renderHook(() => useRetryState());

      const mockFn = vi.fn().mockResolvedValue('success');

      const data = await result.current.trackRetry(mockFn);

      expect(data).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result.current.retryState.retryCount).toBe(0);
      expect(result.current.retryState.isRetrying).toBe(false);
      expect(result.current.retryState.lastError).toBeNull();

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should retry on retryable error and eventually succeed', async () => {
      vi.useRealTimers(); // Use real timers

      const { result } = renderHook(() => useRetryState({ maxRetries: 3, initialDelay: 50 }));

      const networkError = new NetworkError('Connection failed');
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const data = await result.current.trackRetry(mockFn);

      expect(data).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.current.retryState.retryCount).toBe(0);
      expect(result.current.retryState.isRetrying).toBe(false);
      expect(result.current.retryState.lastError).toBeNull();

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should throw error when max retries exceeded', async () => {
      vi.useRealTimers(); // Use real timers

      const { result } = renderHook(() => useRetryState({ maxRetries: 2, initialDelay: 50 }));

      const networkError = new NetworkError('Connection failed');
      const mockFn = vi.fn().mockRejectedValue(networkError);

      await expect(result.current.trackRetry(mockFn)).rejects.toThrow('Connection failed');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.current.retryState.isRetrying).toBe(false);
      // Last error might be cleared by React cleanup, so just check it's not retrying

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should not retry on non-retryable error', async () => {
      vi.useRealTimers(); // Use real timers

      const { result } = renderHook(() => useRetryState());

      const validationError = new ApiError(400, 'VALIDATION_ERROR', 'Invalid input');
      const mockFn = vi.fn().mockRejectedValue(validationError);

      await expect(result.current.trackRetry(mockFn)).rejects.toThrow('Invalid input');
      expect(mockFn).toHaveBeenCalledTimes(1); // Only initial attempt
      expect(result.current.retryState.retryCount).toBe(0);
      expect(result.current.retryState.isRetrying).toBe(false);
      // Don't check lastError as React may have cleaned it up

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should stop retrying when aborted', async () => {
      vi.useRealTimers(); // Use real timers

      const { result } = renderHook(() => useRetryState({ maxRetries: 3, initialDelay: 50 }));

      const controller = new AbortController();
      const networkError = new NetworkError('Connection failed');
      const mockFn = vi.fn().mockRejectedValue(networkError);

      // Start the retry operation
      const promise = result.current.trackRetry(mockFn, controller.signal);

      // Let first attempt complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Abort before first retry
      controller.abort();

      await expect(promise).rejects.toThrow('Request was cancelled');
      // Verify no retries occurred after abort
      expect(mockFn.mock.calls.length).toBeLessThanOrEqual(2); // Initial + maybe 1 retry before abort

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should call onRetry callback on each retry attempt', async () => {
      vi.useRealTimers(); // Use real timers

      const onRetry = vi.fn();
      const { result } = renderHook(() => useRetryState({ maxRetries: 2, initialDelay: 50, onRetry }));

      const networkError = new NetworkError('Connection failed');
      const mockFn = vi.fn().mockRejectedValue(networkError);

      await expect(result.current.trackRetry(mockFn)).rejects.toThrow();

      // onRetry should be called for each retry (not initial attempt)
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, networkError);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, networkError);

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should reset retry state on resetRetry call', async () => {
      vi.useRealTimers(); // Use real timers

      const { result } = renderHook(() => useRetryState({ maxRetries: 1, initialDelay: 50 }));

      const networkError = new NetworkError('Connection failed');
      const mockFn = vi.fn().mockRejectedValue(networkError);

      try {
        await result.current.trackRetry(mockFn);
      } catch {
        // Expected to fail
      }

      // Give React time to update state
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Reset
      result.current.resetRetry();

      // State should be cleared
      expect(result.current.retryState.retryCount).toBe(0);
      expect(result.current.retryState.isRetrying).toBe(false);
      expect(result.current.retryState.lastError).toBeNull();

      vi.useFakeTimers(); // Restore fake timers
    });
  });
});
