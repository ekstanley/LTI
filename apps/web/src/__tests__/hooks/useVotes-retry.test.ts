/**
 * Integration tests for useVotes with retry state tracking
 * @module __tests__/hooks/useVotes-retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVotes } from '@/hooks/useVotes';
import * as api from '@/lib/api';
import type { PaginatedResponse, Vote } from '@ltip/shared';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getVotes: vi.fn(),
  };
});

describe('useVotes with retry state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockVotesResponse: PaginatedResponse<Vote> = {
    data: [
      {
        id: '119-H-001',
        billId: 'hr-1-119',
        chamber: 'house',
        session: 119,
        rollCallNumber: 1,
        date: '2024-01-15',
        question: 'On Passage',
        result: 'passed',
        yeas: 250,
        nays: 180,
        present: 0,
        notVoting: 5,
      },
    ],
    pagination: {
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };

  it('should track retry attempts on network error', async () => {
    const networkError = new api.NetworkError('Connection timeout');

    // Simulate network failure then success
    vi.mocked(api.getVotes)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(mockVotesResponse);

    const { result } = renderHook(() => useVotes({ chamber: 'house' }));

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
        expect(result.current.retryState.lastError).toBe(networkError);
      },
      { timeout: 3000 }
    );

    // Wait for eventual success
    await waitFor(
      () => {
        expect(result.current.votes).toHaveLength(1);
        expect(result.current.retryState.retryCount).toBe(0);
        expect(result.current.retryState.isRetrying).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  it('should track multiple retry attempts before success', async () => {
    const serverError = new api.ApiError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');

    // Simulate multiple failures then success
    vi.mocked(api.getVotes)
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue(mockVotesResponse);

    const { result } = renderHook(() => useVotes({ billId: 'hr-1-119' }));

    // Wait for first error
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should track retry attempts (may be 1 or 2 depending on timing)
    await waitFor(
      () => {
        expect(result.current.retryState.retryCount).toBeGreaterThanOrEqual(1);
        expect(result.current.retryState.isRetrying).toBe(true);
      },
      { timeout: 3000 }
    );

    // Wait for eventual success
    await waitFor(
      () => {
        expect(result.current.votes).toHaveLength(1);
        expect(result.current.retryState.retryCount).toBe(0);
        expect(result.current.retryState.isRetrying).toBe(false);
        expect(result.current.retryState.lastError).toBeNull();
      },
      { timeout: 10000 }
    );
  });

  it('should not retry on 401 unauthorized error', async () => {
    const unauthorizedError = new api.ApiError(401, 'UNAUTHORIZED', 'Unauthorized');

    vi.mocked(api.getVotes).mockRejectedValue(unauthorizedError);

    const { result } = renderHook(() => useVotes());

    // Wait for error
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should not have retry attempts (401 is not retryable)
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);
    expect(result.current.retryState.lastError).toBe(unauthorizedError);

    // Verify no additional API calls were made
    expect(vi.mocked(api.getVotes)).toHaveBeenCalledTimes(1);
  });
});
