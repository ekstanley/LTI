/**
 * Legislators page client component with real API connection
 * @module app/legislators/LegislatorsPageClient
 */

'use client';

import {
  PARTY_LABELS,
  PARTY_COLORS,
  CHAMBER_SHORT_LABELS,
  US_STATES,
} from '@ltip/shared';
import type { Legislator } from '@ltip/shared';
import { Search, X, Building2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo, useCallback } from 'react';

import { Navigation, LoadingState, EmptyState, Pagination, ErrorFallback } from '@/components/common';
import { useLegislators, useDebounce } from '@/hooks';
import type { LegislatorsQueryParams } from '@/lib/api';


const PAGE_SIZE = 24;

type PartyFilter = 'D' | 'R' | 'I' | '';
type ChamberFilter = 'house' | 'senate' | '';

interface Filters {
  search: string;
  chamber: ChamberFilter;
  party: PartyFilter;
  state: string;
}

/**
 * Legislator card component
 */
function LegislatorCard({ legislator }: { legislator: Legislator }) {
  const partyColor = PARTY_COLORS[legislator.party] ?? 'bg-gray-600';
  const partyLabel = PARTY_LABELS[legislator.party] ?? legislator.party;
  const chamberLabel = CHAMBER_SHORT_LABELS[legislator.chamber] ?? legislator.chamber;
  const stateName = US_STATES[legislator.state as keyof typeof US_STATES] ?? legislator.state;

  return (
    <Link
      href={`/legislators/${legislator.id}`}
      className="group block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        {/* Avatar / placeholder */}
        <div className="flex-shrink-0">
          {legislator.imageUrl ? (
            <img
              src={legislator.imageUrl}
              alt={legislator.fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${partyColor} text-white text-xl font-bold`}>
              {legislator.firstName[0]}{legislator.lastName[0]}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
            {legislator.fullName}
          </h3>

          {/* Party and State */}
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <span className={`inline-block h-2 w-2 rounded-full ${partyColor}`} />
            <span>{partyLabel}</span>
            <span>&middot;</span>
            <span>{legislator.state}</span>
            {legislator.district && <span>&middot; District {legislator.district}</span>}
          </div>

          {/* Chamber */}
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span>{chamberLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{stateName}</span>
            </div>
          </div>

          {/* Status */}
          {!legislator.inOffice && (
            <span className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              Former Member
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function LegislatorsPageClient() {
  // Filter state
  const [filters, setFilters] = useState<Filters>({
    search: '',
    chamber: '',
    party: '',
    state: '',
  });
  const [page, setPage] = useState(1);

  // Debounce search to prevent excessive API calls
  const debouncedSearch = useDebounce(filters.search, 300);

  // Build query params
  const queryParams = useMemo<LegislatorsQueryParams>(() => {
    const params: LegislatorsQueryParams = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    if (filters.chamber) {
      params.chamber = filters.chamber;
    }
    if (filters.party) {
      params.party = filters.party;
    }
    if (filters.state) {
      params.state = filters.state;
    }

    return params;
  }, [debouncedSearch, filters.chamber, filters.party, filters.state, page]);

  // Fetch legislators
  const { legislators, pagination, isLoading, error, mutate } = useLegislators(queryParams);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPage(1);
  }, []);

  const handleChamberChange = useCallback((value: ChamberFilter) => {
    setFilters((prev) => ({ ...prev, chamber: value }));
    setPage(1);
  }, []);

  const handlePartyChange = useCallback((value: PartyFilter) => {
    setFilters((prev) => ({ ...prev, party: value }));
    setPage(1);
  }, []);

  const handleStateChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, state: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', chamber: '', party: '', state: '' });
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Calculate total pages
  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 0;

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.chamber || filters.party || filters.state;

  // Get sorted states for dropdown
  const sortedStates = useMemo(() => {
    return Object.entries(US_STATES).sort(([, a], [, b]) => a.localeCompare(b));
  }, []);

  return (
    <>
      <Navigation />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Legislators</h1>
            <p className="mt-2 text-gray-600">
              Browse members of Congress from the 119th Congress
            </p>
          </div>

          {/* Search and filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search by name..."
                  value={filters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="input w-full pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.chamber}
                onChange={(e) => handleChamberChange(e.target.value as ChamberFilter)}
                className="input w-auto"
              >
                <option value="">All Chambers</option>
                <option value="house">House</option>
                <option value="senate">Senate</option>
              </select>

              <select
                value={filters.party}
                onChange={(e) => handlePartyChange(e.target.value as PartyFilter)}
                className="input w-auto"
              >
                <option value="">All Parties</option>
                <option value="D">Democrat</option>
                <option value="R">Republican</option>
                <option value="I">Independent</option>
              </select>

              <select
                value={filters.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="input w-auto"
              >
                <option value="">All States</option>
                {sortedStates.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
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
              title="Failed to load legislators"
              onRetry={() => void mutate()}
            />
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <LoadingState message="Loading legislators..." size="lg" fullPage />
          )}

          {/* Empty state */}
          {!isLoading && !error && legislators.length === 0 && (
            <EmptyState
              variant={hasActiveFilters ? 'search' : 'default'}
              title={hasActiveFilters ? 'No legislators match your search' : 'No legislators found'}
              message={
                hasActiveFilters
                  ? 'Try adjusting your search terms or clearing filters.'
                  : 'Legislators will appear here once data is available.'
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

          {/* Legislators grid */}
          {!isLoading && !error && legislators.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {legislators.map((legislator) => (
                  <LegislatorCard key={legislator.id} legislator={legislator} />
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
