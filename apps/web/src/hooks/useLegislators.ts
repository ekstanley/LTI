/**
 * SWR hook for legislators data fetching with retry state tracking
 * @module hooks/useLegislators
 */

import type { Legislator, PaginatedResponse, Pagination } from '@ltip/shared';
import { useCallback } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getLegislators, getLegislator, type LegislatorsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';

import { useRetryState, type RetryState } from './useRetry';

export interface UseLegislatorsOptions extends LegislatorsQueryParams {
  /** Enable/disable fetching */
  enabled?: boolean;
}

export interface UseLegislatorsResult {
  legislators: Legislator[];
  pagination: Pagination | null;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  retryState: RetryState;
  mutate: () => Promise<PaginatedResponse<Legislator> | undefined>;
}

/**
 * Hook for fetching paginated legislators list with retry state tracking
 *
 * Tracks retry attempts and surfaces retry state for UI feedback.
 * Retries network errors and 5xx responses with exponential backoff.
 *
 * @example
 * ```tsx
 * const { legislators, pagination, isLoading, error, retryState } = useLegislators({
 *   chamber: 'senate',
 *   party: 'D',
 *   limit: 20,
 * });
 *
 * // Show retry status
 * {retryState.isRetrying && (
 *   <p>Retrying ({retryState.retryCount}/3)...</p>
 * )}
 * ```
 */
export function useLegislators(options: UseLegislatorsOptions = {}): UseLegislatorsResult {
  const { enabled = true, ...params } = options;

  // Use shared retry state hook
  const { retryState, trackRetry } = useRetryState();

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('legislators', params) : null;

  // Wrap fetcher with retry logic
  const fetcher = useCallback(
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => {
      return trackRetry(() => getLegislators(params, signal), signal);
    },
    [params, trackRetry]
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Legislator>,
    Error
  >(key, fetcher, {
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
    shouldRetryOnError: false, // Disable SWR retry - use trackRetry instead
  });

  return {
    legislators: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    retryState,
    mutate,
  };
}

/**
 * Hook for fetching a single legislator by ID
 *
 * @example
 * ```tsx
 * const { legislator, isLoading, error } = useLegislator('S000033');
 * ```
 */
export function useLegislator(id: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Legislator, Error>(
    id ? ['legislator', id] : null,
    async (_key: [string, string] | null, { signal }: { signal?: AbortSignal } = {}) => {
      if (!id) throw new Error('Legislator ID is required');
      return getLegislator(id, signal);
    },
    {
      revalidateOnFocus: swrConfig.revalidateOnFocus,
    }
  );

  return {
    legislator: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    mutate,
  };
}
