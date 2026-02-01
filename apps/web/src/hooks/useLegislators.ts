/**
 * SWR hook for legislators data fetching
 * @module hooks/useLegislators
 */

import useSWR from 'swr';
import type { Legislator, PaginatedResponse, Pagination } from '@ltip/shared';
import { getLegislators, getLegislator, type LegislatorsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { swrConfig } from '@/config/env';

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
  mutate: () => void;
}

/**
 * Hook for fetching paginated legislators list
 *
 * @example
 * ```tsx
 * const { legislators, pagination, isLoading, error } = useLegislators({
 *   chamber: 'senate',
 *   party: 'D',
 *   limit: 20,
 * });
 * ```
 */
export function useLegislators(options: UseLegislatorsOptions = {}): UseLegislatorsResult {
  const { enabled = true, ...params } = options;

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

  return {
    legislators: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
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
