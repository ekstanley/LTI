/**
 * SWR hook for votes data fetching with retry state tracking
 * @module hooks/useVotes
 */

import type { Vote, PaginatedResponse, Pagination } from '@ltip/shared';
import { useCallback } from 'react';
import useSWR from 'swr';

import { swrConfig } from '@/config/env';
import { getVotes, getVote, type VotesQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';

import { useRetryState, type RetryState } from './useRetry';

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

  // Use shared retry state hook
  const { retryState, trackRetry } = useRetryState();

  // Build stable cache key from params (prevents cache collisions)
  const key = enabled ? createStableCacheKey('votes', params) : null;

  // Wrap fetcher with retry logic
  const fetcher = useCallback(
    async (_key: string | null, { signal }: { signal?: AbortSignal } = {}) => {
      return trackRetry(() => getVotes(params, signal), signal);
    },
    [params, trackRetry]
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Vote>,
    Error
  >(key, fetcher, {
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
    shouldRetryOnError: false, // Disable SWR retry - use trackRetry instead
  });

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
