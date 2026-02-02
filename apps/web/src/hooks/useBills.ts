/**
 * SWR hook for bills data fetching with retry state tracking
 * @module hooks/useBills
 */

import type { Bill, PaginatedResponse, Pagination } from '@ltip/shared';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getBills, getBill, type BillsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { isRetryableError, type RetryState } from './useRetry';

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

  // Retry state tracking
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const previousErrorRef = useRef<Error | null>(null);
  const errorCountRef = useRef(0);

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('bills', params) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Bill>,
    Error
  >(
    key,
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => getBills(params, signal),
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
