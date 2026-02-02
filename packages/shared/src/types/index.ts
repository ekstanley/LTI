/**
 * Shared TypeScript types for LTIP
 * These types are used by both frontend and backend
 */

// ============================================================================
// Bill Types
// ============================================================================

export interface Bill {
  id: string;
  congressNumber: number;
  billType: BillType;
  billNumber: number;
  title: string;
  shortTitle?: string;
  introducedDate: string;
  latestAction?: BillAction;
  status: BillStatus;
  chamber: Chamber;
  sponsor?: Legislator;
  cosponsorsCount: number;
  subjects: string[];
  policyArea?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillType = 'hr' | 's' | 'hjres' | 'sjres' | 'hconres' | 'sconres' | 'hres' | 'sres';

export type BillStatus =
  | 'introduced'
  | 'in_committee'
  | 'passed_house'
  | 'passed_senate'
  | 'resolving_differences'
  | 'to_president'
  | 'became_law'
  | 'vetoed'
  | 'failed';

export type Chamber = 'house' | 'senate' | 'joint';

export interface BillAction {
  date: string;
  text: string;
  type?: string;
  chamber?: Chamber;
}

// ============================================================================
// Legislator Types
// ============================================================================

export interface Legislator {
  id: string;
  bioguideId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: Party;
  state: string;
  district?: number;
  chamber: Chamber;
  imageUrl?: string;
  phone?: string;
  website?: string;
  twitter?: string;
  inOffice: boolean;
  termStart: string;
  termEnd?: string;
}

export type Party = 'D' | 'R' | 'I' | 'L' | 'G';

// ============================================================================
// Vote Types
// ============================================================================

export interface Vote {
  id: string;
  billId?: string;
  chamber: Chamber;
  session: number;
  rollCallNumber: number;
  date: string;
  question: string;
  result: VoteResult;
  yeas: number;
  nays: number;
  present: number;
  notVoting: number;
}

export type VoteResult = 'passed' | 'failed' | 'agreed_to' | 'rejected';

export interface LegislatorVote {
  legislatorId: string;
  voteId: string;
  position: VotePosition;
}

export type VotePosition = 'yea' | 'nay' | 'present' | 'not_voting';

// ============================================================================
// Analysis Types
// ============================================================================

export interface BillAnalysis {
  billId: string;
  summary: string;
  summaryQualityScore: number;
  biasScore: number; // -1 (left) to +1 (right)
  biasConfidence: number; // 0 to 1
  passageProbability: number; // 0 to 1
  passageConfidence: number; // 0 to 1
  fiscalImpact?: FiscalImpact;
  populationImpact?: PopulationImpact;
  perspectives: Perspectives;
  analyzedAt: string;
}

export interface FiscalImpact {
  estimatedCost?: number;
  estimatedRevenue?: number;
  netImpact?: number;
  timeframeYears: number;
  source: 'cbo' | 'estimated';
  confidence: number;
}

export interface PopulationImpact {
  estimatedAffected: number;
  affectedGroups: string[];
  confidence: number;
}

export interface Perspectives {
  left: PerspectiveAnalysis;
  center: PerspectiveAnalysis;
  right: PerspectiveAnalysis;
}

export interface PerspectiveAnalysis {
  summary: string;
  keyPoints: string[];
  concerns: string[];
  support: string[];
}

// ============================================================================
// Conflict of Interest Types
// ============================================================================

export interface ConflictOfInterest {
  id: string;
  legislatorId: string;
  billId: string;
  type: COIType;
  severity: COISeverity;
  description: string;
  evidence: string[];
  detectedAt: string;
}

export type COIType = 'stock_holding' | 'family_employment' | 'lobbying_contact' | 'campaign_donation';

export type COISeverity = 'high' | 'medium' | 'low';

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export interface VoteUpdateEvent {
  type: 'vote:update';
  data: {
    voteId: string;
    billId?: string;
    legislatorId: string;
    position: VotePosition;
    timestamp: string;
  };
}

export interface TallyUpdateEvent {
  type: 'tally:update';
  data: {
    voteId: string;
    billId?: string;
    yeas: number;
    nays: number;
    present: number;
    notVoting: number;
    timestamp: string;
  };
}

export interface BillStatusChangeEvent {
  type: 'bill:status_change';
  data: {
    billId: string;
    previousStatus: BillStatus;
    newStatus: BillStatus;
    action: BillAction;
    timestamp: string;
  };
}

export type WebSocketEvent = VoteUpdateEvent | TallyUpdateEvent | BillStatusChangeEvent;

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * User role type
 */
export type UserRole = 'admin' | 'user';

/**
 * Authenticated user
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** User display name */
  name: string;
  /** User role */
  role: UserRole;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response payload
 */
export interface LoginResponse {
  /** JWT authentication token */
  token: string;
  /** Authenticated user data */
  user: User;
}

/**
 * Token refresh response payload
 */
export interface RefreshTokenResponse {
  /** New JWT authentication token */
  token: string;
  /** Updated user data */
  user: User;
}
