/**
 * Bills Validation Schemas
 *
 * Centralized Zod schemas for bills-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Bill Listing & Filtering
// =============================================================================

/**
 * Schema for listing bills with filters
 *
 * Validates:
 * - congressNumber: optional positive integer
 * - billType: optional enum of bill types
 * - status: optional enum of bill statuses
 * - search: optional text search (max 200 chars)
 * - limit/offset: pagination parameters
 */
export const listBillsSchema = z.object({
  congressNumber: z.coerce.number().int().min(1).optional(),
  billType: z.enum(['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']).optional(),
  status: z.enum([
    'introduced',
    'in_committee',
    'passed_house',
    'passed_senate',
    'resolving_differences',
    'to_president',
    'became_law',
    'vetoed',
    'failed',
  ]).optional(),
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListBillsInput = z.infer<typeof listBillsSchema>;

// =============================================================================
// Individual Bill Access
// =============================================================================

/**
 * Schema for getting a specific bill
 *
 * Validates:
 * - id: alphanumeric with hyphens/underscores, max 100 chars
 */
export const getBillSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bill ID format'),
});

export type GetBillInput = z.infer<typeof getBillSchema>;

// =============================================================================
// Related Bills
// =============================================================================

/**
 * Schema for querying related bills
 *
 * Validates:
 * - limit: 1-20 results (default 10)
 */
export const relatedBillsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type RelatedBillsQueryInput = z.infer<typeof relatedBillsQuerySchema>;
