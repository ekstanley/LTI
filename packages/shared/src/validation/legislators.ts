/**
 * Legislator ID validation functions
 *
 * Implements 3-layer defense against injection attacks and ReDoS:
 * 1. Type Guard: Prevents type confusion
 * 2. Length Guard: Prevents ReDoS (CPU exhaustion)
 * 3. Format Validation: Prevents injection attacks
 *
 * @module @ltip/shared/validation/legislators
 */

import type { ValidationResult } from './types.js';
import { ValidationErrorCode } from './types.js';

/**
 * Maximum allowed length for legislator IDs
 *
 * Rationale: Bioguide IDs are exactly 7 characters (one uppercase letter + 6 digits)
 * This provides a ~3x safety margin while preventing ReDoS attacks via
 * excessively long strings that cause catastrophic backtracking in regex.
 *
 * @constant
 */
export const LEGISLATOR_ID_MAX_LENGTH = 20;

/**
 * Regular expression pattern for valid legislator IDs (Bioguide format)
 *
 * Format: One uppercase letter + 6 digits
 * - First character: Uppercase A-Z
 * - Next 6 characters: Digits 0-9
 *
 * Examples: "A000360", "S001198", "M001111"
 *
 * @constant
 */
export const LEGISLATOR_ID_PATTERN = /^[A-Z][0-9]{6}$/;

/**
 * Fast boolean validator for legislator IDs
 *
 * Use this when you only need a yes/no answer without detailed error messages.
 * Implements 3-layer security defense:
 * 1. Type guard: Rejects non-strings
 * 2. Length guard: Prevents ReDoS attacks
 * 3. Format validation: Prevents injection attacks
 *
 * Performance: O(1) effective (length-bounded), <1ms guaranteed
 *
 * @param id - Value to validate (accepts any type for safety)
 * @returns `true` if valid legislator ID, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isValidLegislatorId('A000360')) {
 *   // ID is valid
 * }
 *
 * isValidLegislatorId('a000360') // false (lowercase)
 * isValidLegislatorId('../../etc/passwd') // false (path traversal)
 * isValidLegislatorId('A' + '0'.repeat(100000)) // false (ReDoS attempt, <1ms)
 * ```
 */
export function isValidLegislatorId(id: unknown): boolean {
  // Layer 1: Type Guard (prevents type confusion attacks)
  if (typeof id !== 'string') {
    return false;
  }

  // Layer 2: Length Guard (prevents ReDoS - GAP-2 fix)
  // Rejects excessively long strings BEFORE regex processing
  // This ensures O(1) rejection instead of O(n) catastrophic backtracking
  if (id.length === 0 || id.length > LEGISLATOR_ID_MAX_LENGTH) {
    return false;
  }

  // Layer 3: Format Validation (prevents injection - GAP-1 fix)
  // Safe to execute regex now that length is bounded
  return LEGISLATOR_ID_PATTERN.test(id);
}

/**
 * Rich validator for legislator IDs with detailed error messages
 *
 * Use this when you need to provide user-facing error messages,
 * especially in API responses. Returns structured error information
 * including error codes and context.
 *
 * @param id - Value to validate (accepts any type for safety)
 * @returns Validation result with detailed error information if invalid
 *
 * @example
 * ```typescript
 * const result = validateLegislatorId('a000360');
 * if (!result.valid) {
 *   res.status(400).json({
 *     error: result.error,
 *     code: result.code,
 *     details: result.context
 *   });
 * }
 * ```
 */
export function validateLegislatorId(id: unknown): ValidationResult {
  // Layer 1: Type Guard
  if (typeof id !== 'string') {
    return {
      valid: false,
      error: 'Legislator ID must be a string',
      code: ValidationErrorCode.INVALID_TYPE,
      context: {
        received: typeof id,
        expected: 'string',
      },
    };
  }

  // Layer 2a: Empty Check
  if (id.length === 0) {
    return {
      valid: false,
      error: 'Legislator ID cannot be empty',
      code: ValidationErrorCode.EMPTY_VALUE,
      context: {
        received: id,
        expected: 'Bioguide ID (e.g., "A000360")',
      },
    };
  }

  // Layer 2b: Length Guard (ReDoS prevention)
  if (id.length > LEGISLATOR_ID_MAX_LENGTH) {
    return {
      valid: false,
      error: `Legislator ID exceeds maximum length (${LEGISLATOR_ID_MAX_LENGTH} characters)`,
      code: ValidationErrorCode.EXCEEDS_MAX_LENGTH,
      context: {
        received: id.length,
        constraint: LEGISLATOR_ID_MAX_LENGTH,
      },
    };
  }

  // Layer 3: Format Validation
  if (!LEGISLATOR_ID_PATTERN.test(id)) {
    return {
      valid: false,
      error: 'Legislator ID format must be: one uppercase letter + 6 digits (e.g., "A000360")',
      code: ValidationErrorCode.INVALID_FORMAT,
      context: {
        received: id,
        expected: 'Bioguide ID (letter + 6 digits)',
      },
    };
  }

  // All layers passed
  return {
    valid: true,
  };
}
