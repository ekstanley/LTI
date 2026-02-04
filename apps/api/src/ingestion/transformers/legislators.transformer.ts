/**
 * Legislators Transformer
 *
 * Transforms Congress.gov member data to Prisma schema format.
 * Handles member list items, detailed member info, and name parsing.
 *
 * @module transformers/legislators
 */

import { type Party, type Chamber, DataSource } from '@prisma/client';

import type { MemberListItem, MemberDetail } from '../types.js';

import { mapParty, mapChamber, mapStateToCode, parseDate } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Legislator Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for legislator list item transformation.
 */
export interface LegislatorCreateInput {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  fullName: string;
  party: Party;
  chamber: Chamber;
  state: string;
  district: number | null;
  inOffice: boolean;
  dataSource: DataSource;
  lastSyncedAt: Date;
}

/**
 * Result type for legislator detail transformation.
 * All fields optional to support partial updates with Prisma.
 */
export interface LegislatorUpdateInput {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  nickName?: string | null;
  fullName?: string;
  party?: Party;
  chamber?: Chamber;
  state?: string;
  district?: number | null;
  inOffice?: boolean;
  website?: string | null;
  termStart?: Date | null;
  termEnd?: Date | null;
  lastSyncedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legislator Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms a Congress.gov member list item to Prisma Legislator create input.
 *
 * @param item - Member list item from API
 * @returns Prisma-compatible legislator create input
 */
export function transformMemberListItem(
  item: MemberListItem
): LegislatorCreateInput {
  // Parse name parts from full name
  const nameParts = parseFullName(item.name);

  // Get latest term info
  const latestTerm = item.terms?.item?.[0];

  return {
    id: item.bioguideId,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    middleName: nameParts.middleName,
    fullName: item.name,
    party: mapParty(item.partyName),
    chamber: mapChamber(latestTerm?.chamber) ?? 'HOUSE',
    // Prioritize stateCode (already 2-char) over state name (needs conversion)
    state: latestTerm?.stateCode ?? mapStateToCode(item.state),
    district: item.district ?? latestTerm?.district ?? null,
    inOffice: true, // Assume true for list items
    dataSource: 'CONGRESS_GOV' as DataSource,
    lastSyncedAt: new Date(),
  };
}

/**
 * Transforms a Congress.gov member detail to Prisma Legislator update input.
 *
 * @param detail - Member detail from API
 * @returns Prisma-compatible legislator update input
 */
export function transformMemberDetail(
  detail: MemberDetail
): LegislatorUpdateInput {
  // Get latest term info
  const latestTerm = detail.terms?.[0];
  const chamber = mapChamber(latestTerm?.chamber);
  // Prioritize stateCode (already 2-char) over state name (needs conversion)
  const state = latestTerm?.stateCode ?? mapStateToCode(detail.state);

  // Build result object conditionally to satisfy exactOptionalPropertyTypes
  const result: LegislatorUpdateInput = {
    middleName: detail.middleName ?? null,
    nickName: detail.nickName ?? null,
    fullName:
      detail.directOrderName ??
      `${detail.firstName ?? ''} ${detail.lastName ?? ''}`.trim(),
    party: mapParty(detail.partyHistory?.[0]?.partyName),
    district: latestTerm?.district ?? null,
    inOffice: detail.currentMember ?? false,
    website: detail.officialWebsiteUrl ?? null,
    termStart: parseDate(latestTerm?.startYear?.toString()),
    termEnd: parseDate(latestTerm?.endYear?.toString()),
    lastSyncedAt: new Date(),
  };

  // Only add optional string properties if they have values
  if (detail.firstName) result.firstName = detail.firstName;
  if (detail.lastName) result.lastName = detail.lastName;
  if (chamber) result.chamber = chamber;
  if (state) result.state = state;

  return result;
}

/**
 * Transforms multiple member list items for batch upsert.
 *
 * @param items - Array of member list items from API
 * @returns Array of Prisma-compatible legislator create inputs
 */
export function transformMemberBatch(
  items: MemberListItem[]
): LegislatorCreateInput[] {
  return items.map(transformMemberListItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a full name into first, middle, and last name parts.
 * Handles formats like "Smith, John A." or "John A. Smith"
 *
 * @param fullName - Full name to parse
 * @returns Parsed name parts
 *
 * @example
 * parseFullName("Smith, John A.") // => { firstName: 'John', lastName: 'Smith', middleName: 'A.' }
 * parseFullName("John A. Smith") // => { firstName: 'John', lastName: 'Smith', middleName: 'A.' }
 */
export function parseFullName(fullName: string): {
  firstName: string;
  lastName: string;
  middleName: string | null;
} {
  // Handle "Last, First Middle" format
  if (fullName.includes(',')) {
    const splitParts = fullName.split(',', 2);
    const last = splitParts[0] ?? '';
    const rest = splitParts[1] ?? '';
    const restParts = rest.trim().split(/\s+/);
    return {
      firstName: restParts[0] ?? '',
      lastName: last.trim(),
      middleName: restParts.length > 1 ? restParts.slice(1).join(' ') : null,
    };
  }

  // Handle "First Middle Last" format
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: '', lastName: '', middleName: null };
  }
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] ?? '', middleName: null };
  }
  if (parts.length === 2) {
    return {
      firstName: parts[0] ?? '',
      lastName: parts[1] ?? '',
      middleName: null,
    };
  }

  const first = parts[0] ?? '';
  const lastPart = parts[parts.length - 1] ?? '';
  const middleParts = parts.slice(1, -1);

  return {
    firstName: first,
    lastName: lastPart,
    middleName: middleParts.length > 0 ? middleParts.join(' ') : null,
  };
}
