/**
 * Tests for DateFormatter utility
 * @module components/common/__tests__/DateFormatter.test
 *
 * NOTE: formatDate() uses `new Date(dateString).toLocaleDateString('en-US', ...)`
 * Date-only strings like '2023-01-03' are parsed as UTC midnight per ISO 8601,
 * which can shift to the previous day in negative-offset timezones.
 * Tests use 'T12:00:00' suffix to avoid timezone boundary issues.
 */

import { describe, it, expect } from 'vitest';
import { formatDate } from '../DateFormatter';

describe('formatDate', () => {
  it('should format a standard date string', () => {
    expect(formatDate('2023-01-03T12:00:00')).toBe('January 3, 2023');
  });

  it('should format a December date', () => {
    expect(formatDate('2023-12-25T12:00:00')).toBe('December 25, 2023');
  });

  it('should format a leap day', () => {
    expect(formatDate('2024-02-29T12:00:00')).toBe('February 29, 2024');
  });

  it('should format an ISO datetime string with UTC timezone', () => {
    const result = formatDate('2023-06-15T14:30:00Z');
    expect(result).toContain('2023');
    expect(result).toContain('June');
  });

  it('should format the first day of a year', () => {
    expect(formatDate('2025-01-01T12:00:00')).toBe('January 1, 2025');
  });

  it('should return "Invalid Date" for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });
});
