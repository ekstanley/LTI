/**
 * Common Transformer Utilities
 *
 * Shared utilities for transforming Congress.gov API data.
 * Includes type mappings, enum mappers, date utilities, and state conversions.
 *
 * @module transformers/common
 */

import {
  type BillType,
  type Chamber,
  type Party,
  type CommitteeType,
} from '@prisma/client';

import type { CongressBillType } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Type Mappings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps Congress.gov bill type codes to Prisma BillType enum.
 */
export const BILL_TYPE_MAP: Record<CongressBillType, BillType> = {
  hr: 'HR',
  hres: 'HRES',
  hjres: 'HJRES',
  hconres: 'HCONRES',
  s: 'S',
  sres: 'SRES',
  sjres: 'SJRES',
  sconres: 'SCONRES',
} as const;

/**
 * Maps chamber strings to Prisma Chamber enum.
 */
export const CHAMBER_MAP: Record<string, Chamber> = {
  house: 'HOUSE',
  senate: 'SENATE',
  House: 'HOUSE',
  Senate: 'SENATE',
  HOUSE: 'HOUSE',
  SENATE: 'SENATE',
  H: 'HOUSE',
  S: 'SENATE',
  'House of Representatives': 'HOUSE',
} as const;

/**
 * Maps party names to Prisma Party enum.
 */
export const PARTY_MAP: Record<string, Party> = {
  Democratic: 'D',
  Democrat: 'D',
  Republican: 'R',
  Independent: 'I',
  Libertarian: 'L',
  Green: 'G',
  D: 'D',
  R: 'R',
  I: 'I',
  L: 'L',
  G: 'G',
} as const;

/**
 * Maps committee type strings to Prisma CommitteeType enum.
 */
export const COMMITTEE_TYPE_MAP: Record<string, CommitteeType> = {
  Standing: 'STANDING',
  Select: 'SELECT',
  Joint: 'JOINT',
  Subcommittee: 'SUBCOMMITTEE',
  Special: 'SPECIAL',
  STANDING: 'STANDING',
  SELECT: 'SELECT',
  JOINT: 'JOINT',
  SUBCOMMITTEE: 'SUBCOMMITTEE',
  SPECIAL: 'SPECIAL',
} as const;

/**
 * US State codes to names mapping.
 * Defined locally to avoid ESM/CJS interop issues with @ltip/shared package.
 */
export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  PR: 'Puerto Rico',
  VI: 'Virgin Islands',
  GU: 'Guam',
  AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
} as const;

/**
 * Reverse mapping from state names to 2-character codes.
 * Created from US_STATES constant (code -> name) by inverting the mapping.
 */
export const STATE_NAME_TO_CODE: Record<string, string> = Object.entries(
  US_STATES
).reduce(
  (acc, [code, name]) => {
    acc[name] = code;
    return acc;
  },
  {} as Record<string, string>
);

// ─────────────────────────────────────────────────────────────────────────────
// State Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a state name to its 2-character code.
 * Returns the input unchanged if already a 2-char code or "XX" if not found.
 *
 * @param state - State name or code
 * @returns 2-character state code or "XX"
 *
 * @example
 * mapStateToCode("California") // => "CA"
 * mapStateToCode("CA") // => "CA"
 * mapStateToCode(undefined) // => "XX"
 */
export function mapStateToCode(state: string | null | undefined): string {
  if (!state) return 'XX';
  // If already a 2-char code, return as-is
  if (state.length === 2 && state === state.toUpperCase()) {
    return state;
  }
  // Look up in reverse mapping
  return STATE_NAME_TO_CODE[state] ?? 'XX';
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps Congress.gov bill type to Prisma BillType enum.
 * Returns 'HR' as default for unknown types.
 *
 * @param type - Congress.gov bill type code
 * @returns Prisma BillType enum value
 *
 * @example
 * mapBillType('hr') // => 'HR'
 * mapBillType('s') // => 'S'
 */
export function mapBillType(type: CongressBillType): BillType {
  return BILL_TYPE_MAP[type] ?? 'HR';
}

/**
 * Maps chamber string to Prisma Chamber enum.
 * Returns null for unknown or empty chamber values.
 *
 * @param chamber - Chamber string from API
 * @returns Prisma Chamber enum value or null
 *
 * @example
 * mapChamber('house') // => 'HOUSE'
 * mapChamber('Senate') // => 'SENATE'
 * mapChamber(null) // => null
 */
export function mapChamber(chamber: string | null | undefined): Chamber | null {
  if (!chamber) return null;
  return CHAMBER_MAP[chamber] ?? null;
}

/**
 * Maps party string to Prisma Party enum.
 * Returns 'O' (Other) as default for unknown parties.
 *
 * @param party - Party name or abbreviation
 * @returns Prisma Party enum value
 *
 * @example
 * mapParty('Democratic') // => 'D'
 * mapParty('R') // => 'R'
 * mapParty('Unknown') // => 'O'
 */
export function mapParty(party: string | null | undefined): Party {
  if (!party) return 'O';
  return PARTY_MAP[party] ?? 'O';
}

/**
 * Maps committee type string to Prisma CommitteeType enum.
 * Returns 'STANDING' as default for unknown types.
 *
 * @param type - Committee type string
 * @returns Prisma CommitteeType enum value
 *
 * @example
 * mapCommitteeType('Standing') // => 'STANDING'
 * mapCommitteeType('SELECT') // => 'SELECT'
 * mapCommitteeType(null) // => 'STANDING'
 */
export function mapCommitteeType(
  type: string | null | undefined
): CommitteeType {
  if (!type) return 'STANDING';
  return COMMITTEE_TYPE_MAP[type] ?? 'STANDING';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a date string to Date object.
 * Handles ISO 8601 and common date formats.
 * Returns null for invalid or empty dates.
 *
 * @param dateStr - Date string to parse
 * @returns Date object or null
 *
 * @example
 * parseDate('2024-01-15') // => Date object
 * parseDate(null) // => null
 * parseDate('invalid') // => null
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Parses a date string, returning a non-null Date (defaults to fallback).
 * Used when a date is required and cannot be null.
 *
 * @param dateStr - Date string to parse
 * @param fallback - Default date if parsing fails (defaults to now)
 * @returns Date object (never null)
 *
 * @example
 * parseDateRequired('2024-01-15') // => Date object
 * parseDateRequired(null) // => new Date() (current time)
 * parseDateRequired(null, new Date('2024-01-01')) // => 2024-01-01
 */
export function parseDateRequired(
  dateStr: string | null | undefined,
  fallback: Date = new Date()
): Date {
  return parseDate(dateStr) ?? fallback;
}
