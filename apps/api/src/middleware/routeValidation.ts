/**
 * Route Parameter Validation Middleware
 *
 * Provides Express middleware for validating route parameters using the
 * shared validation library (@ltip/shared/validation).
 *
 * Defense-in-Depth Layer 2: API Middleware Validation
 * - Layer 1: Frontend route validation (404)
 * - Layer 2: **API middleware validation (400)** ← This file
 * - Layer 3: Backend service validation (error throw)
 * - Layer 4: Database parameterized queries
 *
 * Security Gaps Addressed:
 * - GAP-1 (CVSS 7.5 HIGH): Validation bypass via direct API calls
 * - GAP-2 (CVSS 5.3 MEDIUM): ReDoS via long input strings (length guards)
 *
 * @module api/middleware/routeValidation
 */

import type { Request, Response, NextFunction } from 'express';
import {
  validateBillId,
  validateLegislatorId,
  type ValidationResult,
} from '@ltip/shared/validation';

/**
 * Express middleware to validate bill ID route parameters
 *
 * Validates the `:id` parameter against bill ID format requirements.
 * Returns 400 Bad Request with detailed error information if invalid.
 *
 * Security Features:
 * - Type guard: Rejects non-strings
 * - Length guard: Prevents ReDoS attacks (<1ms guaranteed)
 * - Format validation: Prevents injection attacks (XSS, SQL, path traversal)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * // Apply to specific route
 * billsRouter.get('/:id', validateBillIdParam, async (req, res) => {
 *   // req.params.id is guaranteed to be a valid bill ID
 *   const billId = req.params.id;
 *   // ...
 * });
 * ```
 */
export function validateBillIdParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;

  // Use shared validation library (single source of truth)
  const result: ValidationResult = validateBillId(id);

  if (!result.valid) {
    // Return 400 Bad Request with structured error response
    res.status(400).json({
      error: result.error,
      code: result.code,
      details: result.context,
    });
    return;
  }

  // Validation passed - continue to route handler
  next();
}

/**
 * Express middleware to validate legislator ID route parameters
 *
 * Validates the `:id` parameter against legislator ID (Bioguide) format requirements.
 * Returns 400 Bad Request with detailed error information if invalid.
 *
 * Security Features:
 * - Type guard: Rejects non-strings
 * - Length guard: Prevents ReDoS attacks (<1ms guaranteed)
 * - Format validation: Prevents injection attacks (XSS, SQL, path traversal)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * // Apply to specific route
 * legislatorsRouter.get('/:id', validateLegislatorIdParam, async (req, res) => {
 *   // req.params.id is guaranteed to be a valid Bioguide ID
 *   const legislatorId = req.params.id;
 *   // ...
 * });
 * ```
 */
export function validateLegislatorIdParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;

  // Use shared validation library (single source of truth)
  const result: ValidationResult = validateLegislatorId(id);

  if (!result.valid) {
    // Return 400 Bad Request with structured error response
    res.status(400).json({
      error: result.error,
      code: result.code,
      details: result.context,
    });
    return;
  }

  // Validation passed - continue to route handler
  next();
}
