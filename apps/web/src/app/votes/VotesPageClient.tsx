/**
 * Live votes page client component with real API connection
 * Uses SWR polling for live updates (WebSocket upgrade path available)
 * @module app/votes/VotesPageClient
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Vote as VoteIcon,
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  X,
} from 'lucide-react';
import { useVotes } from '@/hooks';
import { Navigation, LoadingState, EmptyState, Pagination, ErrorFallback } from '@/components/common';
import type { VotesQueryParams } from '@/lib/api';
import {
  VOTE_RESULT_LABELS,
  CHAMBER_SHORT_LABELS,
} from '@ltip/shared';
import type { Vote, VoteResult, Chamber } from '@ltip/shared';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 30000; // 30 seconds for live updates

type ResultFilter = 'passed' | 'failed' | 'agreed_to' | 'rejected' | '';
type ChamberFilter = 'house' | 'senate' | '';

interface Filters {
  chamber: ChamberFilter;
  result: ResultFilter;
}

/**
 * Vote result badge with color coding
 */
function ResultBadge({ result }: { result: VoteResult }) {
  const label = VOTE_RESULT_LABELS[result] ?? result;
  const isPositive = result === 'passed' || result === 'agreed_to';
  const colors = isPositive
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {isPositive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

/**
 * Vote tally bar component showing visual breakdown
 */
function TallyBar({
  yeas,
  nays,
  present,
  notVoting,
}: {
  yeas: number;
  nays: number;
  present: number;
  notVoting: number;
}) {
  const total = yeas + nays + present + notVoting;
  if (total === 0) return null;

  const yeaPercent = (yeas / total) * 100;
  const nayPercent = (nays / total) * 100;
  const presentPercent = (present / total) * 100;

  return (
    <div className="space-y-2">
      {/* Visual bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="bg-green-500 transition-all duration-300"
          style={{ width: `${yeaPercent}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-300"
          style={{ width: `${nayPercent}%` }}
        />
        <div
          className="bg-yellow-500 transition-all duration-300"
          style={{ width: `${presentPercent}%` }}
        />
      </div>

      {/* Numeric breakdown */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-green-600" />
          <span className="font-medium text-green-700">{yeas}</span> Yea
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="h-3 w-3 text-red-600" />
          <span className="font-medium text-red-700">{nays}</span> Nay
        </span>
        <span className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-yellow-600" />
          <span className="font-medium text-yellow-700">{present}</span> Present
        </span>
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-gray-400" />
          <span className="font-medium text-gray-500">{notVoting}</span> Not Voting
        </span>
      </div>
    </div>
  );
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Vote card component for the list view
 */
function VoteCard({ vote }: { vote: Vote }) {
  const chamberLabel = CHAMBER_SHORT_LABELS[vote.chamber as Chamber] ?? vote.chamber;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Building2 className="h-4 w-4" />
              <span>{chamberLabel}</span>
              <span>&middot;</span>
              <Calendar className="h-4 w-4" />
              <span>{formatDate(vote.date)}</span>
              <span>&middot;</span>
              <span>Roll Call #{vote.rollCallNumber}</span>
            </div>
            <p className="text-gray-900 font-medium line-clamp-2">{vote.question}</p>
          </div>
          <ResultBadge result={vote.result} />
        </div>

        {/* Tally bar */}
        <TallyBar
          yeas={vote.yeas}
          nays={vote.nays}
          present={vote.present}
          notVoting={vote.notVoting}
        />

        {/* Footer */}
        {vote.billId && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <Link
              href={`/bills/${vote.billId}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Associated Bill
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Live status indicator
 */
function LiveIndicator({ isRefreshing }: { isRefreshing: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${
          isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
        }`}
      />
      <span className="text-gray-600">
        {isRefreshing ? 'Updating...' : 'Live'}
      </span>
    </div>
  );
}

export function VotesPageClient() {
  // Filter state
  const [filters, setFilters] = useState<Filters>({
    chamber: '',
    result: '',
  });
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Build query params
  const queryParams = useMemo<VotesQueryParams>(() => {
    const params: VotesQueryParams = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    if (filters.chamber) {
      params.chamber = filters.chamber;
    }
    if (filters.result) {
      params.result = filters.result;
    }

    return params;
  }, [filters, page]);

  // Fetch votes with polling for live updates
  const { votes, pagination, isLoading, isValidating, error, mutate } = useVotes({
    ...queryParams,
  });

  // Set up polling interval for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
      setLastUpdated(new Date());
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [mutate]);

  // Handlers
  const handleChamberChange = useCallback((value: ChamberFilter) => {
    setFilters((prev) => ({ ...prev, chamber: value }));
    setPage(1);
  }, []);

  const handleResultChange = useCallback((value: ResultFilter) => {
    setFilters((prev) => ({ ...prev, result: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ chamber: '', result: '' });
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleManualRefresh = useCallback(() => {
    mutate();
    setLastUpdated(new Date());
  }, [mutate]);

  // Calculate total pages
  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 0;

  // Check if any filters are active
  const hasActiveFilters = filters.chamber || filters.result;

  return (
    <>
      <Navigation />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <VoteIcon className="h-8 w-8 text-blue-600" />
                Live Votes
              </h1>
              <p className="mt-2 text-gray-600">
                Real-time tracking of congressional votes with automatic updates
              </p>
            </div>
            <div className="flex items-center gap-4">
              <LiveIndicator isRefreshing={isValidating} />
              <button
                onClick={handleManualRefresh}
                disabled={isValidating}
                className="btn-outline flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
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
              value={filters.result}
              onChange={(e) => handleResultChange(e.target.value as ResultFilter)}
              className="input w-auto"
            >
              <option value="">All Results</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="agreed_to">Agreed To</option>
              <option value="rejected">Rejected</option>
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

            {/* Last updated timestamp */}
            <div className="ml-auto text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <ErrorFallback
              error={error}
              title="Failed to load votes"
              onRetry={() => mutate()}
            />
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <LoadingState message="Loading live votes..." size="lg" fullPage />
          )}

          {/* Empty state */}
          {!isLoading && !error && votes.length === 0 && (
            <EmptyState
              variant={hasActiveFilters ? 'search' : 'default'}
              title={hasActiveFilters ? 'No votes match your filters' : 'No votes found'}
              message={
                hasActiveFilters
                  ? 'Try adjusting your filters or clearing them.'
                  : 'Votes will appear here as they occur in Congress.'
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

          {/* Votes list */}
          {!isLoading && !error && votes.length > 0 && (
            <>
              {/* Stats summary */}
              {pagination && (
                <div className="mb-4 text-sm text-gray-600">
                  Showing {votes.length} of {pagination.total} votes
                </div>
              )}

              <div className="grid gap-4">
                {votes.map((vote) => (
                  <VoteCard key={vote.id} vote={vote} />
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
