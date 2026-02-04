/**
 * SWR hook for bills data fetching with retry state tracking
 * @module hooks/useBills
 */

import type { Bill, PaginatedResponse, Pagination } from '@ltip/shared';
import { useCallback } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getBills, getBill, type BillsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { useRetryState, type RetryState } from './useRetry';

export interface UseBillsOptions extends BillsQueryParams {
  /** Enable/disable fetching */
  enabled?: boolean;
}

export interface UseBillsResult {
  bills: Bill[];
  pagination: Pagination | null;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  retryState: RetryState;
  mutate: () => Promise<PaginatedResponse<Bill> | undefined>;
}

/**
 * Hook for fetching paginated bills list with retry state tracking
 *
 * Tracks retry attempts and surfaces retry state for UI feedback.
 * Retries network errors and 5xx responses with exponential backoff.
 *
 * @example
 * ```tsx
 * const { bills, pagination, isLoading, error, retryState } = useBills({
 *   congressNumber: 119,
 *   limit: 20,
 * });
 *
 * // Show retry status
 * {retryState.isRetrying && (
 *   <p>Retrying ({retryState.retryCount}/3)...</p>
 * )}
 * ```
 */
export function useBills(options: UseBillsOptions = {}): UseBillsResult {
  const { enabled = true, ...params } = options;

  // Use shared retry state hook
  const { retryState, trackRetry } = useRetryState();

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('bills', params) : null;

  // Wrap fetcher with retry logic
  const fetcher = useCallback(
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => {
      return trackRetry(() => getBills(params, signal), signal);
    },
    [params, trackRetry]
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Bill>,
    Error
  >(key, fetcher, {
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
    shouldRetryOnError: false, // Disable SWR retry - use trackRetry instead
  });

  return {
    bills: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    retryState,
    mutate,
  };
}

/**
 * Hook for fetching a single bill by ID
 *
 * @example
 * ```tsx
 * const { bill, isLoading, error } = useBill('hr-1-119');
 * ```
 */
export function useBill(id: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Bill, Error>(
    id ? ['bill', id] : null,
    async (_key: [string, string] | null, { signal }: { signal?: AbortSignal } = {}) => {
      if (!id) throw new Error('Bill ID is required');
      return getBill(id, signal);
    },
    {
      revalidateOnFocus: swrConfig.revalidateOnFocus,
    }
  );

  return {
    bill: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    mutate,
  };
}
