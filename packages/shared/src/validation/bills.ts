/**
 * Bill ID validation functions
 *
 * Implements 3-layer defense against injection attacks and ReDoS:
 * 1. Type Guard: Prevents type confusion
 * 2. Length Guard: Prevents ReDoS (CPU exhaustion)
 * 3. Format Validation: Prevents injection attacks
 *
 * @module @ltip/shared/validation/bills
 */

import type { ValidationResult } from './types.js';
import { ValidationErrorCode } from './types.js';

/**
 * Maximum allowed length for bill IDs
 *
 * Rationale: Longest realistic bill ID is ~16 characters ("hconres-9999-119")
 * This provides a 3x safety margin while preventing ReDoS attacks via
 * excessively long strings that cause catastrophic backtracking in regex.
 *
 * @constant
 */
export const BILL_ID_MAX_LENGTH = 50;

/**
 * Regular expression pattern for valid bill IDs
 *
 * Format: billType-billNumber-congressNumber
 * - billType: lowercase letters (hr, s, hjres, hconres, etc.)
 * - billNumber: one or more digits
 * - congressNumber: one or more digits
 *
 * Examples: "hr-1234-118", "s-567-119", "hjres-45-118"
 *
 * @constant
 */
export const BILL_ID_PATTERN = /^[a-z]+(-[0-9]+){2}$/;

/**
 * Fast boolean validator for bill IDs
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
 * @returns `true` if valid bill ID, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isValidBillId('hr-1234-118')) {
 *   // ID is valid
 * }
 *
 * isValidBillId('HR-1234-118') // false (uppercase)
 * isValidBillId('../../etc/passwd') // false (path traversal)
 * isValidBillId('a'.repeat(100000)) // false (ReDoS attempt, <1ms)
 * ```
 */
export function isValidBillId(id: unknown): boolean {
  // Layer 1: Type Guard (prevents type confusion attacks)
  if (typeof id !== 'string') {
    return false;
  }

  // Layer 2: Length Guard (prevents ReDoS - GAP-2 fix)
  // Rejects excessively long strings BEFORE regex processing
  // This ensures O(1) rejection instead of O(n) catastrophic backtracking
  if (id.length === 0 || id.length > BILL_ID_MAX_LENGTH) {
    return false;
  }

  // Layer 3: Format Validation (prevents injection - GAP-1 fix)
  // Safe to execute regex now that length is bounded
  return BILL_ID_PATTERN.test(id);
}

/**
 * Rich validator for bill IDs with detailed error messages
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
 * const result = validateBillId('HR-1234-118');
 * if (!result.valid) {
 *   res.status(400).json({
 *     error: result.error,
 *     code: result.code,
 *     details: result.context
 *   });
 * }
 * ```
 */
export function validateBillId(id: unknown): ValidationResult {
  // Layer 1: Type Guard
  if (typeof id !== 'string') {
    return {
      valid: false,
      error: 'Bill ID must be a string',
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
      error: 'Bill ID cannot be empty',
      code: ValidationErrorCode.EMPTY_VALUE,
      context: {
        received: id,
        expected: 'billType-billNumber-congressNumber',
      },
    };
  }

  // Layer 2b: Length Guard (ReDoS prevention)
  if (id.length > BILL_ID_MAX_LENGTH) {
    return {
      valid: false,
      error: `Bill ID exceeds maximum length (${BILL_ID_MAX_LENGTH} characters)`,
      code: ValidationErrorCode.EXCEEDS_MAX_LENGTH,
      context: {
        received: id.length,
        constraint: BILL_ID_MAX_LENGTH,
      },
    };
  }

  // Layer 3: Format Validation
  if (!BILL_ID_PATTERN.test(id)) {
    return {
      valid: false,
      error: 'Bill ID format must be: billType-billNumber-congressNumber (e.g., "hr-1234-118")',
      code: ValidationErrorCode.INVALID_FORMAT,
      context: {
        received: id,
        expected: 'billType-billNumber-congressNumber',
      },
    };
  }

  // All layers passed
  return {
    valid: true,
  };
}
