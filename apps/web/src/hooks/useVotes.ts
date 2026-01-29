/**
 * SWR hook for votes data fetching
 * @module hooks/useVotes
 */

import useSWR from 'swr';
import type { Vote, PaginatedResponse, Pagination } from '@ltip/shared';
import { getVotes, getVote, type VotesQueryParams } from '@/lib/api';

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

  // Build cache key from params
  const key = enabled ? ['votes', JSON.stringify(params)] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Vote>,
    Error
  >(key, () => getVotes(params), {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

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
    () => getVote(id!),
    {
      revalidateOnFocus: false,
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
