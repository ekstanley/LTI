/**
 * Retry Handler with Exponential Backoff
 *
 * Implements retry logic with exponential backoff and jitter
 * for resilient HTTP requests to external APIs.
 *
 * @example
 * ```ts
 * const result = await withRetry(() => fetch(url), {
 *   maxRetries: 3,
 *   baseDelayMs: 1000,
 * });
 * ```
 */

import { logger } from '../lib/logger.js';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  useJitter?: boolean;
  /** HTTP status codes that should trigger a retry */
  retryableStatuses?: number[];
  /** Function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  useJitter: true,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Calculates delay with exponential backoff and optional jitter.
 *
 * Uses "full jitter" strategy: random value between 0 and calculated backoff.
 * This provides optimal distribution for preventing thundering herd.
 *
 * @param attempt Current attempt number (0-indexed)
 * @param options Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: Pick<Required<RetryOptions>, 'baseDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'useJitter'>
): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  if (options.useJitter) {
    // Full jitter: uniform random from 0 to cappedDelay
    return Math.floor(Math.random() * cappedDelay);
  }

  return cappedDelay;
}

/**
 * Determines if an HTTP response should trigger a retry.
 */
export function isRetryableResponse(
  response: Response,
  retryableStatuses: number[]
): boolean {
  return retryableStatuses.includes(response.status);
}

/**
 * Determines if an error should trigger a retry.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors that are typically transient
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    );
  }
  return false;
}

/**
 * Sleeps for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Error class for retry exhaustion.
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Wraps an async operation with retry logic.
 *
 * @param operation The async operation to retry
 * @param options Retry configuration options
 * @returns The result of the operation
 * @throws RetryExhaustedError if all retries are exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error) || opts.isRetryable(error);

      // If not retryable, throw immediately (don't retry)
      if (!isRetryable) {
        throw error;
      }

      const isLastAttempt = attempt === opts.maxRetries;

      // If retryable but exhausted, break to throw RetryExhaustedError
      if (isLastAttempt) {
        break;
      }

      const delayMs = calculateBackoffDelay(attempt, opts);

      logger.warn(
        {
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        },
        'Retrying operation after error'
      );

      opts.onRetry(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw new RetryExhaustedError(
    `Operation failed after ${opts.maxRetries + 1} attempts`,
    opts.maxRetries + 1,
    lastError
  );
}

/**
 * Wraps a fetch operation with retry logic, handling HTTP status codes.
 *
 * @param url URL to fetch
 * @param init Fetch options
 * @param retryOptions Retry configuration
 * @returns Fetch Response
 * @throws RetryExhaustedError if all retries are exhausted
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };

  return withRetry(
    async () => {
      const response = await fetch(url, init);

      if (isRetryableResponse(response, opts.retryableStatuses)) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        throw error;
      }

      return response;
    },
    {
      ...opts,
      isRetryable: (error) => {
        // Check if it's a retryable HTTP error we threw
        if (error instanceof Error && error.message.startsWith('HTTP ')) {
          return true;
        }
        // Check if it's a network error
        return isRetryableError(error);
      },
    }
  );
}

/**
 * Extracts Retry-After header value in milliseconds.
 * Supports both delta-seconds and HTTP-date formats.
 *
 * @param response HTTP response
 * @returns Delay in milliseconds, or null if header not present
 */
export function getRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;

  // Try parsing as number (delta-seconds)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}
