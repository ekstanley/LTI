/**
 * Committees Transformer
 *
 * Transforms Congress.gov committee data to Prisma schema format.
 * Handles committee hierarchy (parents and subcommittees).
 *
 * @module transformers/committees
 */

import { type Chamber, type CommitteeType } from '@prisma/client';

import type { CommitteeListItem } from '../types.js';

import { mapChamber, mapCommitteeType } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Committee Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for committee transformation.
 */
export interface CommitteeCreateInput {
  id: string;
  name: string;
  chamber: Chamber;
  type: CommitteeType;
  parentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Committee Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms a Congress.gov committee to Prisma Committee create input.
 *
 * @param item - Committee list item from API
 * @returns Prisma-compatible committee create input
 */
export function transformCommittee(
  item: CommitteeListItem
): CommitteeCreateInput {
  const chamber = mapChamber(item.chamber);

  return {
    id: item.systemCode,
    name: item.name,
    chamber: chamber ?? 'HOUSE',
    type: mapCommitteeType(item.committeeTypeCode),
    parentId: item.parent?.systemCode ?? null,
  };
}

/**
 * Transforms multiple committee items for batch upsert.
 * Orders by hierarchy (parents first).
 *
 * @param items - Array of committee list items from API
 * @returns Array of Prisma-compatible committee create inputs (sorted by hierarchy)
 */
export function transformCommitteeBatch(
  items: CommitteeListItem[]
): CommitteeCreateInput[] {
  // Sort so parents come before children
  const sorted = [...items].sort((a, b) => {
    if (a.parent && !b.parent) return 1;
    if (!a.parent && b.parent) return -1;
    return 0;
  });

  return sorted.map(transformCommittee);
}
