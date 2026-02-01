/**
 * Validation types for the LTIP shared validation library
 *
 * @module @ltip/shared/validation/types
 */

/**
 * Standardized validation error codes
 */
export enum ValidationErrorCode {
  /** Input is not a string */
  INVALID_TYPE = 'INVALID_TYPE',

  /** Input is empty or null */
  EMPTY_VALUE = 'EMPTY_VALUE',

  /** Input exceeds maximum allowed length */
  EXCEEDS_MAX_LENGTH = 'EXCEEDS_MAX_LENGTH',

  /** Input format doesn't match expected pattern */
  INVALID_FORMAT = 'INVALID_FORMAT',

  /** Input contains forbidden characters */
  FORBIDDEN_CHARACTERS = 'FORBIDDEN_CHARACTERS',
}

/**
 * Context information for validation errors
 */
export interface ValidationContext {
  /** The value that failed validation */
  received?: unknown;

  /** The expected format or pattern */
  expected?: string;

  /** The constraint that was violated (e.g., max length) */
  constraint?: string | number;
}

/**
 * Result of a validation operation with detailed error information
 *
 * @example
 * ```typescript
 * const result = validateBillId('hr-1234-118');
 * if (result.valid) {
 *   // ID is valid
 * } else {
 *   console.error(result.error);
 *   // Handle error with result.code and result.context
 * }
 * ```
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** Human-readable error message (only present if valid === false) */
  error?: string;

  /** Machine-readable error code (only present if valid === false) */
  code?: ValidationErrorCode;

  /** Additional context about the validation failure */
  context?: ValidationContext;
}
