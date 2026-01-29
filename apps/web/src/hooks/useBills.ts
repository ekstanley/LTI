/**
 * SWR hook for bills data fetching
 * @module hooks/useBills
 */

import useSWR from 'swr';
import type { Bill, PaginatedResponse, Pagination } from '@ltip/shared';
import { getBills, getBill, type BillsQueryParams } from '@/lib/api';

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

  // Build cache key from params
  const key = enabled ? ['bills', JSON.stringify(params)] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Bill>,
    Error
  >(key, () => getBills(params), {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

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
    () => getBill(id!),
    {
      revalidateOnFocus: false,
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
