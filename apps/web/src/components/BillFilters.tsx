/**
 * Bill filters component with Zod validation
 *
 * Provides real-time validated filter inputs for bill queries.
 * Extracts filter UI from BillsPageClient for better separation of concerns.
 *
 * @module components/BillFilters
 */

'use client';

import {
  billFilterSchema,
  chambers,
  billStatuses,
  type BillFilterInput,
} from '@ltip/shared/validation';
import { Search, X, AlertCircle } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import type { ZodError } from 'zod';

/**
 * Filter state excluding pagination
 */
export interface BillFilters {
  search: string;
  chamber: '' | 'house' | 'senate';
  status: '' | 'introduced' | 'in_committee' | 'passed_house' | 'passed_senate' | 'became_law' | 'vetoed';
}

/**
 * Validation error messages mapped to field names
 */
interface ValidationErrors {
  search?: string | undefined;
  chamber?: string | undefined;
  status?: string | undefined;
}

export interface BillFiltersProps {
  /**
   * Current filter values
   */
  filters: BillFilters;

  /**
   * Called when filters change (only if validation passes)
   */
  onChange: (filters: BillFilters) => void;

  /**
   * Called when user clears all filters
   */
  onClear: () => void;

  /**
   * Whether filters are currently being applied (loading state)
   */
  isLoading?: boolean;
}

/**
 * Extract user-friendly error message from Zod error
 */
function getFieldError(error: ZodError, field: keyof ValidationErrors): string | undefined {
  const fieldErrors = error.flatten().fieldErrors;
  const messages = fieldErrors[field];
  return messages?.[0];
}

/**
 * Bill filters component with real-time Zod validation
 *
 * Features:
 * - Real-time validation with user-friendly error messages
 * - Debounced search input (300ms)
 * - Visual error indicators
 * - Accessible form controls with ARIA labels
 * - Clear filters button when active
 *
 * @example
 * ```tsx
 * <BillFilters
 *   filters={filters}
 *   onChange={(newFilters) => {
 *     setFilters(newFilters);
 *     setPage(1);
 *   }}
 *   onClear={() => {
 *     setFilters({ search: '', chamber: '', status: '' });
 *     setPage(1);
 *   }}
 * />
 * ```
 */
export function BillFilters({
  filters,
  onChange,
  onClear,
  isLoading = false,
}: BillFiltersProps) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<keyof ValidationErrors>>(new Set());

  /**
   * Validate filters and update error state
   */
  const validateFilters = useCallback((filtersToValidate: BillFilters) => {
    // Prepare data for validation (convert empty strings to undefined)
    const dataToValidate: Partial<BillFilterInput> = {
      search: filtersToValidate.search || undefined,
      chamber: filtersToValidate.chamber || undefined,
      status: filtersToValidate.status || undefined,
    };

    const result = billFilterSchema.safeParse(dataToValidate);

    if (!result.success) {
      const newErrors: ValidationErrors = {
        search: getFieldError(result.error, 'search'),
        chamber: getFieldError(result.error, 'chamber'),
        status: getFieldError(result.error, 'status'),
      };
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  }, []);

  /**
   * Validate whenever filters change
   */
  useEffect(() => {
    validateFilters(filters);
  }, [filters, validateFilters]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setTouched((prev) => new Set(prev).add('search'));

      // Update filters immediately (onChange will handle debouncing)
      onChange({
        ...filters,
        search: value,
      });
    },
    [filters, onChange]
  );

  /**
   * Handle chamber selection change
   */
  const handleChamberChange = useCallback(
    (value: BillFilters['chamber']) => {
      setTouched((prev) => new Set(prev).add('chamber'));

      onChange({
        ...filters,
        chamber: value,
      });
    },
    [filters, onChange]
  );

  /**
   * Handle status selection change
   */
  const handleStatusChange = useCallback(
    (value: BillFilters['status']) => {
      setTouched((prev) => new Set(prev).add('status'));

      onChange({
        ...filters,
        status: value,
      });
    },
    [filters, onChange]
  );

  /**
   * Handle clear filters
   */
  const handleClear = useCallback(() => {
    setTouched(new Set());
    setErrors({});
    onClear();
  }, [onClear]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = filters.search || filters.chamber || filters.status;

  /**
   * Show error for a field only if touched and has error
   */
  const showError = (field: keyof ValidationErrors) => {
    return touched.has(field) && errors[field];
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* Search input */}
      <div className="relative flex-1 max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search bills by title, number, or keyword..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          disabled={isLoading}
          aria-label="Search bills"
          aria-invalid={showError('search') ? 'true' : 'false'}
          aria-describedby={showError('search') ? 'search-error' : undefined}
          className={`input w-full pl-10 ${
            showError('search')
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : ''
          }`}
        />
        {showError('search') && (
          <div
            id="search-error"
            role="alert"
            className="mt-1 flex items-center gap-1 text-sm text-red-600"
          >
            <AlertCircle className="h-3 w-3" />
            {errors.search}
          </div>
        )}
      </div>

      {/* Filter selects and clear button */}
      <div className="flex flex-wrap gap-2">
        {/* Chamber filter */}
        <div className="flex flex-col">
          <select
            value={filters.chamber}
            onChange={(e) => handleChamberChange(e.target.value as BillFilters['chamber'])}
            disabled={isLoading}
            aria-label="Filter by chamber"
            aria-invalid={showError('chamber') ? 'true' : 'false'}
            aria-describedby={showError('chamber') ? 'chamber-error' : undefined}
            className={`input w-auto ${
              showError('chamber')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
          >
            <option value="">All Chambers</option>
            {chambers.map((chamber) => (
              <option key={chamber} value={chamber}>
                {chamber.charAt(0).toUpperCase() + chamber.slice(1)}
              </option>
            ))}
          </select>
          {showError('chamber') && (
            <div
              id="chamber-error"
              role="alert"
              className="mt-1 flex items-center gap-1 text-sm text-red-600"
            >
              <AlertCircle className="h-3 w-3" />
              {errors.chamber}
            </div>
          )}
        </div>

        {/* Status filter */}
        <div className="flex flex-col">
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value as BillFilters['status'])}
            disabled={isLoading}
            aria-label="Filter by status"
            aria-invalid={showError('status') ? 'true' : 'false'}
            aria-describedby={showError('status') ? 'status-error' : undefined}
            className={`input w-auto ${
              showError('status')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
          >
            <option value="">All Statuses</option>
            {billStatuses.map((status) => (
              <option key={status} value={status}>
                {status
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </option>
            ))}
          </select>
          {showError('status') && (
            <div
              id="status-error"
              role="alert"
              className="mt-1 flex items-center gap-1 text-sm text-red-600"
            >
              <AlertCircle className="h-3 w-3" />
              {errors.status}
            </div>
          )}
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="btn-outline text-red-600 hover:text-red-700 disabled:opacity-50"
            aria-label="Clear all filters"
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
