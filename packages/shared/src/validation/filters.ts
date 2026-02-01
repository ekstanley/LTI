/**
 * Filter validation schemas using Zod
 *
 * Provides client-side validation for filter inputs with real-time feedback.
 * Matches backend validation constraints for consistency.
 *
 * @module @ltip/shared/validation/filters
 */

import { z } from 'zod';

// ============================================================================
// Bill Filters
// ============================================================================

/**
 * Valid bill types in Congress
 */
export const billTypes = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres'] as const;

/**
 * Valid bill statuses
 */
export const billStatuses = [
  'introduced',
  'in_committee',
  'passed_house',
  'passed_senate',
  'became_law',
  'vetoed',
] as const;

/**
 * Valid chambers
 */
export const chambers = ['house', 'senate'] as const;

/**
 * Zod schema for bill filter inputs
 *
 * Validates filter parameters for bill queries with appropriate constraints:
 * - Search: 1-500 characters, trimmed
 * - Congress: Integer 1-200 (reasonable historical range)
 * - Chamber: house or senate
 * - Status: valid bill status enum
 * - Bill type: valid bill type enum
 * - Limit: 1-100 (prevent excessive results)
 * - Offset: non-negative integer
 *
 * @example
 * ```typescript
 * const result = billFilterSchema.safeParse({
 *   search: 'infrastructure',
 *   chamber: 'house',
 *   status: 'passed_house',
 * });
 *
 * if (result.success) {
 *   // Use validated data: result.data
 * } else {
 *   // Handle errors: result.error.flatten()
 * }
 * ```
 */
export const billFilterSchema = z
  .object({
    search: z
      .string()
      .trim()
      .min(1, 'Search must be at least 1 character')
      .max(500, 'Search cannot exceed 500 characters')
      .optional(),

    congress: z
      .number()
      .int('Congress must be an integer')
      .min(1, 'Congress must be at least 1')
      .max(200, 'Congress cannot exceed 200')
      .optional(),

    chamber: z.enum(chambers, {
      errorMap: () => ({ message: 'Chamber must be either "house" or "senate"' }),
    }).optional(),

    status: z.enum(billStatuses, {
      errorMap: () => ({ message: 'Invalid bill status' }),
    }).optional(),

    billType: z.enum(billTypes, {
      errorMap: () => ({ message: 'Invalid bill type' }),
    }).optional(),

    limit: z
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(20),

    offset: z
      .number()
      .int('Offset must be an integer')
      .min(0, 'Offset cannot be negative')
      .optional()
      .default(0),
  })
  .strict();

/**
 * TypeScript type inferred from bill filter schema
 */
export type BillFilterInput = z.infer<typeof billFilterSchema>;

// ============================================================================
// Vote Filters
// ============================================================================

/**
 * Valid vote results
 */
export const voteResults = ['passed', 'failed', 'agreed_to', 'rejected'] as const;

/**
 * Zod schema for vote filter inputs
 *
 * Validates filter parameters for vote queries:
 * - Chamber: house or senate
 * - Result: valid vote result enum
 * - Start date: valid ISO date string
 * - End date: valid ISO date string, must be after start date
 * - Bill ID: valid bill ID format
 * - Limit: 1-100
 * - Offset: non-negative integer
 *
 * @example
 * ```typescript
 * const result = voteFilterSchema.safeParse({
 *   chamber: 'senate',
 *   result: 'passed',
 *   startDate: '2024-01-01',
 * });
 *
 * if (result.success) {
 *   // Use validated data: result.data
 * } else {
 *   // Handle errors: result.error.flatten()
 * }
 * ```
 */
export const voteFilterSchema = z
  .object({
    chamber: z.enum(chambers, {
      errorMap: () => ({ message: 'Chamber must be either "house" or "senate"' }),
    }).optional(),

    result: z.enum(voteResults, {
      errorMap: () => ({ message: 'Invalid vote result' }),
    }).optional(),

    startDate: z
      .string()
      .datetime({ message: 'Start date must be a valid ISO date string' })
      .optional(),

    endDate: z
      .string()
      .datetime({ message: 'End date must be a valid ISO date string' })
      .optional(),

    billId: z
      .string()
      .trim()
      .min(1, 'Bill ID cannot be empty')
      .max(50, 'Bill ID cannot exceed 50 characters')
      .regex(/^[a-z]+(-[0-9]+){2}$/, 'Bill ID must match format: billType-number-congress')
      .optional(),

    limit: z
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(20),

    offset: z
      .number()
      .int('Offset must be an integer')
      .min(0, 'Offset cannot be negative')
      .optional()
      .default(0),
  })
  .strict()
  .refine(
    (data) => {
      // Validate that end date is after start date
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be after or equal to start date',
      path: ['endDate'],
    }
  );

/**
 * TypeScript type inferred from vote filter schema
 */
export type VoteFilterInput = z.infer<typeof voteFilterSchema>;

// ============================================================================
// Legislator Filters (for future use)
// ============================================================================

/**
 * Valid legislator chambers
 */
export const legislatorChambers = ['house', 'senate'] as const;

/**
 * Valid party affiliations
 */
export const parties = ['D', 'R', 'I'] as const;

/**
 * Zod schema for legislator filter inputs
 *
 * Validates filter parameters for legislator queries:
 * - Search: 1-200 characters (name search)
 * - State: 2-letter state code
 * - Chamber: house or senate
 * - Party: D, R, or I
 * - Limit: 1-100
 * - Offset: non-negative integer
 */
export const legislatorFilterSchema = z
  .object({
    search: z
      .string()
      .trim()
      .min(1, 'Search must be at least 1 character')
      .max(200, 'Search cannot exceed 200 characters')
      .optional(),

    state: z
      .string()
      .trim()
      .length(2, 'State code must be exactly 2 characters')
      .regex(/^[A-Z]{2}$/, 'State code must be uppercase letters')
      .optional(),

    chamber: z.enum(legislatorChambers, {
      errorMap: () => ({ message: 'Chamber must be either "house" or "senate"' }),
    }).optional(),

    party: z.enum(parties, {
      errorMap: () => ({ message: 'Party must be D, R, or I' }),
    }).optional(),

    limit: z
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(20),

    offset: z
      .number()
      .int('Offset must be an integer')
      .min(0, 'Offset cannot be negative')
      .optional()
      .default(0),
  })
  .strict();

/**
 * TypeScript type inferred from legislator filter schema
 */
export type LegislatorFilterInput = z.infer<typeof legislatorFilterSchema>;
