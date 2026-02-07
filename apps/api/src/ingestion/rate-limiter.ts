/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting API requests.
 * Allows bursting while maintaining long-term rate compliance.
 *
 * @example
 * ```ts
 * const limiter = new TokenBucketRateLimiter({ maxTokens: 1000, refillRatePerHour: 1000 });
 * await limiter.acquire(); // blocks until token available
 * await fetch(url);
 * ```
 */

import { logger } from '../lib/logger.js';

export interface RateLimiterOptions {
  /** Maximum tokens in the bucket (burst capacity) */
  maxTokens: number;
  /** Tokens added per hour */
  refillRatePerHour: number;
  /** Initial token count (defaults to maxTokens) */
  initialTokens?: number;
}

export interface RateLimiterStats {
  currentTokens: number;
  maxTokens: number;
  refillRatePerHour: number;
  requestsThisHour: number;
  waitingRequests: number;
}

interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  /** Timeout for the scheduled processQueue() call; must be cleared on resolve/reject/reset */
  processTimeout: NodeJS.Timeout | null;
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private lastRefillTime: number;
  private requestQueue: QueuedRequest[] = [];
  private requestsThisHour = 0;
  private hourStartTime: number;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.tokens = options.initialTokens ?? options.maxTokens;
    this.refillRatePerMs = options.refillRatePerHour / (60 * 60 * 1000);
    this.lastRefillTime = Date.now();
    this.hourStartTime = Date.now();
  }

  /**
   * Refills tokens based on elapsed time.
   * Called automatically before acquiring tokens.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;

    // Reset hourly counter if needed
    if (now - this.hourStartTime >= 60 * 60 * 1000) {
      this.requestsThisHour = 0;
      this.hourStartTime = now;
    }

    // Add tokens proportional to elapsed time
    const tokensToAdd = elapsed * this.refillRatePerMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Calculates wait time until a token becomes available.
   * @returns Time in milliseconds to wait
   */
  private getWaitTime(): number {
    const tokensNeeded = 1 - this.tokens;
    if (tokensNeeded <= 0) return 0;
    return Math.ceil(tokensNeeded / this.refillRatePerMs);
  }

  /**
   * Attempts to consume a token immediately.
   * @returns true if token was consumed, false if none available
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.requestsThisHour++;
      return true;
    }

    return false;
  }

  /**
   * Acquires a token, waiting if necessary.
   * @param timeoutMs Maximum time to wait (default: 60s)
   * @throws Error if timeout exceeded
   */
  async acquire(timeoutMs = 60_000): Promise<void> {
    this.refill();

    // Fast path: token available immediately
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.requestsThisHour++;
      return;
    }

    // Slow path: wait for token
    const waitTime = this.getWaitTime();

    if (waitTime > timeoutMs) {
      throw new Error(
        `Rate limit exceeded. Wait time (${waitTime}ms) exceeds timeout (${timeoutMs}ms)`
      );
    }

    logger.debug({ waitTime }, 'Rate limiter: waiting for token');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.requestQueue.findIndex(
          (r) => r.resolve === resolve
        );
        if (index >= 0) {
          const req = this.requestQueue[index]!;
          if (req.processTimeout) clearTimeout(req.processTimeout);
          this.requestQueue.splice(index, 1);
        }
        reject(new Error(`Rate limiter timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const queuedRequest: QueuedRequest = { resolve, reject, timeout, processTimeout: null };
      this.requestQueue.push(queuedRequest);

      // Schedule the next available slot (tracked for cleanup)
      queuedRequest.processTimeout = setTimeout(() => {
        this.processQueue();
      }, waitTime);
    });
  }

  /**
   * Processes waiting requests when tokens become available.
   */
  private processQueue(): void {
    this.refill();

    while (this.requestQueue.length > 0 && this.tokens >= 1) {
      const request = this.requestQueue.shift();
      if (request) {
        clearTimeout(request.timeout);
        if (request.processTimeout) clearTimeout(request.processTimeout);
        this.tokens -= 1;
        this.requestsThisHour++;
        request.resolve();
      }
    }
  }

  /**
   * Returns current rate limiter statistics.
   */
  getStats(): RateLimiterStats {
    this.refill();

    return {
      currentTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRatePerHour: this.refillRatePerMs * 60 * 60 * 1000,
      requestsThisHour: this.requestsThisHour,
      waitingRequests: this.requestQueue.length,
    };
  }

  /**
   * Resets the rate limiter to initial state.
   * Useful for testing or manual intervention.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.requestsThisHour = 0;
    this.hourStartTime = Date.now();

    // Reject all waiting requests and clear all tracked timers
    for (const request of this.requestQueue) {
      clearTimeout(request.timeout);
      if (request.processTimeout) clearTimeout(request.processTimeout);
      request.reject(new Error('Rate limiter reset'));
    }
    this.requestQueue = [];
  }
}

// Singleton instance for Congress.gov API
let congressApiLimiter: TokenBucketRateLimiter | null = null;

/**
 * Gets the singleton rate limiter for Congress.gov API.
 * Lazily initialized on first call.
 */
export function getCongressApiLimiter(): TokenBucketRateLimiter {
  if (!congressApiLimiter) {
    // Congress.gov allows 1000 requests per hour
    congressApiLimiter = new TokenBucketRateLimiter({
      maxTokens: 100, // Allow burst of 100 requests
      refillRatePerHour: 1000,
      initialTokens: 100,
    });
  }
  return congressApiLimiter;
}

/**
 * Resets the singleton rate limiter.
 * Used primarily for testing.
 */
export function resetCongressApiLimiter(): void {
  if (congressApiLimiter) {
    congressApiLimiter.reset();
  }
  congressApiLimiter = null;
}
