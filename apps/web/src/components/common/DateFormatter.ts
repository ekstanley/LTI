/**
 * Utility functions for formatting dates
 * @module components/common/DateFormatter
 */

/**
 * Format a date string for display in a human-readable format.
 *
 * @param dateString - ISO 8601 date string (e.g., "2023-01-03")
 * @returns Formatted date string (e.g., "January 3, 2023")
 *
 * @example
 * ```ts
 * formatDate("2023-01-03") // "January 3, 2023"
 * formatDate("2023-12-25") // "December 25, 2023"
 * ```
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
