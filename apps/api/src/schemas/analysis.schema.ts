/**
 * Analysis Validation Schemas
 *
 * Centralized Zod schemas for analysis-related requests.
 * These schemas enforce type safety and input validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Bill Analysis
// =============================================================================

/**
 * Schema for getting bill analysis
 *
 * Validates:
 * - billId: alphanumeric with hyphens/underscores, max 100 chars
 */
export const getAnalysisSchema = z.object({
  billId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bill ID format'),
});

export type GetAnalysisInput = z.infer<typeof getAnalysisSchema>;
