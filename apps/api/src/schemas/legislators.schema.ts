/**
 * Legislators Validation Schemas
 *
 * Centralized Zod schemas for legislators-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Legislator Listing & Filtering
// =============================================================================

/**
 * Schema for listing legislators with filters
 *
 * Validates:
 * - chamber: optional house/senate
 * - party: optional party affiliation (D/R/I/L/G)
 * - state: optional 2-letter state code
 * - search: optional text search (max 100 chars)
 * - inOffice: optional boolean for current status
 * - limit/offset: pagination parameters
 */
export const listLegislatorsSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  party: z.enum(['D', 'R', 'I', 'L', 'G']).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(100).optional(),
  inOffice: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListLegislatorsInput = z.infer<typeof listLegislatorsSchema>;

// =============================================================================
// Individual Legislator Access
// =============================================================================

/**
 * Schema for getting a specific legislator
 *
 * Validates:
 * - id: alphanumeric with hyphens/underscores, max 50 chars
 */
export const getLegislatorSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid legislator ID format'),
});

export type GetLegislatorInput = z.infer<typeof getLegislatorSchema>;

// =============================================================================
// Legislator Bills
// =============================================================================

/**
 * Schema for querying bills sponsored/cosponsored by a legislator
 *
 * Validates:
 * - primaryOnly: optional boolean to filter primary sponsorships
 * - limit/offset: pagination parameters
 */
export const legislatorBillsSchema = z.object({
  primaryOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LegislatorBillsInput = z.infer<typeof legislatorBillsSchema>;

// =============================================================================
// Legislator Votes
// =============================================================================

/**
 * Schema for querying votes cast by a legislator
 *
 * Validates:
 * - limit/offset: pagination parameters
 */
export const legislatorVotesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LegislatorVotesInput = z.infer<typeof legislatorVotesSchema>;
