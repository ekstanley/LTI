/**
 * SWR hook for bills data fetching
 * @module hooks/useBills
 */

import useSWR from 'swr';
import type { Bill, PaginatedResponse, Pagination } from '@ltip/shared';
import { getBills, getBill, type BillsQueryParams } from '@/lib/api';
import { createStableCacheKey } from '@/lib/utils/swr';
import { swrConfig } from '@/config/env';

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
  mutate: () => void;
}

/**
 * Hook for fetching paginated bills list
 *
 * @example
 * ```tsx
 * const { bills, pagination, isLoading, error } = useBills({
 *   congressNumber: 119,
 *   limit: 20,
 * });
 * ```
 */
export function useBills(options: UseBillsOptions = {}): UseBillsResult {
  const { enabled = true, ...params } = options;

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

  return {
    bills: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
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
