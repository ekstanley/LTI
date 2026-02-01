/**
 * LTIP Shared Validation Library
 *
 * Single source of truth for input validation across all application layers.
 * Provides defense-in-depth validation with:
 * - Type guards (Layer 1)
 * - Length guards (Layer 2) - Prevents ReDoS attacks
 * - Format validation (Layer 3) - Prevents injection attacks
 *
 * Security Gaps Addressed:
 * - GAP-1 (CVSS 7.5 HIGH): Validation bypass vulnerability
 * - GAP-2 (CVSS 5.3 MEDIUM): ReDoS vulnerability
 *
 * @module @ltip/shared/validation
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export { ValidationErrorCode } from './types';
export type { ValidationResult, ValidationContext } from './types';

// ============================================================================
// Bill Validation
// ============================================================================

export {
  isValidBillId,
  validateBillId,
  BILL_ID_MAX_LENGTH,
  BILL_ID_PATTERN,
} from './bills';

// ============================================================================
// Legislator Validation
// ============================================================================

export {
  isValidLegislatorId,
  validateLegislatorId,
  LEGISLATOR_ID_MAX_LENGTH,
  LEGISLATOR_ID_PATTERN,
} from './legislators';

// ============================================================================
// Filter Validation (Zod Schemas)
// ============================================================================

export {
  billFilterSchema,
  voteFilterSchema,
  legislatorFilterSchema,
  billTypes,
  billStatuses,
  chambers,
  voteResults,
  legislatorChambers,
  parties,
} from './filters';

export type {
  BillFilterInput,
  VoteFilterInput,
  LegislatorFilterInput,
} from './filters';
