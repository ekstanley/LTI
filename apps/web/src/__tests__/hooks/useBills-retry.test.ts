/**
 * Integration tests for useBills with retry state tracking
 * @module __tests__/hooks/useBills-retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { useBills } from '@/hooks/useBills';
import * as api from '@/lib/api';
import type { PaginatedResponse, Bill } from '@ltip/shared';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getBills: vi.fn(),
  };
});

// Test wrapper that provides fresh SWR cache for each test
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => new Map() } }, children);
  };
}

describe('useBills with retry state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockBillsResponse: PaginatedResponse<Bill> = {
    data: [
      {
        id: 'hr-1-119',
        congressNumber: 119,
        billType: 'hr',
        billNumber: 1,
        title: 'Test Bill',
        introducedDate: '2024-01-15',
        status: 'introduced',
        chamber: 'house',
        cosponsorsCount: 5,
        subjects: ['Healthcare'],
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
    ],
    pagination: {
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };

  it('should track retry attempts on retryable error', async () => {
    const networkError = new api.NetworkError('Connection failed');

    // Simulate failure then success (trackRetry handles retry internally)
    vi.mocked(api.getBills)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(mockBillsResponse);

    const { result } = renderHook(() => useBills({ congressNumber: 119 }), { wrapper: createWrapper() });

    // Initial state
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Wait for eventual success (trackRetry handles retry and succeeds)
    await waitFor(
      () => {
        expect(result.current.bills).toHaveLength(1);
      },
      { timeout: 5000 }
    );

    // After successful retry, state should be reset
    expect(result.current.error).toBeNull();
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);
  });

  it('should not track retries for non-retryable errors', async () => {
    const validationError = new api.ApiError(400, 'VALIDATION_ERROR', 'Invalid input');

    vi.mocked(api.getBills).mockRejectedValue(validationError);

    const { result } = renderHook(() => useBills({ congressNumber: 119 }), { wrapper: createWrapper() });

    // Wait for error (trackRetry doesn't retry non-retryable errors)
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Should not have retry attempts (non-retryable error)
    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);
  });

  it('should reset retry state on successful fetch', async () => {
    const networkError = new api.NetworkError('Connection failed');

    // First: success
    vi.mocked(api.getBills).mockResolvedValueOnce(mockBillsResponse);

    const { result, rerender } = renderHook(
      ({ enabled }) => useBills({ congressNumber: 119, enabled }),
      { initialProps: { enabled: true }, wrapper: createWrapper() }
    );

    // Wait for success
    await waitFor(
      () => {
        expect(result.current.bills).toHaveLength(1);
      },
      { timeout: 3000 }
    );

    expect(result.current.retryState.retryCount).toBe(0);
    expect(result.current.retryState.isRetrying).toBe(false);

    // Now: failure then success (trackRetry will handle retry)
    vi.mocked(api.getBills)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(mockBillsResponse);

    // Trigger refetch by disabling/enabling
    rerender({ enabled: false });
    rerender({ enabled: true });

    // Wait for recovery (trackRetry retries and succeeds)
    await waitFor(
      () => {
        expect(result.current.bills).toHaveLength(1);
        expect(result.current.retryState.retryCount).toBe(0);
        expect(result.current.retryState.isRetrying).toBe(false);
        expect(result.current.retryState.lastError).toBeNull();
      },
      { timeout: 5000 }
    );
  });
});
