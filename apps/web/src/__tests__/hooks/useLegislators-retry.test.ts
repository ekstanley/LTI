/**
 * Integration tests for useLegislators with retry state tracking
 * @module __tests__/hooks/useLegislators-retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
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

// Test wrapper that provides fresh SWR cache for each test
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => new Map() } }, children);
  };
}

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

    // Simulate failure then success (trackRetry handles retry internally)
    vi.mocked(api.getLegislators)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue(mockLegislatorsResponse);

    const { result, unmount } = renderHook(() => useLegislators({ chamber: 'senate' }), { wrapper: createWrapper() });

    // Initial state
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Wait for eventual success (trackRetry handles retry and succeeds)
    await waitFor(
      () => {
        expect(result.current.legislators).toHaveLength(1);
      },
      { timeout: 5000 }
    );

    // After successful retry, state should be reset
    expect(result.current.error).toBeNull();
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Cleanup
    unmount();
  });

  it('should track retry on 429 rate limit error', async () => {
    const rateLimitError = new api.ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');

    // Simulate rate limit then success (trackRetry handles retry internally)
    vi.mocked(api.getLegislators)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue(mockLegislatorsResponse);

    const { result, unmount } = renderHook(() => useLegislators({ party: 'D' }), { wrapper: createWrapper() });

    // Wait for eventual success (trackRetry retries and succeeds)
    await waitFor(
      () => {
        expect(result.current.legislators).toHaveLength(1);
      },
      { timeout: 5000 }
    );

    // After successful retry, state should be reset
    expect(result.current.error).toBeNull();
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Cleanup
    unmount();
  });

  it('should not track retries for 404 not found error', async () => {
    const notFoundError = new api.ApiError(404, 'NOT_FOUND', 'Not found');

    vi.mocked(api.getLegislators).mockRejectedValue(notFoundError);

    const { result, unmount } = renderHook(() => useLegislators({ state: 'XX' }), { wrapper: createWrapper() });

    // Wait for error (trackRetry doesn't retry non-retryable errors)
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should not have retry attempts (404 is not retryable)
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Cleanup
    unmount();
  });
});
