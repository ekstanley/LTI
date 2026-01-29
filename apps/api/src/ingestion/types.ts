/**
 * Congress.gov API Response Types
 *
 * Type definitions for the Congress.gov API v3 responses.
 * @see https://api.congress.gov/
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  count: z.number(),
  next: z.string().url().nullable().optional(),
  prev: z.string().url().nullable().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Bill Types
// ─────────────────────────────────────────────────────────────────────────────

// Base enum with lowercase values (our internal representation)
const BillTypeEnum = z.enum([
  'hr', 'hres', 'hjres', 'hconres',
  's', 'sres', 'sjres', 'sconres',
]);

// Schema that accepts both uppercase (from API) and lowercase
// and normalizes to lowercase for internal use
export const CongressBillTypeSchema = z
  .string()
  .transform((val) => val.toLowerCase())
  .pipe(BillTypeEnum);

export type CongressBillType = z.infer<typeof BillTypeEnum>;

export const BillActionSchema = z.object({
  actionCode: z.string().nullable().optional(),
  actionDate: z.string(),
  text: z.string(),
  type: z.string().nullable().optional(),
  sourceSystem: z.object({
    code: z.number().nullable().optional(),
    name: z.string().nullable().optional(),
  }).nullable().optional(),
  committees: z.array(z.object({
    systemCode: z.string(),
    name: z.string(),
  })).nullable().optional(),
});

export type BillAction = z.infer<typeof BillActionSchema>;

export const BillSponsorSchema = z.object({
  bioguideId: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  party: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  district: z.number().nullable().optional(),
  isByRequest: z.string().nullable().optional(),
});

export type BillSponsor = z.infer<typeof BillSponsorSchema>;

export const BillCosponsorSchema = z.object({
  bioguideId: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  party: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  district: z.number().nullable().optional(),
  sponsorshipDate: z.string().nullable().optional(),
  isOriginalCosponsor: z.boolean().nullable().optional(),
});

export type BillCosponsor = z.infer<typeof BillCosponsorSchema>;

export const BillTextVersionSchema = z.object({
  date: z.string().nullable().optional(),
  type: z.string(),
  formats: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
  })).nullable().optional(),
});

export type BillTextVersion = z.infer<typeof BillTextVersionSchema>;

export const BillSummarySchema = z.object({
  actionDate: z.string().nullable().optional(),
  actionDesc: z.string().nullable().optional(),
  text: z.string(),
  updateDate: z.string().nullable().optional(),
  versionCode: z.string().nullable().optional(),
});

export type BillSummaryItem = z.infer<typeof BillSummarySchema>;

export const BillSubjectSchema = z.object({
  name: z.string(),
});

export type BillSubject = z.infer<typeof BillSubjectSchema>;

export const PolicyAreaSchema = z.object({
  name: z.string(),
});

export type PolicyArea = z.infer<typeof PolicyAreaSchema>;

export const BillCommitteeSchema = z.object({
  systemCode: z.string(),
  name: z.string(),
  chamber: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  activities: z.array(z.object({
    date: z.string(),
    name: z.string(),
  })).nullable().optional(),
});

export type BillCommittee = z.infer<typeof BillCommitteeSchema>;

export const BillListItemSchema = z.object({
  congress: z.coerce.number(),
  type: CongressBillTypeSchema,
  number: z.coerce.number(), // API may return string
  originChamber: z.string().nullable().optional(),
  originChamberCode: z.string().nullable().optional(),
  title: z.string(),
  latestAction: z.object({
    actionDate: z.string(),
    text: z.string(),
  }).nullable().optional(),
  updateDate: z.string(),
  updateDateIncludingText: z.string().nullable().optional(),
  url: z.string().url(),
});

export type BillListItem = z.infer<typeof BillListItemSchema>;

export const BillDetailSchema = z.object({
  congress: z.coerce.number(),
  type: CongressBillTypeSchema,
  number: z.coerce.number(), // API may return string
  originChamber: z.string().nullable().optional(),
  originChamberCode: z.string().nullable().optional(),
  title: z.string(),
  introducedDate: z.string().nullable().optional(),
  constitutionalAuthorityStatementText: z.string().nullable().optional(),
  policyArea: PolicyAreaSchema.nullable().optional(),
  subjects: z.object({
    legislativeSubjects: z.array(BillSubjectSchema).nullable().optional(),
  }).nullable().optional(),
  summaries: z.object({
    summary: z.array(BillSummarySchema).nullable().optional(),
  }).nullable().optional(),
  actions: z.object({
    count: z.number().nullable().optional(),
    actions: z.array(BillActionSchema).nullable().optional(),
  }).nullable().optional(),
  sponsors: z.array(BillSponsorSchema).nullable().optional(),
  cosponsors: z.object({
    count: z.number().nullable().optional(),
    countIncludingWithdrawnCosponsors: z.number().nullable().optional(),
  }).nullable().optional(),
  committees: z.object({
    count: z.number().nullable().optional(),
  }).nullable().optional(),
  latestAction: z.object({
    actionDate: z.string(),
    text: z.string(),
  }).nullable().optional(),
  textVersions: z.object({
    count: z.number().nullable().optional(),
  }).nullable().optional(),
  updateDate: z.string(),
  updateDateIncludingText: z.string().nullable().optional(),
});

export type BillDetail = z.infer<typeof BillDetailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Member/Legislator Types
// ─────────────────────────────────────────────────────────────────────────────

export const MemberTermSchema = z.object({
  chamber: z.string(),
  congress: z.number().nullable().optional(),
  startYear: z.number().nullable().optional(),
  endYear: z.number().nullable().optional(),
  memberType: z.string().nullable().optional(),
  stateCode: z.string().nullable().optional(),
  stateName: z.string().nullable().optional(),
  district: z.number().nullable().optional(),
});

export type MemberTerm = z.infer<typeof MemberTermSchema>;

export const MemberListItemSchema = z.object({
  bioguideId: z.string(),
  name: z.string(),
  partyName: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  district: z.number().nullable().optional(),
  terms: z.object({
    item: z.array(MemberTermSchema).nullable().optional(),
  }).nullable().optional(),
  depiction: z.object({
    imageUrl: z.string().url().nullable().optional(),
    attribution: z.string().nullable().optional(),
  }).nullable().optional(),
  url: z.string().url(),
  updateDate: z.string(),
});

export type MemberListItem = z.infer<typeof MemberListItemSchema>;

export const MemberDetailSchema = z.object({
  bioguideId: z.string(),
  birthYear: z.string().nullable().optional(),
  currentMember: z.boolean().nullable().optional(),
  directOrderName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  honorificName: z.string().nullable().optional(),
  invertedOrderName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  nickName: z.string().nullable().optional(),
  officialWebsiteUrl: z.string().url().nullable().optional(),
  partyHistory: z.array(z.object({
    partyAbbreviation: z.string(),
    partyName: z.string(),
    startYear: z.number().nullable().optional(),
    endYear: z.number().nullable().optional(),
  })).nullable().optional(),
  state: z.string().nullable().optional(),
  terms: z.array(MemberTermSchema).nullable().optional(),
  depiction: z.object({
    imageUrl: z.string().url().nullable().optional(),
    attribution: z.string().nullable().optional(),
  }).nullable().optional(),
  updateDate: z.string(),
});

export type MemberDetail = z.infer<typeof MemberDetailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Committee Types
// ─────────────────────────────────────────────────────────────────────────────

export const CommitteeListItemSchema = z.object({
  systemCode: z.string(),
  name: z.string(),
  chamber: z.string(),
  committeeTypeCode: z.string().nullable().optional(),
  parent: z.object({
    systemCode: z.string(),
    name: z.string(),
  }).nullable().optional(),
  url: z.string().url(),
  updateDate: z.string(),
});

export type CommitteeListItem = z.infer<typeof CommitteeListItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API Response Wrappers
// ─────────────────────────────────────────────────────────────────────────────

export const BillListResponseSchema = z.object({
  bills: z.array(BillListItemSchema),
  pagination: PaginationSchema.optional(),
});

export type BillListResponse = z.infer<typeof BillListResponseSchema>;

export const BillDetailResponseSchema = z.object({
  bill: BillDetailSchema,
});

export type BillDetailResponse = z.infer<typeof BillDetailResponseSchema>;

export const BillActionsResponseSchema = z.object({
  actions: z.array(BillActionSchema),
  pagination: PaginationSchema.optional(),
});

export type BillActionsResponse = z.infer<typeof BillActionsResponseSchema>;

export const BillCosponsorsResponseSchema = z.object({
  cosponsors: z.array(BillCosponsorSchema),
  pagination: PaginationSchema.optional(),
});

export type BillCosponsorsResponse = z.infer<typeof BillCosponsorsResponseSchema>;

export const BillTextVersionsResponseSchema = z.object({
  textVersions: z.array(BillTextVersionSchema),
  pagination: PaginationSchema.optional(),
});

export type BillTextVersionsResponse = z.infer<typeof BillTextVersionsResponseSchema>;

export const MemberListResponseSchema = z.object({
  members: z.array(MemberListItemSchema),
  pagination: PaginationSchema.optional(),
});

export type MemberListResponse = z.infer<typeof MemberListResponseSchema>;

export const MemberDetailResponseSchema = z.object({
  member: MemberDetailSchema,
});

export type MemberDetailResponse = z.infer<typeof MemberDetailResponseSchema>;

export const CommitteeListResponseSchema = z.object({
  committees: z.array(CommitteeListItemSchema),
  pagination: PaginationSchema.optional(),
});

export type CommitteeListResponse = z.infer<typeof CommitteeListResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Sync State Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncState {
  lastSyncTime: Date | null;
  lastSuccessfulSync: Date | null;
  isRunning: boolean;
  errorCount: number;
  lastError: string | null;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: Array<{ id: string; error: string }>;
  duration: number;
}
