/**
 * Integration tests for useLegislators with retry state tracking
 * @module __tests__/hooks/useLegislators-retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLegislators } from '@/hooks/useLegislators';
import * as api from '@/lib/api';
import type { PaginatedResponse, Legislator } from '@ltip/shared';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getLegislators: vi.fn(),
  };
});

describe('useLegislators with retry state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockLegislatorsResponse: PaginatedResponse<Legislator> = {
    data: [
      {
        id: 'S000033',
        bioguideId: 'S000033',
        firstName: 'Bernie',
        lastName: 'Sanders',
        fullName: 'Bernard Sanders',
        party: 'I',
        state: 'VT',
        chamber: 'senate',
        inOffice: true,
        termStart: '2019-01-03',
      },
    ],
    pagination: {
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };

  it('should track retry attempts on 5xx server error', async () => {
    const serverError = new api.ApiError(500, 'INTERNAL_ERROR', 'Server error');

    // Simulate failure then success
    vi.mocked(api.getLegislators)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue(mockLegislatorsResponse);

    const { result } = renderHook(() => useLegislators({ chamber: 'senate' }));

    // Initial state
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Wait for error
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should track retry attempt
    await waitFor(
      () => {
        expect(result.current.retryState.retryCount).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    // Wait for eventual success
    await waitFor(
      () => {
        expect(result.current.legislators).toHaveLength(1);
        expect(result.current.retryState.retryCount).toBe(0);
        expect(result.current.retryState.isRetrying).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  it('should track retry on 429 rate limit error', async () => {
    const rateLimitError = new api.ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');

    // Simulate rate limit then success
    vi.mocked(api.getLegislators)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue(mockLegislatorsResponse);

    const { result } = renderHook(() => useLegislators({ party: 'D' }));

    // Wait for error and retry attempt
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.retryState.lastError).toBe(rateLimitError);
      },
      { timeout: 3000 }
    );

    // Should track retry for rate limit (retryable)
    await waitFor(
      () => {
        expect(result.current.retryState.retryCount).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    // Wait for eventual success
    await waitFor(
      () => {
        expect(result.current.legislators).toHaveLength(1);
        expect(result.current.retryState.retryCount).toBe(0);
      },
      { timeout: 5000 }
    );
  });

  it('should not track retries for 404 not found error', async () => {
    const notFoundError = new api.ApiError(404, 'NOT_FOUND', 'Not found');

    vi.mocked(api.getLegislators).mockRejectedValue(notFoundError);

    const { result } = renderHook(() => useLegislators({ state: 'XX' }));

    // Wait for error
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should not have retry attempts (404 is not retryable)
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);
    expect(result.current.retryState.lastError).toBe(notFoundError);
  });
});
