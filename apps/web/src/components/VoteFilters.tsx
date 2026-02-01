/**
 * Vote filters component with Zod validation
 *
 * Provides real-time validated filter inputs for vote queries.
 * Extracts filter UI from VotesPageClient for better separation of concerns.
 *
 * @module components/VoteFilters
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import {
  voteFilterSchema,
  chambers,
  voteResults,
  type VoteFilterInput,
} from '@ltip/shared/validation';
import type { ZodError } from 'zod';

/**
 * Filter state excluding pagination
 */
export interface VoteFilters {
  chamber: '' | 'house' | 'senate';
  result: '' | 'passed' | 'failed' | 'agreed_to' | 'rejected';
}

/**
 * Validation error messages mapped to field names
 */
interface ValidationErrors {
  chamber?: string | undefined;
  result?: string | undefined;
}

export interface VoteFiltersProps {
  /**
   * Current filter values
   */
  filters: VoteFilters;

  /**
   * Called when filters change (only if validation passes)
   */
  onChange: (filters: VoteFilters) => void;

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
 * Vote filters component with real-time Zod validation
 *
 * Features:
 * - Real-time validation with user-friendly error messages
 * - Visual error indicators
 * - Accessible form controls with ARIA labels
 * - Clear filters button when active
 *
 * @example
 * ```tsx
 * <VoteFilters
 *   filters={filters}
 *   onChange={(newFilters) => {
 *     setFilters(newFilters);
 *     setPage(1);
 *   }}
 *   onClear={() => {
 *     setFilters({ chamber: '', result: '' });
 *     setPage(1);
 *   }}
 * />
 * ```
 */
export function VoteFilters({
  filters,
  onChange,
  onClear,
  isLoading = false,
}: VoteFiltersProps) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<keyof ValidationErrors>>(new Set());

  /**
   * Validate filters and update error state
   */
  const validateFilters = useCallback((filtersToValidate: VoteFilters) => {
    // Prepare data for validation (convert empty strings to undefined)
    const dataToValidate: Partial<VoteFilterInput> = {
      chamber: filtersToValidate.chamber || undefined,
      result: filtersToValidate.result || undefined,
    };

    const result = voteFilterSchema.safeParse(dataToValidate);

    if (!result.success) {
      const newErrors: ValidationErrors = {
        chamber: getFieldError(result.error, 'chamber'),
        result: getFieldError(result.error, 'result'),
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
   * Handle chamber selection change
   */
  const handleChamberChange = useCallback(
    (value: VoteFilters['chamber']) => {
      setTouched((prev) => new Set(prev).add('chamber'));

      onChange({
        ...filters,
        chamber: value,
      });
    },
    [filters, onChange]
  );

  /**
   * Handle result selection change
   */
  const handleResultChange = useCallback(
    (value: VoteFilters['result']) => {
      setTouched((prev) => new Set(prev).add('result'));

      onChange({
        ...filters,
        result: value,
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
  const hasActiveFilters = filters.chamber || filters.result;

  /**
   * Show error for a field only if touched and has error
   */
  const showError = (field: keyof ValidationErrors) => {
    return touched.has(field) && errors[field];
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Chamber filter */}
      <div className="flex flex-col">
        <select
          value={filters.chamber}
          onChange={(e) => handleChamberChange(e.target.value as VoteFilters['chamber'])}
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

      {/* Result filter */}
      <div className="flex flex-col">
        <select
          value={filters.result}
          onChange={(e) => handleResultChange(e.target.value as VoteFilters['result'])}
          disabled={isLoading}
          aria-label="Filter by result"
          aria-invalid={showError('result') ? 'true' : 'false'}
          aria-describedby={showError('result') ? 'result-error' : undefined}
          className={`input w-auto ${
            showError('result')
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : ''
          }`}
        >
          <option value="">All Results</option>
          {voteResults.map((result) => (
            <option key={result} value={result}>
              {result
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </option>
          ))}
        </select>
        {showError('result') && (
          <div
            id="result-error"
            role="alert"
            className="mt-1 flex items-center gap-1 text-sm text-red-600"
          >
            <AlertCircle className="h-3 w-3" />
            {errors.result}
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
  );
}
