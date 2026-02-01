/**
 * Conflicts of Interest Validation Schemas
 *
 * Centralized Zod schemas for conflicts-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Conflict Listing & Filtering
// =============================================================================

/**
 * Schema for listing conflicts of interest with filters
 *
 * Validates:
 * - legislatorId: optional legislator filter
 * - billId: optional bill filter
 * - type: optional conflict type
 * - severity: optional severity level
 * - limit/offset: pagination parameters
 */
export const listConflictsSchema = z.object({
  legislatorId: z.string().optional(),
  billId: z.string().optional(),
  type: z.enum(['stock_holding', 'family_employment', 'lobbying_contact', 'campaign_donation']).optional(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListConflictsInput = z.infer<typeof listConflictsSchema>;

// =============================================================================
// Individual Conflict Access
// =============================================================================

/**
 * Schema for getting a specific conflict of interest
 *
 * Validates:
 * - id: alphanumeric with hyphens/underscores, max 100 chars
 */
export const getConflictSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid conflict ID format'),
});

export type GetConflictInput = z.infer<typeof getConflictSchema>;
