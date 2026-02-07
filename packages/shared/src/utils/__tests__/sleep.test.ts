/**
 * sleep() utility tests
 *
 * Validates the canonical sleep function with AbortSignal support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sleep } from '../index.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified delay', async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should reject immediately if signal already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(1000, controller.signal)).rejects.toThrow('Request was cancelled');
  });

  it('should reject with AbortError name if signal aborted during sleep', async () => {
    const controller = new AbortController();
    const promise = sleep(5000, controller.signal);

    // Abort after 100ms
    vi.advanceTimersByTime(100);
    controller.abort();

    const error = await promise.catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AbortError');
    expect(error.message).toBe('Request was cancelled');
  });

  it('should clean up abort listener after successful completion', async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);

    vi.advanceTimersByTime(1000);
    await promise;

    // No error when aborting after sleep completes (listener removed)
    expect(() => controller.abort()).not.toThrow();
  });

  it('should clear timeout when aborted', async () => {
    const controller = new AbortController();
    const promise = sleep(10000, controller.signal);

    controller.abort();

    await expect(promise).rejects.toThrow('Request was cancelled');

    // Timeout was cleared, no pending timers
    expect(vi.getTimerCount()).toBe(0);
  });
});
