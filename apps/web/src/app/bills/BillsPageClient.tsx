/**
 * Bills page client component with real API connection
 * @module app/bills/BillsPageClient
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useBills, useDebounce } from '@/hooks';
import { Navigation, LoadingState, EmptyState, Pagination, ErrorFallback } from '@/components/common';
import { BillCard } from '@/components/bills';
import type { BillsQueryParams } from '@/lib/api';

const PAGE_SIZE = 20;

type Chamber = 'house' | 'senate' | '';
type BillStatus = 'introduced' | 'in_committee' | 'passed_house' | 'passed_senate' | 'became_law' | '';

interface Filters {
  search: string;
  chamber: Chamber;
  status: BillStatus;
}

export function BillsPageClient() {
  // Filter state
  const [filters, setFilters] = useState<Filters>({
    search: '',
    chamber: '',
    status: '',
  });
  const [page, setPage] = useState(1);

  // Debounce search to prevent excessive API calls
  const debouncedSearch = useDebounce(filters.search, 300);

  // Build query params
  const queryParams = useMemo<BillsQueryParams>(() => {
    const params: BillsQueryParams = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    if (filters.chamber) {
      params.chamber = filters.chamber;
    }
    if (filters.status) {
      params.status = filters.status;
    }

    return params;
  }, [debouncedSearch, filters.chamber, filters.status, page]);

  // Fetch bills
  const { bills, pagination, isLoading, error, mutate } = useBills(queryParams);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPage(1); // Reset to first page on search
  }, []);

  const handleChamberChange = useCallback((value: Chamber) => {
    setFilters((prev) => ({ ...prev, chamber: value }));
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: BillStatus) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', chamber: '', status: '' });
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Calculate total pages
  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 0;

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.chamber || filters.status;

  return (
    <>
      <Navigation />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
            <p className="mt-2 text-gray-600">
              Browse and search congressional legislation from the 119th Congress
            </p>
          </div>

          {/* Search and filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search bills by title, number, or keyword..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input w-full pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.chamber}
                onChange={(e) => handleChamberChange(e.target.value as Chamber)}
                className="input w-auto"
              >
                <option value="">All Chambers</option>
                <option value="house">House</option>
                <option value="senate">Senate</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => handleStatusChange(e.target.value as BillStatus)}
                className="input w-auto"
              >
                <option value="">All Statuses</option>
                <option value="introduced">Introduced</option>
                <option value="in_committee">In Committee</option>
                <option value="passed_house">Passed House</option>
                <option value="passed_senate">Passed Senate</option>
                <option value="became_law">Became Law</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="btn-outline text-red-600 hover:text-red-700"
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <ErrorFallback
              error={error}
              title="Failed to load bills"
              onRetry={() => mutate()}
            />
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <LoadingState message="Loading bills..." size="lg" fullPage />
          )}

          {/* Empty state */}
          {!isLoading && !error && bills.length === 0 && (
            <EmptyState
              variant={hasActiveFilters ? 'search' : 'default'}
              title={hasActiveFilters ? 'No bills match your search' : 'No bills found'}
              message={
                hasActiveFilters
                  ? 'Try adjusting your search terms or clearing filters.'
                  : 'Bills will appear here once data is available.'
              }
              action={
                hasActiveFilters && (
                  <button onClick={handleClearFilters} className="btn-primary">
                    Clear Filters
                  </button>
                )
              }
            />
          )}

          {/* Bills list */}
          {!isLoading && !error && bills.length > 0 && (
            <>
              <div className="space-y-4">
                {bills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && pagination && (
                <div className="mt-8">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={pagination.total}
                    pageSize={PAGE_SIZE}
                    onPageChange={handlePageChange}
                    showFirstLast
                    showItemCount
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
