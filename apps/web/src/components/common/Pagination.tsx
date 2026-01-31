/**
 * Pagination component for navigating through data pages
 * @module components/common/Pagination
 */

'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  /** Current page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems?: number;
  /** Items per page */
  pageSize?: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Whether to show first/last buttons */
  showFirstLast?: boolean;
  /** Whether to show item count */
  showItemCount?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Disable all controls */
  disabled?: boolean;
}

/**
 * Pagination controls with prev/next navigation and page info.
 *
 * @example
 * ```tsx
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   totalItems={100}
 *   pageSize={10}
 *   onPageChange={setPage}
 * />
 * ```
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 20,
  onPageChange,
  showFirstLast = true,
  showItemCount = true,
  className,
  disabled = false,
}: PaginationProps) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const startItem = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  const handlePageChange = (page: number) => {
    if (disabled) return;
    if (page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  if (totalPages <= 1 && !showItemCount) {
    return null;
  }

  return (
    <nav
      className={cn('flex items-center justify-between', className)}
      aria-label="Pagination"
    >
      {/* Item count */}
      {showItemCount && totalItems !== undefined && (
        <p className="text-sm text-gray-500">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems.toLocaleString()}</span> results
        </p>
      )}

      {/* Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {showFirstLast && (
            <PaginationButton
              onClick={() => handlePageChange(1)}
              disabled={disabled || !canGoPrevious}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationButton>
          )}

          <PaginationButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={disabled || !canGoPrevious}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </PaginationButton>

          {/* Page indicator */}
          <span className="px-3 text-sm text-gray-700">
            Page <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </span>

          <PaginationButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={disabled || !canGoNext}
            aria-label="Go to next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </PaginationButton>

          {showFirstLast && (
            <PaginationButton
              onClick={() => handlePageChange(totalPages)}
              disabled={disabled || !canGoNext}
              aria-label="Go to last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationButton>
          )}
        </div>
      )}
    </nav>
  );
}

interface PaginationButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
}

function PaginationButton({
  onClick,
  disabled,
  children,
  'aria-label': ariaLabel,
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'text-gray-700 hover:bg-gray-50'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Simple pagination with just previous/next buttons
 */
export function SimplePagination({
  hasMore,
  hasPrevious,
  onNext,
  onPrevious,
  disabled = false,
  className,
}: {
  hasMore: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex justify-center gap-2', className)}>
      <PaginationButton
        onClick={onPrevious}
        disabled={disabled || !hasPrevious}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </PaginationButton>
      <PaginationButton
        onClick={onNext}
        disabled={disabled || !hasMore}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </PaginationButton>
    </div>
  );
}
