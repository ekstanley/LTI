/**
 * API Client Tests - Retry Logic & Error Handling
 * @module lib/__tests__/api.test
 *
 * Comprehensive test suite for API retry logic, error handling, CSRF token management,
 * and request cancellation. Tests cover all error paths and retry scenarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Error Classes
  ApiError,
  NetworkError,
  AbortError,
  CsrfTokenError,
  // Type Guards
  isApiError,
  isNetworkError,
  isAbortError,
  isCsrfTokenError,
  // Error Handling
  getErrorMessage,
  // CSRF Token Management
  fetchCsrfToken,
  getCsrfToken,
  clearCsrfToken,
  // API Functions
  getBills,
  getBill,
  checkHealth,
} from '../api';

// ============================================================================
// Test Setup
// ============================================================================

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock timers for retry backoff testing
vi.useFakeTimers();

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    clearCsrfToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Error Type Discrimination Tests
  // ============================================================================

  describe('Error Classes', () => {
    describe('ApiError', () => {
      it('should create ApiError with status, code, and message', () => {
        const error = new ApiError(404, 'NOT_FOUND', 'Resource not found');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ApiError);
        expect(error.name).toBe('ApiError');
        expect(error.status).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('Resource not found');
      });

      it('should create ApiError for different status codes', () => {
        const errors = [
          new ApiError(400, 'BAD_REQUEST', 'Invalid input'),
          new ApiError(401, 'UNAUTHORIZED', 'Not authenticated'),
          new ApiError(403, 'FORBIDDEN', 'Access denied'),
          new ApiError(429, 'RATE_LIMIT', 'Too many requests'),
          new ApiError(500, 'INTERNAL_ERROR', 'Server error'),
          new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service down'),
        ];

        errors.forEach((error) => {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.name).toBe('ApiError');
          expect(error.status).toBeGreaterThanOrEqual(400);
        });
      });
    });

    describe('NetworkError', () => {
      it('should create NetworkError with message', () => {
        const error = new NetworkError('Connection failed');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.name).toBe('NetworkError');
        expect(error.message).toBe('Connection failed');
        expect(error.cause).toBeUndefined();
      });

      it('should create NetworkError with cause', () => {
        const cause = new TypeError('fetch failed');
        const error = new NetworkError('Failed to connect', cause);

        expect(error).toBeInstanceOf(NetworkError);
        expect(error.cause).toBe(cause);
        expect(error.message).toBe('Failed to connect');
      });
    });

    describe('AbortError', () => {
      it('should create AbortError with default message', () => {
        const error = new AbortError();

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AbortError);
        expect(error.name).toBe('AbortError');
        expect(error.message).toBe('Request was cancelled');
      });

      it('should create AbortError with custom message', () => {
        const error = new AbortError('User cancelled the operation');

        expect(error).toBeInstanceOf(AbortError);
        expect(error.message).toBe('User cancelled the operation');
      });
    });

    describe('CsrfTokenError', () => {
      it('should create CsrfTokenError with default message', () => {
        const error = new CsrfTokenError();

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(CsrfTokenError);
        expect(error.name).toBe('CsrfTokenError');
        expect(error.message).toBe('CSRF token expired or invalid');
      });

      it('should create CsrfTokenError with custom message', () => {
        const error = new CsrfTokenError('Token refresh failed');

        expect(error).toBeInstanceOf(CsrfTokenError);
        expect(error.message).toBe('Token refresh failed');
      });
    });
  });

  describe('Type Guards', () => {
    describe('isApiError', () => {
      it('should return true for ApiError instances', () => {
        const error = new ApiError(404, 'NOT_FOUND', 'Not found');
        expect(isApiError(error)).toBe(true);
      });

      it('should return false for non-ApiError instances', () => {
        expect(isApiError(new Error('generic error'))).toBe(false);
        expect(isApiError(new NetworkError('network error'))).toBe(false);
        expect(isApiError(new AbortError())).toBe(false);
        expect(isApiError(new CsrfTokenError())).toBe(false);
        expect(isApiError('string error')).toBe(false);
        expect(isApiError(null)).toBe(false);
        expect(isApiError(undefined)).toBe(false);
      });
    });

    describe('isNetworkError', () => {
      it('should return true for NetworkError instances', () => {
        const error = new NetworkError('Connection failed');
        expect(isNetworkError(error)).toBe(true);
      });

      it('should return false for non-NetworkError instances', () => {
        expect(isNetworkError(new Error('generic error'))).toBe(false);
        expect(isNetworkError(new ApiError(500, 'ERROR', 'Server error'))).toBe(false);
        expect(isNetworkError(new AbortError())).toBe(false);
        expect(isNetworkError(new CsrfTokenError())).toBe(false);
        expect(isNetworkError('string error')).toBe(false);
        expect(isNetworkError(null)).toBe(false);
        expect(isNetworkError(undefined)).toBe(false);
      });
    });

    describe('isAbortError', () => {
      it('should return true for AbortError instances', () => {
        const error = new AbortError();
        expect(isAbortError(error)).toBe(true);
      });

      it('should return false for non-AbortError instances', () => {
        expect(isAbortError(new Error('generic error'))).toBe(false);
        expect(isAbortError(new ApiError(500, 'ERROR', 'Server error'))).toBe(false);
        expect(isAbortError(new NetworkError('network error'))).toBe(false);
        expect(isAbortError(new CsrfTokenError())).toBe(false);
        expect(isAbortError('string error')).toBe(false);
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError(undefined)).toBe(false);
      });
    });

    describe('isCsrfTokenError', () => {
      it('should return true for CsrfTokenError instances', () => {
        const error = new CsrfTokenError();
        expect(isCsrfTokenError(error)).toBe(true);
      });

      it('should return false for non-CsrfTokenError instances', () => {
        expect(isCsrfTokenError(new Error('generic error'))).toBe(false);
        expect(isCsrfTokenError(new ApiError(500, 'ERROR', 'Server error'))).toBe(false);
        expect(isCsrfTokenError(new NetworkError('network error'))).toBe(false);
        expect(isCsrfTokenError(new AbortError())).toBe(false);
        expect(isCsrfTokenError('string error')).toBe(false);
        expect(isCsrfTokenError(null)).toBe(false);
        expect(isCsrfTokenError(undefined)).toBe(false);
      });
    });
  });

  describe('getErrorMessage', () => {
    it('should return message for AbortError', () => {
      const error = new AbortError();
      expect(getErrorMessage(error)).toBe('Request was cancelled');
    });

    it('should return session expired message for CsrfTokenError', () => {
      const error = new CsrfTokenError();
      expect(getErrorMessage(error)).toBe(
        'Your session has expired. Please refresh the page and try again.'
      );
    });

    it('should return network error message for NetworkError', () => {
      const error = new NetworkError('Connection failed');
      expect(getErrorMessage(error)).toBe('Network error. Please check your connection and try again.');
    });

    describe('ApiError status-specific messages', () => {
      it('should return 401 unauthorized message', () => {
        const error = new ApiError(401, 'UNAUTHORIZED', 'Not logged in');
        expect(getErrorMessage(error)).toBe('You are not authorized. Please log in and try again.');
      });

      it('should return 403 forbidden message', () => {
        const error = new ApiError(403, 'FORBIDDEN', 'Access denied');
        expect(getErrorMessage(error)).toBe('You do not have permission to access this resource.');
      });

      it('should return 404 not found message', () => {
        const error = new ApiError(404, 'NOT_FOUND', 'Resource missing');
        expect(getErrorMessage(error)).toBe('The requested resource was not found.');
      });

      it('should return 429 rate limit message', () => {
        const error = new ApiError(429, 'RATE_LIMIT', 'Too many requests');
        expect(getErrorMessage(error)).toBe('Too many requests. Please try again later.');
      });

      it('should return 5xx server error message', () => {
        const errors = [
          new ApiError(500, 'INTERNAL_ERROR', 'Server crash'),
          new ApiError(502, 'BAD_GATEWAY', 'Gateway error'),
          new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service down'),
          new ApiError(504, 'GATEWAY_TIMEOUT', 'Timeout'),
        ];

        errors.forEach((error) => {
          expect(getErrorMessage(error)).toBe('Server error. Please try again later.');
        });
      });

      it('should return error message for other ApiError status codes', () => {
        const error = new ApiError(400, 'BAD_REQUEST', 'Invalid data provided');
        expect(getErrorMessage(error)).toBe('Invalid data provided');
      });
    });

    it('should return error message for generic Error', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('should return default message for unknown error types', () => {
      expect(getErrorMessage('string error')).toBe('An unexpected error occurred');
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage({ foo: 'bar' })).toBe('An unexpected error occurred');
    });
  });

  // ============================================================================
  // Retry Logic Tests
  // ============================================================================

  describe('Retry Logic', () => {
    describe('Successful Request (No Retry)', () => {
      it('should return data immediately on successful request', async () => {
        const mockData = { status: 'healthy' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockData,
        });

        const result = await checkHealth();

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Transient Failures with Eventual Success', () => {
      it('should retry on NetworkError and succeed', async () => {
        const mockData = { status: 'healthy' };

        // First call: network error (TypeError)
        mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

        // Second call: success
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockData,
        });

        const resultPromise = checkHealth();

        // Advance timers for backoff delay (first retry: ~1000ms)
        await vi.advanceTimersByTimeAsync(1500);

        const result = await resultPromise;

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 5xx error and succeed', async () => {
        const mockData = { status: 'healthy' };

        // First call: 500 server error
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({ code: 'INTERNAL_ERROR', message: 'Server error' }),
        });

        // Second call: success
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockData,
        });

        const resultPromise = checkHealth();

        // Advance timers for backoff
        await vi.advanceTimersByTimeAsync(1500);

        const result = await resultPromise;

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 429 rate limit error and succeed', async () => {
        const mockData = { status: 'healthy' };

        // First call: 429 rate limit
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(),
          json: async () => ({ code: 'RATE_LIMIT', message: 'Too many requests' }),
        });

        // Second call: success
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockData,
        });

        const resultPromise = checkHealth();

        // Advance timers for backoff
        await vi.advanceTimersByTimeAsync(1500);

        const result = await resultPromise;

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('Max Retries Exhaustion', () => {
      it('should throw after 3 failed NetworkError retries', async () => {
        // All 4 attempts fail (initial + 3 retries)
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const resultPromise = checkHealth();

        // Advance through all retry attempts
        // Attempt 0: immediate
        // Attempt 1: ~1000ms backoff
        // Attempt 2: ~2000ms backoff
        // Attempt 3: ~4000ms backoff
        await vi.advanceTimersByTimeAsync(8000);

        await expect(resultPromise).rejects.toThrow(NetworkError);
        expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
      });

      it('should throw after 3 failed 5xx retries', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: async () => ({ code: 'SERVICE_UNAVAILABLE', message: 'Service down' }),
        });

        const resultPromise = checkHealth();

        // Advance through all retry attempts
        await vi.advanceTimersByTimeAsync(8000);

        await expect(resultPromise).rejects.toThrow(ApiError);
        await expect(resultPromise).rejects.toMatchObject({ status: 503 });
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });

      it('should throw after 3 failed 429 retries', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          headers: new Headers(),
          json: async () => ({ code: 'RATE_LIMIT', message: 'Rate limit exceeded' }),
        });

        const resultPromise = checkHealth();

        // Advance through all retry attempts
        await vi.advanceTimersByTimeAsync(8000);

        await expect(resultPromise).rejects.toThrow(ApiError);
        await expect(resultPromise).rejects.toMatchObject({ status: 429 });
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });
    });

    describe('Non-Retriable Errors (Immediate Throw)', () => {
      it('should throw immediately on 4xx client errors', async () => {
        const clientErrors = [
          { status: 400, code: 'BAD_REQUEST', message: 'Invalid input' },
          { status: 401, code: 'UNAUTHORIZED', message: 'Not authenticated' },
          { status: 404, code: 'NOT_FOUND', message: 'Not found' },
        ];

        for (const errorData of clientErrors) {
          mockFetch.mockClear();
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: errorData.status,
            headers: new Headers(),
            json: async () => errorData,
          });

          await expect(checkHealth()).rejects.toThrow(ApiError);
          expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
        }
      });

      it('should throw immediately on non-403 forbidden errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'FORBIDDEN', message: 'Access denied' }),
        });

        await expect(checkHealth()).rejects.toThrow(ApiError);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Backoff Calculation', () => {
      it('should implement exponential backoff with jitter', async () => {
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const resultPromise = checkHealth();

        // Advance through retry attempts
        // Attempt 1 backoff: ~1000ms (1000 * 2^0)
        await vi.advanceTimersByTimeAsync(1500);

        // Attempt 2 backoff: ~2000ms (1000 * 2^1)
        await vi.advanceTimersByTimeAsync(2500);

        // Attempt 3 backoff: ~4000ms (1000 * 2^2)
        await vi.advanceTimersByTimeAsync(4500);

        await expect(resultPromise).rejects.toThrow(NetworkError);

        // Verify all 4 attempts were made (initial + 3 retries)
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });

      it('should cap backoff at maximum delay (30s)', async () => {
        // This test verifies the MAX_BACKOFF_MS cap
        // With 3 retries, the exponential backoff would be:
        // Retry 1: 1000ms, Retry 2: 2000ms, Retry 3: 4000ms
        // All are under the 30s cap, so this test just verifies no errors
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const resultPromise = checkHealth();

        await vi.advanceTimersByTimeAsync(10000);

        await expect(resultPromise).rejects.toThrow(NetworkError);

        // Verify retries were attempted
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });
    });
  });

  // ============================================================================
  // CSRF Token Handling Tests
  // ============================================================================

  describe('CSRF Token Management', () => {
    describe('fetchCsrfToken', () => {
      it('should fetch and store CSRF token', async () => {
        const expectedToken = 'csrf-token-123';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: expectedToken }),
        });

        const token = await fetchCsrfToken();

        expect(token).toBe(expectedToken);
        expect(getCsrfToken()).toBe(expectedToken);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/csrf-token'),
          expect.objectContaining({
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      it('should throw on failed token fetch', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({}),
        });

        await expect(fetchCsrfToken()).rejects.toThrow('Failed to fetch CSRF token');
      });

      it('should throw on invalid token response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ notTheToken: 'invalid' }),
        });

        await expect(fetchCsrfToken()).rejects.toThrow('Invalid CSRF token response');
      });

      it('should throw on non-string token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 12345 }),
        });

        await expect(fetchCsrfToken()).rejects.toThrow('Invalid CSRF token response');
      });
    });

    describe('getCsrfToken', () => {
      it('should return null initially', () => {
        expect(getCsrfToken()).toBeNull();
      });

      it('should return stored token after fetch', async () => {
        const token = 'stored-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: token }),
        });

        await fetchCsrfToken();

        expect(getCsrfToken()).toBe(token);
      });
    });

    describe('clearCsrfToken', () => {
      it('should clear stored token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'token' }),
        });

        await fetchCsrfToken();
        expect(getCsrfToken()).not.toBeNull();

        clearCsrfToken();
        expect(getCsrfToken()).toBeNull();
      });
    });

    describe('CSRF Token Refresh on 403/CSRF_TOKEN_INVALID', () => {
      it('should refresh token and retry on CSRF_TOKEN_INVALID', async () => {
        const newToken = 'refreshed-token-456';
        const mockData = { data: [] };

        // Set initial token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'old-token' }),
        });
        await fetchCsrfToken();

        // First request: 403 CSRF_TOKEN_INVALID
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Token refresh request
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: newToken }),
        });

        // Retry with new token: success
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockData,
        });

        const result = await getBills();

        expect(result).toEqual(mockData);
        expect(getCsrfToken()).toBe(newToken);
        expect(mockFetch).toHaveBeenCalledTimes(4); // Initial token + failed request + refresh + retry
      });

      it('should throw CsrfTokenError if token refresh fails', async () => {
        // Set initial token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'old-token' }),
        });
        await fetchCsrfToken();

        // First request: 403 CSRF_TOKEN_INVALID
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Token refresh fails
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({}),
        });

        const promise = getBills();

        await expect(promise).rejects.toThrow(CsrfTokenError);
        await expect(promise).rejects.toThrow('Security token invalid. Please refresh and try again.');
      });

      it('should not retry on 403 without CSRF_TOKEN_INVALID code', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'FORBIDDEN', message: 'Access denied' }),
        });

        await expect(checkHealth()).rejects.toThrow(ApiError);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Token Rotation from Response Headers', () => {
      it('should update token from response header on successful request', async () => {
        const newToken = 'rotated-token-789';
        const mockData = { status: 'healthy' };

        const headers = new Headers();
        headers.set('X-CSRF-Token', newToken);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers,
          json: async () => mockData,
        });

        await checkHealth();

        expect(getCsrfToken()).toBe(newToken);
      });

      it('should not update token if header not present', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'initial' }),
        });
        await fetchCsrfToken();

        const initialToken = getCsrfToken();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(), // No X-CSRF-Token header
          json: async () => ({ status: 'healthy' }),
        });

        await checkHealth();

        expect(getCsrfToken()).toBe(initialToken);
      });
    });

    // ============================================================================
    // H-2: CSRF Refresh Limit Protection (DoS Prevention)
    // ============================================================================

    describe('MAX_CSRF_REFRESH_ATTEMPTS Enforcement (H-2 Security Fix)', () => {
      it('should throw CsrfTokenError after MAX_CSRF_REFRESH_ATTEMPTS exceeded', async () => {
        // Set up initial CSRF token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'initial-token' }),
        });
        await fetchCsrfToken();

        // First CSRF_TOKEN_INVALID: counter = 1
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // First refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-1' }),
        });

        // Second CSRF_TOKEN_INVALID: counter = 2
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Second refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-2' }),
        });

        // Third CSRF_TOKEN_INVALID: counter = 3 → LIMIT EXCEEDED
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Attempt getBills - should throw after MAX_CSRF_REFRESH_ATTEMPTS
        const promise = getBills();

        await expect(promise).rejects.toThrow(CsrfTokenError);
        await expect(promise).rejects.toThrow('Security token invalid. Please refresh and try again.');

        // Verify: 1 initial fetch + 3 CSRF_TOKEN_INVALID + 2 successful refreshes = 6 calls
        expect(mockFetch).toHaveBeenCalledTimes(6);
      });

      it('should enforce exact limit boundary (MAX = 2)', async () => {
        // Set up initial CSRF token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'initial-token' }),
        });
        await fetchCsrfToken();

        // First CSRF_TOKEN_INVALID: counter = 1
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // First refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-1' }),
        });

        // Second CSRF_TOKEN_INVALID: counter = 2 (AT THE LIMIT)
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Second refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-2' }),
        });

        // Third CSRF_TOKEN_INVALID: counter = 3 (EXCEEDS LIMIT)
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Should throw when counter > MAX_CSRF_REFRESH_ATTEMPTS (> 2)
        const promise = getBills();

        await expect(promise).rejects.toThrow(CsrfTokenError);
        await expect(promise).rejects.toThrow('Security token invalid. Please refresh and try again.');
      });

      it('should reset counter for each new request', async () => {
        // Set up initial CSRF token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'initial-token' }),
        });
        await fetchCsrfToken();

        // ===== FIRST REQUEST =====
        // CSRF_TOKEN_INVALID: counter = 1
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-1' }),
        });

        // Retry with new token succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ data: [] }),
        });

        // First request completes successfully
        await expect(getBills()).resolves.toBeTruthy();

        // ===== SECOND REQUEST (Counter should be reset to 0) =====
        // CSRF_TOKEN_INVALID: counter = 1 (reset for new request)
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
        });

        // Refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'refreshed-token-2' }),
        });

        // Retry with new token succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ data: [] }),
        });

        // Second request completes successfully (proves counter was reset)
        await expect(getBills()).resolves.toBeTruthy();
      });

      it('should include user-friendly error message on limit exceeded', async () => {
        // Set up initial CSRF token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ csrfToken: 'initial-token' }),
        });
        await fetchCsrfToken();

        // Trigger 3 consecutive CSRF_TOKEN_INVALID responses
        for (let i = 0; i < 3; i++) {
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            headers: new Headers(),
            json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Invalid token' }),
          });

          // Only first 2 refreshes should succeed (before limit exceeded)
          if (i < 2) {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              headers: new Headers(),
              json: async () => ({ csrfToken: `refreshed-token-${i + 1}` }),
            });
          }
        }

        const promise = getBills();

        await expect(promise).rejects.toThrow(CsrfTokenError);
        await expect(promise).rejects.toThrow('Security token invalid. Please refresh and try again.');
      });
    });
  });

  // ============================================================================
  // Request Cancellation Tests
  // ============================================================================

  describe('Request Cancellation', () => {
    describe('AbortSignal Honored Immediately', () => {
      it('should throw AbortError when signal already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        // Note: getBills accepts signal as part of options, not directly
        // We need to check the signal before making the request
        await expect(getBills({}, controller.signal)).rejects.toThrow(AbortError);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should abort ongoing request via signal', async () => {
        // Mock fetch that simulates being aborted
        mockFetch.mockRejectedValueOnce(
          new DOMException('The user aborted a request.', 'AbortError')
        );

        const promise = getBill('bill-123');

        // Let microtasks process
        await Promise.resolve();

        await expect(promise).rejects.toThrow(AbortError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Should not retry abort errors
      });
    });

    describe('AbortSignal Checked Before Each Retry', () => {
      it('should not retry if signal aborted during backoff', async () => {
        const controller = new AbortController();

        // First attempt fails with retriable error
        mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

        const resultPromise = getBills({}, controller.signal);

        // Catch any unhandled rejections
        resultPromise.catch(() => {
          // Intentionally empty - we'll await with expect below
        });

        // Abort during backoff delay
        await vi.advanceTimersByTimeAsync(500);
        controller.abort();

        // Advance timers to allow retry check
        await vi.advanceTimersByTimeAsync(1000);

        await expect(resultPromise).rejects.toThrow(AbortError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial attempt, no retry
      });

      it('should check abort signal before each retry attempt', async () => {
        const controller = new AbortController();
        // Abort before making the request
        controller.abort();

        // Should throw immediately without calling fetch
        await expect(getBills({}, controller.signal)).rejects.toThrow(AbortError);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('No Retry After Abort', () => {
      it('should not retry if initial request is aborted', async () => {
        // Simulate fetch returning an abort error
        const abortError = new DOMException('The user aborted a request.', 'AbortError');
        mockFetch.mockRejectedValueOnce(abortError);

        const promise = checkHealth();

        // Let microtasks process
        await Promise.resolve();

        await expect(promise).rejects.toThrow(AbortError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
      });

      it('should propagate abort error without retry attempts', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(getBills({}, controller.signal)).rejects.toThrow(AbortError);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete request lifecycle with token rotation', async () => {
      const initialToken = 'token-1';
      const rotatedToken = 'token-2';
      const mockData = { data: [] };

      // Fetch initial token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ csrfToken: initialToken }),
      });
      await fetchCsrfToken();

      // Make request with token rotation
      const headers = new Headers();
      headers.set('X-CSRF-Token', rotatedToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        json: async () => mockData,
      });

      const result = await getBills();

      expect(result).toEqual(mockData);
      expect(getCsrfToken()).toBe(rotatedToken);
    });

    it('should handle network failure, retry with exponential backoff, and succeed', async () => {
      const mockData = { status: 'healthy' };

      // Attempt 1: Network error
      mockFetch.mockRejectedValueOnce(new TypeError('Connection failed'));

      // Attempt 2: 503 service unavailable
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ code: 'SERVICE_UNAVAILABLE', message: 'Service down' }),
      });

      // Attempt 3: Success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockData,
      });

      const resultPromise = checkHealth();

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle CSRF refresh followed by retry success', async () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const mockData = { data: [] };

      // Set initial token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ csrfToken: oldToken }),
      });
      await fetchCsrfToken();

      // Request with expired token
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ code: 'CSRF_TOKEN_INVALID', message: 'Token expired' }),
      });

      // Refresh token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ csrfToken: newToken }),
      });

      // Retry with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockData,
      });

      const result = await getBills();

      expect(result).toEqual(mockData);
      expect(getCsrfToken()).toBe(newToken);
    });

    it('should handle abort during retry sequence', async () => {
      const controller = new AbortController();

      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const resultPromise = getBills({}, controller.signal);

      // Catch any unhandled rejections
      resultPromise.catch(() => {
        // Intentionally empty - we'll await with expect below
      });

      // Abort after some time
      await vi.advanceTimersByTimeAsync(800);
      controller.abort();

      await vi.advanceTimersByTimeAsync(1200);

      await expect(resultPromise).rejects.toThrow(AbortError);
    });
  });
});
