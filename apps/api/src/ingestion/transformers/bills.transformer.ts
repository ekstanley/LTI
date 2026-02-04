/**
 * Bills Transformer
 *
 * Transforms Congress.gov bill data to Prisma schema format.
 * Handles bill IDs, status inference, and all bill-related entities.
 *
 * @module transformers/bills
 */

import {
  type BillType,
  type BillStatus,
  type Chamber,
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
  CongressBillType,
} from '../types.js';

import {
  mapBillType,
  mapChamber,
  parseDate,
  parseDateRequired,
} from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// ID Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic bill ID.
 * Format: "{type}-{number}-{congress}"
 *
 * @param type - Congress.gov bill type
 * @param number - Bill number
 * @param congress - Congress number
 * @returns Deterministic bill ID
 *
 * @example
 * generateBillId('hr', 1234, 118) // => "hr-1234-118"
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
 * @param billId - Bill ID to parse
 * @returns Parsed components or null if invalid
 *
 * @example
 * parseBillId("hr-1234-118") // => { type: 'hr', number: 1234, congress: 118 }
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
// Status Inference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infers BillStatus from the latest action text.
 * This is heuristic-based as Congress.gov doesn't provide explicit status.
 *
 * @param latestAction - Latest action object from API
 * @returns Inferred BillStatus enum value
 *
 * @example
 * inferBillStatus({ text: 'Became Public Law' }) // => 'ENACTED'
 * inferBillStatus({ text: 'Introduced in House' }) // => 'INTRODUCED'
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
// Bill Types
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
 * Result type for cosponsor transformation.
 */
export interface CosponsorCreateInput {
  billId: string;
  legislatorId: string;
  isPrimary: boolean;
  cosponsorDate: Date | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Bill Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms a Congress.gov bill list item to Prisma Bill create input.
 *
 * @param item - Bill list item from API
 * @returns Prisma-compatible bill create input
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
 * Transforms a Congress.gov bill detail to Prisma Bill update input.
 * Used to enrich an existing bill record with full details.
 *
 * @param detail - Bill detail from API
 * @returns Prisma-compatible bill update input
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
 * Transforms a Congress.gov bill action to create input.
 *
 * @param action - Bill action from API
 * @param billId - Associated bill ID
 * @returns Prisma-compatible bill action create input
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
 * Transforms a Congress.gov cosponsor to create input.
 *
 * @param cosponsor - Bill cosponsor from API
 * @param billId - Associated bill ID
 * @returns Prisma-compatible cosponsor create input
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
 * Transforms a Congress.gov text version to create input.
 *
 * @param version - Bill text version from API
 * @param billId - Associated bill ID
 * @returns Prisma-compatible text version create input or null if no URL available
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
 * Transforms multiple bill list items for batch upsert.
 *
 * @param items - Array of bill list items from API
 * @returns Array of Prisma-compatible bill create inputs
 */
export function transformBillBatch(items: BillListItem[]): BillCreateInput[] {
  return items.map(transformBillListItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps version code to human-readable name.
 *
 * @param versionCode - Version code from API
 * @returns Human-readable version name
 *
 * @example
 * getVersionName('ih') // => 'Introduced in House'
 * getVersionName('enr') // => 'Enrolled Bill'
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
