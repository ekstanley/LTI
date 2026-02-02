/**
 * SWR hook for legislators data fetching with retry state tracking
 * @module hooks/useLegislators
 */

import type { Legislator, PaginatedResponse, Pagination } from '@ltip/shared';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getLegislators, getLegislator, type LegislatorsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { isRetryableError, type RetryState } from './useRetry';

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

  // Retry state tracking
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const previousErrorRef = useRef<Error | null>(null);
  const errorCountRef = useRef(0);

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('legislators', params) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Legislator>,
    Error
  >(
    key,
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => getLegislators(params, signal),
    {
      revalidateOnFocus: swrConfig.revalidateOnFocus,
      dedupingInterval: swrConfig.dedupingInterval,
    }
  );

  // Track retry state based on error/revalidation pattern
  useEffect(() => {
    if (error) {
      // New error occurred
      if (error !== previousErrorRef.current) {
        // Check if this is a retryable error
        if (isRetryableError(error)) {
          // Increment error count (indicates retry attempt)
          errorCountRef.current += 1;
          setRetryCount(errorCountRef.current);
          setIsRetrying(isValidating); // Retrying if revalidating
          setLastError(error);
        } else {
          // Non-retryable error - reset retry state
          errorCountRef.current = 0;
          setRetryCount(0);
          setIsRetrying(false);
          setLastError(error);
        }
        previousErrorRef.current = error;
      } else if (isValidating && isRetryableError(error)) {
        // Still retrying same error
        setIsRetrying(true);
      }
    } else if (data) {
      // Success - reset retry state
      errorCountRef.current = 0;
      setRetryCount(0);
      setIsRetrying(false);
      setLastError(null);
      previousErrorRef.current = null;
    }
  }, [error, data, isValidating]);

  const retryState: RetryState = {
    retryCount,
    isRetrying,
    lastError,
  };

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
