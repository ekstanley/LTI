/**
 * Retry logic with exponential backoff for React hooks
 * Tracks retry attempts and surfaces state to UI components
 *
 * @module hooks/useRetry
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { apiConfig } from '@/config/env';
import { isApiError, isNetworkError, isAbortError } from '@/lib/api';

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Callback invoked on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry state exposed to UI components
 */
export interface RetryState {
  /** Current retry attempt count (0 = no retries yet) */
  retryCount: number;
  /** Whether a retry is currently in progress */
  isRetrying: boolean;
  /** Last error encountered (if any) */
  lastError: Error | null;
}

/**
 * Check if an error should trigger a retry
 *
 * Retryable errors:
 * - Network errors (connection failed, DNS, timeout)
 * - Server errors (5xx status codes)
 * - Rate limiting (429 status code)
 *
 * Non-retryable errors:
 * - Client errors (4xx except 429)
 * - Validation errors
 * - Abort errors (user cancelled)
 *
 * @param error - Error to check
 * @returns true if error is retryable, false otherwise
 */
export function isRetryableError(error: unknown): boolean {
  // Don't retry if request was aborted
  if (isAbortError(error)) {
    return false;
  }

  // Network errors are retryable
  if (isNetworkError(error)) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (isApiError(error)) {
    if (error.status >= 500) {
      return true;
    }
    // Rate limiting (429) is retryable
    if (error.status === 429) {
      return true;
    }
  }

  // All other errors are not retryable (4xx, validation, etc.)
  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(initialDelay * 2^attempt, maxBackoff) + jitter
 * Jitter: ±10% randomization to prevent thundering herd
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param initialDelay - Base delay in milliseconds
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateBackoff(attempt: number, initialDelay: number = 1000): number {
  const maxBackoff = apiConfig.maxBackoffMs;

  // Exponential backoff: 2^attempt * initialDelay
  const exponentialDelay = Math.min(initialDelay * Math.pow(2, attempt), maxBackoff);

  // Add jitter (±10%) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds with cancellation support
 *
 * @param ms - Milliseconds to sleep
 * @param signal - Optional AbortSignal for cancellation
 * @throws {Error} If signal is aborted during sleep (name='AbortError')
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(new Error('Request was cancelled'));
      return;
    }

    const timeoutId = setTimeout(() => {
      // Clean up abort listener when timeout completes
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    // Listen for abort signal during sleep
    let abortHandler: (() => void) | null = null;
    if (signal) {
      abortHandler = () => {
        clearTimeout(timeoutId);
        const error = new Error('Request was cancelled');
        error.name = 'AbortError';
        reject(error);
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}

/**
 * Hook to track retry state for async operations
 *
 * This hook provides a way to track retry attempts and surface state to UI.
 * It manages retry count, retry status, and error state.
 *
 * @returns Retry state and management functions
 *
 * @example
 * ```tsx
 * const { retryState, trackRetry, resetRetry } = useRetryState();
 *
 * useEffect(() => {
 *   async function fetchData() {
 *     try {
 *       const data = await trackRetry(() => api.getData());
 *       setData(data);
 *     } catch (error) {
 *       console.error(error);
 *     }
 *   }
 *   fetchData();
 * }, []);
 *
 * // Show retry count to user
 * {retryState.isRetrying && <p>Retrying ({retryState.retryCount}/3)...</p>}
 * ```
 */
export function useRetryState(options: RetryOptions = {}) {
  const {
    maxRetries = apiConfig.maxRetries,
    initialDelay = apiConfig.initialBackoffMs,
    onRetry,
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Use ref to store AbortController to prevent re-creating on each render
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Wrap an async function with retry logic
   *
   * @param fn - Async function to execute with retry
   * @param signal - Optional external AbortSignal
   * @returns Promise resolving to function result
   */
  const trackRetry = useCallback(
    async <T,>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
      // Abort previous controller if it exists (prevents memory leak)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      // Link external signal if provided (with cleanup to prevent memory leak)
      let externalAbortHandler: (() => void) | null = null;
      if (signal) {
        externalAbortHandler = () => {
          abortControllerRef.current?.abort();
        };
        signal.addEventListener('abort', externalAbortHandler);
      }

      const internalSignal = abortControllerRef.current.signal;

      let lastAttemptError: Error | null = null;

      // Use try-finally to ensure external listener cleanup
      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Check if aborted before attempt
            if (internalSignal.aborted) {
              const error = new Error('Request was cancelled');
              error.name = 'AbortError';
              throw error;
            }

            // First attempt: not retrying
            // Subsequent attempts: retrying
            if (attempt > 0) {
              setIsRetrying(true);
              setRetryCount(attempt);
              onRetry?.(attempt, lastAttemptError!);
            }

            // Execute the function
            const result = await fn();

            // Success! Reset state
            setRetryCount(0);
            setIsRetrying(false);
            setLastError(null);

            return result;
          } catch (error) {
            lastAttemptError = error instanceof Error ? error : new Error(String(error));
            setLastError(lastAttemptError);

            // Don't retry if aborted
            if (isAbortError(error)) {
              setIsRetrying(false);
              throw error;
            }

            // Check if error is retryable
            if (!isRetryableError(error)) {
              setIsRetrying(false);
              throw error;
            }

            // Check if we have retries remaining
            if (attempt >= maxRetries) {
              setIsRetrying(false);
              throw error;
            }

            // Wait with exponential backoff before retry
            const backoffDelay = calculateBackoff(attempt, initialDelay);

            try {
              await sleep(backoffDelay, internalSignal);
            } catch (sleepError) {
              // Sleep was aborted
              setIsRetrying(false);
              throw sleepError;
            }
          }
        }

        // Should never reach here, but TypeScript needs this
        setIsRetrying(false);
        throw lastAttemptError!;
      } finally {
        // Clean up external signal listener (prevents memory leak)
        if (signal && externalAbortHandler) {
          signal.removeEventListener('abort', externalAbortHandler);
        }
      }
    },
    [maxRetries, initialDelay, onRetry]
  );

  /**
   * Reset retry state to initial values
   */
  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
    setLastError(null);
  }, []);

  const retryState: RetryState = {
    retryCount,
    isRetrying,
    lastError,
  };

  return {
    retryState,
    trackRetry,
    resetRetry,
  };
}
