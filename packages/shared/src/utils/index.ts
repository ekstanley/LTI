/**
 * Shared utility functions for LTIP
 */

// ============================================================================
// Bill Utilities
// ============================================================================

/**
 * Formats a bill identifier from its components
 * @example formatBillId('hr', 1234, 118) => 'HR 1234 (118th)'
 */
export function formatBillId(
  billType: string,
  billNumber: number,
  congressNumber: number
): string {
  const typeLabel = billType.toUpperCase();
  const suffix = getOrdinalSuffix(congressNumber);
  return `${typeLabel} ${billNumber} (${congressNumber}${suffix})`;
}

/**
 * Parses a bill URL slug into components
 * @example parseBillSlug('hr-1234-118') => { billType: 'hr', billNumber: 1234, congressNumber: 118 }
 */
export function parseBillSlug(slug: string): {
  billType: string;
  billNumber: number;
  congressNumber: number;
} | null {
  const match = slug.match(/^([a-z]+)-(\d+)-(\d+)$/i);
  if (!match) return null;

  return {
    billType: match[1].toLowerCase(),
    billNumber: parseInt(match[2], 10),
    congressNumber: parseInt(match[3], 10),
  };
}

/**
 * Creates a URL-safe slug for a bill
 */
export function createBillSlug(
  billType: string,
  billNumber: number,
  congressNumber: number
): string {
  return `${billType.toLowerCase()}-${billNumber}-${congressNumber}`;
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Formats an ISO date string for display
 * @example formatDate('2024-01-15') => 'January 15, 2024'
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a date as relative time
 * @example formatRelativeTime('2024-01-15T10:00:00Z') => '2 hours ago'
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDate(isoDate);
}

// ============================================================================
// Number Utilities
// ============================================================================

/**
 * Gets ordinal suffix for a number
 * @example getOrdinalSuffix(118) => 'th'
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Formats a number with commas
 * @example formatNumber(1234567) => '1,234,567'
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Formats a number as currency
 * @example formatCurrency(1234567890) => '$1.23B'
 */
export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1e12) {
    return `${sign}$${(absAmount / 1e12).toFixed(2)}T`;
  }
  if (absAmount >= 1e9) {
    return `${sign}$${(absAmount / 1e9).toFixed(2)}B`;
  }
  if (absAmount >= 1e6) {
    return `${sign}$${(absAmount / 1e6).toFixed(2)}M`;
  }
  if (absAmount >= 1e3) {
    return `${sign}$${(absAmount / 1e3).toFixed(2)}K`;
  }

  return `${sign}$${absAmount.toFixed(2)}`;
}

/**
 * Formats a percentage
 * @example formatPercent(0.7532) => '75.3%'
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================================================
// Score Utilities
// ============================================================================

/**
 * Converts bias score (-1 to +1) to label
 */
export function getBiasLabel(score: number): string {
  if (score <= -0.6) return 'Strong Left';
  if (score <= -0.2) return 'Lean Left';
  if (score <= 0.2) return 'Center';
  if (score <= 0.6) return 'Lean Right';
  return 'Strong Right';
}

/**
 * Gets color class for bias score (Tailwind compatible)
 */
export function getBiasColor(score: number): string {
  if (score <= -0.6) return 'text-blue-700';
  if (score <= -0.2) return 'text-blue-500';
  if (score <= 0.2) return 'text-gray-600';
  if (score <= 0.6) return 'text-red-500';
  return 'text-red-700';
}

/**
 * Gets passage probability label
 */
export function getPassageLabel(probability: number): string {
  if (probability < 0.2) return 'Very Unlikely';
  if (probability < 0.4) return 'Unlikely';
  if (probability < 0.6) return 'Possible';
  if (probability < 0.8) return 'Likely';
  return 'Very Likely';
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncates text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Capitalizes first letter of each word
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Converts snake_case or kebab-case to Title Case
 */
export function formatLabel(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates US state code (2 letters)
 */
export function isValidStateCode(code: string): boolean {
  const validStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
  ]);
  return validStates.has(code.toUpperCase());
}
