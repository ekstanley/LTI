/**
 * SWR hook for votes data fetching
 * @module hooks/useVotes
 */

import useSWR from 'swr';
import type { Vote, PaginatedResponse, Pagination } from '@ltip/shared';
import { getVotes, getVote, type VotesQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { swrConfig } from '@/config/env';

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
  mutate: () => void;
}

/**
 * Hook for fetching paginated votes list
 *
 * @example
 * ```tsx
 * const { votes, pagination, isLoading, error } = useVotes({
 *   chamber: 'house',
 *   limit: 20,
 * });
 * ```
 */
export function useVotes(options: UseVotesOptions = {}): UseVotesResult {
  const { enabled = true, ...params } = options;

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

  return {
    votes: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
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
