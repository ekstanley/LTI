/**
 * SWR hook for votes data fetching with retry state tracking
 * @module hooks/useVotes
 */

import type { Vote, PaginatedResponse, Pagination } from '@ltip/shared';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getVotes, getVote, type VotesQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { isRetryableError, type RetryState } from './useRetry';

export interface UseVotesOptions extends VotesQueryParams {
  /** Enable/disable fetching */
  enabled?: boolean;
}

export interface UseVotesResult {
  votes: Vote[];
  pagination: Pagination | null;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  retryState: RetryState;
  mutate: () => Promise<PaginatedResponse<Vote> | undefined>;
}

/**
 * Hook for fetching paginated votes list with retry state tracking
 *
 * Tracks retry attempts and surfaces retry state for UI feedback.
 * Retries network errors and 5xx responses with exponential backoff.
 *
 * @example
 * ```tsx
 * const { votes, pagination, isLoading, error, retryState } = useVotes({
 *   chamber: 'house',
 *   limit: 20,
 * });
 *
 * // Show retry status
 * {retryState.isRetrying && (
 *   <p>Retrying ({retryState.retryCount}/3)...</p>
 * )}
 * ```
 */
export function useVotes(options: UseVotesOptions = {}): UseVotesResult {
  const { enabled = true, ...params } = options;

  // Retry state tracking
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const previousErrorRef = useRef<Error | null>(null);
  const errorCountRef = useRef(0);

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('votes', params) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Vote>,
    Error
  >(
    key,
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => getVotes(params, signal),
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
    votes: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    retryState,
    mutate,
  };
}

/**
 * Hook for fetching a single vote by ID
 *
 * @example
 * ```tsx
 * const { vote, isLoading, error } = useVote('119-H-001');
 * ```
 */
export function useVote(id: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Vote, Error>(
    id ? ['vote', id] : null,
    async (_key: [string, string] | null, { signal }: { signal?: AbortSignal } = {}) => {
      if (!id) throw new Error('Vote ID is required');
      return getVote(id, signal);
    },
    {
      revalidateOnFocus: swrConfig.revalidateOnFocus,
    }
  );

  return {
    vote: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    mutate,
  };
}
