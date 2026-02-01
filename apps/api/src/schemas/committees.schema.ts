/**
 * Committees Validation Schemas
 *
 * Centralized Zod schemas for committees-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Committee Listing & Filtering
// =============================================================================

/**
 * Schema for listing committees with filters
 *
 * Validates:
 * - chamber: optional house/senate/joint
 * - type: optional committee type
 * - parentId: optional parent committee ID for subcommittees
 * - limit/offset: pagination parameters
 */
export const listCommitteesSchema = z.object({
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  type: z.enum(['standing', 'select', 'special', 'subcommittee']).optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListCommitteesInput = z.infer<typeof listCommitteesSchema>;

// =============================================================================
// Standing Committees
// =============================================================================

/**
 * Schema for filtering standing committees
 *
 * Validates:
 * - chamber: optional house or senate
 */
export const standingCommitteesSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
});

export type StandingCommitteesInput = z.infer<typeof standingCommitteesSchema>;

// =============================================================================
// Individual Committee Access
// =============================================================================

/**
 * Schema for getting a specific committee
 *
 * Validates:
 * - id: alphanumeric with hyphens/underscores, max 50 chars
 */
export const getCommitteeSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid committee ID format'),
});

export type GetCommitteeInput = z.infer<typeof getCommitteeSchema>;

// =============================================================================
// Committee Members
// =============================================================================

/**
 * Schema for querying committee members
 *
 * Validates:
 * - includeHistorical: optional boolean to include former members
 */
export const committeeMembersSchema = z.object({
  includeHistorical: z.coerce.boolean().default(false),
});

export type CommitteeMembersInput = z.infer<typeof committeeMembersSchema>;

// =============================================================================
// Committee Bill Referrals
// =============================================================================

/**
 * Schema for querying bills referred to a committee
 *
 * Validates:
 * - limit/offset: pagination parameters
 */
export const committeeReferralsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CommitteeReferralsInput = z.infer<typeof committeeReferralsSchema>;
