/**
 * Data Transformer
 *
 * Converts Congress.gov API responses to Prisma schema format.
 * Handles normalization, ID generation, and enum mapping.
 *
 * @example
 * ```ts
 * import { transformBill, transformLegislator } from './data-transformer.js';
 *
 * const prismaBill = transformBill(apiBill, 118);
 * const prismaLegislator = transformLegislator(apiMember);
 * ```
 */

import {
  type BillType,
  type Chamber,
  type Party,
  type CommitteeType,
  type BillStatus,
  type TextFormat,
  DataSource,
  DataQuality,
} from '@prisma/client';
import type {
  BillListItem,
  BillDetail,
  BillAction,
  BillCosponsor,
  BillTextVersion,
  MemberListItem,
  MemberDetail,
  CommitteeListItem,
  CongressBillType,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Type Mappings
// ─────────────────────────────────────────────────────────────────────────────

const BILL_TYPE_MAP: Record<CongressBillType, BillType> = {
  hr: 'HR',
  hres: 'HRES',
  hjres: 'HJRES',
  hconres: 'HCONRES',
  s: 'S',
  sres: 'SRES',
  sjres: 'SJRES',
  sconres: 'SCONRES',
} as const;

const CHAMBER_MAP: Record<string, Chamber> = {
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

const PARTY_MAP: Record<string, Party> = {
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

const COMMITTEE_TYPE_MAP: Record<string, CommitteeType> = {
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
const US_STATES: Record<string, string> = {
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
const STATE_NAME_TO_CODE: Record<string, string> = Object.entries(
  US_STATES
).reduce(
  (acc, [code, name]) => {
    acc[name] = code;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Converts a state name to its 2-character code.
 * Returns the input unchanged if already a 2-char code or if not found.
 *
 * @example mapStateToCode("California") => "CA"
 * @example mapStateToCode("CA") => "CA"
 * @example mapStateToCode(undefined) => "XX"
 */
function mapStateToCode(state: string | null | undefined): string {
  if (!state) return 'XX';
  // If already a 2-char code, return as-is
  if (state.length === 2 && state === state.toUpperCase()) {
    return state;
  }
  // Look up in reverse mapping
  return STATE_NAME_TO_CODE[state] ?? 'XX';
}

// ─────────────────────────────────────────────────────────────────────────────
// ID Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic bill ID.
 * Format: "{type}-{number}-{congress}"
 *
 * @example generateBillId('hr', 1234, 118) => "hr-1234-118"
 */
export function generateBillId(
  type: CongressBillType,
  number: number,
  congress: number
): string {
  return `${type}-${number}-${congress}`;
}

/**
 * Parses a bill ID into its components.
 *
 * @example parseBillId("hr-1234-118") => { type: 'hr', number: 1234, congress: 118 }
 */
export function parseBillId(
  billId: string
): { type: CongressBillType; number: number; congress: number } | null {
  const match = billId.match(/^([a-z]+)-(\d+)-(\d+)$/);
  if (!match || match.length < 4) return null;

  const type = match[1];
  const numberStr = match[2];
  const congressStr = match[3];

  if (!type || !numberStr || !congressStr) return null;

  return {
    type: type as CongressBillType,
    number: parseInt(numberStr, 10),
    congress: parseInt(congressStr, 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps Congress.gov bill type to Prisma enum.
 */
export function mapBillType(type: CongressBillType): BillType {
  return BILL_TYPE_MAP[type] ?? 'HR';
}

/**
 * Maps chamber string to Prisma enum.
 */
export function mapChamber(chamber: string | null | undefined): Chamber | null {
  if (!chamber) return null;
  return CHAMBER_MAP[chamber] ?? null;
}

/**
 * Maps party string to Prisma enum.
 */
export function mapParty(party: string | null | undefined): Party {
  if (!party) return 'O';
  return PARTY_MAP[party] ?? 'O';
}

/**
 * Maps committee type string to Prisma enum.
 */
export function mapCommitteeType(
  type: string | null | undefined
): CommitteeType {
  if (!type) return 'STANDING';
  return COMMITTEE_TYPE_MAP[type] ?? 'STANDING';
}

/**
 * Infers BillStatus from the latest action text.
 * This is heuristic-based as Congress.gov doesn't provide explicit status.
 */
export function inferBillStatus(
  latestAction: { text: string } | null | undefined
): BillStatus {
  if (!latestAction?.text) return 'INTRODUCED';

  const text = latestAction.text.toLowerCase();

  // Check for terminal states first
  // Note: Order matters - more specific patterns must come before general ones
  if (text.includes('became public law') || text.includes('became law')) {
    return 'ENACTED';
  }
  if (text.includes('signed by president') || text.includes('signed by the president')) {
    return 'SIGNED_INTO_LAW';
  }
  // Check pocket veto BEFORE regular veto (pocket vetoed contains "vetoed")
  if (text.includes('pocket vetoed') || text.includes('pocket veto')) {
    return 'POCKET_VETOED';
  }
  if (text.includes('vetoed by president') || text.includes('vetoed by the president')) {
    return 'VETOED';
  }
  if (text.includes('veto overridden')) {
    return 'VETO_OVERRIDDEN';
  }
  if (text.includes('failed') || text.includes('rejected')) {
    return 'FAILED';
  }
  if (text.includes('withdrawn') || text.includes('withdrew')) {
    return 'WITHDRAWN';
  }

  // Check for progression states
  if (text.includes('presented to president') || text.includes('sent to president')) {
    return 'TO_PRESIDENT';
  }
  if (text.includes('resolving differences') || text.includes('conference')) {
    return 'RESOLVING_DIFFERENCES';
  }
  if (text.includes('passed senate') || text.includes('agreed to in senate')) {
    return 'PASSED_SENATE';
  }
  if (text.includes('passed house') || text.includes('agreed to in house')) {
    return 'PASSED_HOUSE';
  }
  if (text.includes('reported by') || text.includes('ordered to be reported')) {
    return 'REPORTED_BY_COMMITTEE';
  }
  if (text.includes('referred to') || text.includes('committee')) {
    return 'IN_COMMITTEE';
  }
  if (text.includes('introduced')) {
    return 'INTRODUCED';
  }

  // Default to INTRODUCED if we can't determine
  return 'INTRODUCED';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a date string to Date object.
 * Handles ISO 8601 and common date formats.
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Parses a date string, returning a non-null Date (defaults to now).
 */
export function parseDateRequired(
  dateStr: string | null | undefined,
  fallback: Date = new Date()
): Date {
  return parseDate(dateStr) ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bill Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result type for bill list item transformation.
 * Uses scalar FK field instead of relation connect for upsert compatibility.
 */
export interface BillCreateInput {
  id: string;
  congressNumber: number;
  billType: BillType;
  billNumber: number;
  title: string;
  status: BillStatus;
  introducedDate: Date;
  lastActionDate: Date | null;
  dataSource: DataSource;
  dataQuality: DataQuality;
  lastSyncedAt: Date;
}

/**
 * Transforms a Congress.gov bill list item to Prisma Bill create input.
 */
export function transformBillListItem(item: BillListItem): BillCreateInput {
  const billId = generateBillId(item.type, item.number, item.congress);

  return {
    id: billId,
    congressNumber: item.congress,
    billType: mapBillType(item.type),
    billNumber: item.number,
    title: item.title,
    status: inferBillStatus(item.latestAction),
    introducedDate: parseDateRequired(item.updateDate), // Use update date as proxy
    lastActionDate: parseDate(item.latestAction?.actionDate),
    dataSource: DataSource.CONGRESS_GOV,
    dataQuality: DataQuality.UNVERIFIED,
    lastSyncedAt: new Date(),
  };
}

/**
 * Result type for bill detail transformation.
 */
export interface BillUpdateInput {
  title: string;
  summary: string | null;
  status: BillStatus;
  introducedDate: Date;
  lastActionDate: Date | null;
  dataQuality: DataQuality;
  lastSyncedAt: Date;
  policyAreaName: string | null;
  sponsorBioguideId: string | null;
  subjects: string[];
}

/**
 * Transforms a Congress.gov bill detail to Prisma Bill update input.
 * Used to enrich an existing bill record with full details.
 */
export function transformBillDetail(detail: BillDetail): BillUpdateInput {
  // Extract summary text from summaries array
  const summaryText = detail.summaries?.summary?.[0]?.text ?? null;
  const sponsorId = detail.sponsors?.[0]?.bioguideId ?? null;
  const subjects =
    detail.subjects?.legislativeSubjects?.map((s) => s.name) ?? [];

  return {
    title: detail.title,
    summary: summaryText,
    status: inferBillStatus(detail.latestAction),
    introducedDate: parseDateRequired(detail.introducedDate ?? detail.updateDate),
    lastActionDate: parseDate(detail.latestAction?.actionDate),
    dataQuality: DataQuality.VERIFIED,
    lastSyncedAt: new Date(),
    policyAreaName: detail.policyArea?.name ?? null,
    sponsorBioguideId: sponsorId,
    subjects,
  };
}

/**
 * Result type for bill action transformation.
 */
export interface BillActionCreateInput {
  billId: string;
  actionDate: Date;
  actionCode: string | null;
  actionText: string;
  chamber: Chamber | null;
}

/**
 * Transforms a Congress.gov bill action to create input.
 */
export function transformBillAction(
  action: BillAction,
  billId: string
): BillActionCreateInput {
  return {
    billId,
    actionDate: parseDateRequired(action.actionDate),
    actionCode: action.actionCode ?? null,
    actionText: action.text,
    chamber: mapChamber(action.sourceSystem?.name),
  };
}

/**
 * Result type for cosponsor transformation.
 */
export interface CosponsorCreateInput {
  billId: string;
  legislatorId: string;
  isPrimary: boolean;
  cosponsorDate: Date | null;
}

/**
 * Transforms a Congress.gov cosponsor to create input.
 */
export function transformCosponsor(
  cosponsor: BillCosponsor,
  billId: string
): CosponsorCreateInput {
  return {
    billId,
    legislatorId: cosponsor.bioguideId,
    isPrimary: false,
    cosponsorDate: parseDate(cosponsor.sponsorshipDate),
  };
}

/**
 * Result type for text version transformation.
 */
export interface TextVersionCreateInput {
  billId: string;
  versionCode: string;
  versionName: string;
  textUrl: string;
  textHash: string;
  textFormat: TextFormat;
  publishedDate: Date;
}

/**
 * Transforms a Congress.gov text version to create input.
 */
export function transformTextVersion(
  version: BillTextVersion,
  billId: string
): TextVersionCreateInput | null {
  // Find the best format URL (prefer XML, then HTML, then PDF, then TXT)
  const formatPriority = ['xml', 'htm', 'html', 'pdf', 'txt'];
  let textUrl: string | null = null;
  let textFormat: TextFormat = 'TXT';

  for (const format of formatPriority) {
    const found = version.formats?.find((f) =>
      f.type.toLowerCase().includes(format)
    );
    if (found) {
      textUrl = found.url;
      textFormat =
        format === 'xml'
          ? 'XML'
          : format.startsWith('htm')
            ? 'HTML'
            : format === 'pdf'
              ? 'PDF'
              : 'TXT';
      break;
    }
  }

  // Skip if no URL available
  if (!textUrl) return null;

  return {
    billId,
    versionCode: version.type,
    versionName: getVersionName(version.type),
    textUrl,
    textHash: '', // Will be computed when downloading text
    textFormat,
    publishedDate: parseDateRequired(version.date),
  };
}

/**
 * Maps version code to human-readable name.
 */
function getVersionName(versionCode: string): string {
  const VERSION_NAMES: Record<string, string> = {
    ih: 'Introduced in House',
    is: 'Introduced in Senate',
    rh: 'Reported in House',
    rs: 'Reported in Senate',
    rfh: 'Referred in House',
    rfs: 'Referred in Senate',
    rch: 'Reference Change House',
    rcs: 'Reference Change Senate',
    eh: 'Engrossed in House',
    es: 'Engrossed in Senate',
    eah: 'Engrossed Amendment House',
    eas: 'Engrossed Amendment Senate',
    enr: 'Enrolled Bill',
    pp: 'Public Print',
    pcs: 'Placed on Calendar Senate',
    pch: 'Placed on Calendar House',
  };

  return VERSION_NAMES[versionCode.toLowerCase()] ?? versionCode.toUpperCase();
}

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
 * Parses a full name into first, middle, and last name parts.
 * Handles formats like "Smith, John A." or "John A. Smith"
 */
function parseFullName(fullName: string): {
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

// ─────────────────────────────────────────────────────────────────────────────
// Batch Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms multiple bill list items for batch upsert.
 */
export function transformBillBatch(items: BillListItem[]): BillCreateInput[] {
  return items.map(transformBillListItem);
}

/**
 * Transforms multiple member list items for batch upsert.
 */
export function transformMemberBatch(
  items: MemberListItem[]
): LegislatorCreateInput[] {
  return items.map(transformMemberListItem);
}

/**
 * Transforms multiple committee items for batch upsert.
 * Orders by hierarchy (parents first).
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
