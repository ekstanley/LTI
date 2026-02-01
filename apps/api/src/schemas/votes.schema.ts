/**
 * Votes Validation Schemas
 *
 * Centralized Zod schemas for votes-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Vote Listing & Filtering
// =============================================================================

/**
 * Schema for listing votes with filters
 *
 * Validates:
 * - chamber: optional house/senate
 * - congressNumber: optional positive integer
 * - session: optional 1 or 2
 * - result: optional vote outcome
 * - billId: optional bill identifier
 * - limit/offset: pagination parameters
 */
export const listVotesSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  congressNumber: z.coerce.number().int().min(1).optional(),
  session: z.coerce.number().int().min(1).max(2).optional(),
  result: z.enum(['passed', 'failed', 'agreed_to', 'rejected']).optional(),
  billId: z.string().optional(),
  voteDateAfter: z.string().datetime().optional(),
  voteDateBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListVotesInput = z.infer<typeof listVotesSchema>;

// =============================================================================
// Individual Vote Access
// =============================================================================

/**
 * Schema for getting a specific vote
 *
 * Validates:
 * - id: alphanumeric with hyphens/underscores, max 100 chars
 */
export const getVoteSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid vote ID format'),
});

export type GetVoteInput = z.infer<typeof getVoteSchema>;

// =============================================================================
// Recent Votes by Chamber
// =============================================================================

/**
 * Schema for chamber parameter in recent votes endpoint
 *
 * Validates:
 * - chamber: required house or senate
 */
export const recentVotesChamberSchema = z.object({
  chamber: z.enum(['house', 'senate']),
});

export type RecentVotesChamberInput = z.infer<typeof recentVotesChamberSchema>;

/**
 * Schema for query parameters in recent votes endpoint
 *
 * Validates:
 * - limit: 1-50 results (default 10)
 */
export const recentVotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type RecentVotesQueryInput = z.infer<typeof recentVotesQuerySchema>;

// =============================================================================
// Vote Comparison
// =============================================================================

/**
 * Schema for comparing votes between two legislators
 *
 * Validates:
 * - legislator1: first legislator ID
 * - legislator2: second legislator ID
 * - congressNumber: optional congress to filter by
 */
export const compareVotesSchema = z.object({
  legislator1: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid legislator ID format'),
  legislator2: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid legislator ID format'),
  congressNumber: z.coerce.number().int().min(1).optional(),
});

export type CompareVotesInput = z.infer<typeof compareVotesSchema>;
