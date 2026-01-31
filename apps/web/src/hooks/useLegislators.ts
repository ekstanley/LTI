/**
 * SWR hook for legislators data fetching
 * @module hooks/useLegislators
 */

import useSWR from 'swr';
import type { Legislator, PaginatedResponse, Pagination } from '@ltip/shared';
import { getLegislators, getLegislator, type LegislatorsQueryParams } from '@/lib/api';

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

  // Build cache key from params
  const key = enabled ? ['legislators', JSON.stringify(params)] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Legislator>,
    Error
  >(key, () => getLegislators(params), {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

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
    () => getLegislator(id!),
    {
      revalidateOnFocus: false,
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
