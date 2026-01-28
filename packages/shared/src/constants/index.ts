/**
 * Shared constants for LTIP
 */

// ============================================================================
// Bill Constants
// ============================================================================

export const BILL_TYPES = {
  hr: 'House Bill',
  s: 'Senate Bill',
  hjres: 'House Joint Resolution',
  sjres: 'Senate Joint Resolution',
  hconres: 'House Concurrent Resolution',
  sconres: 'Senate Concurrent Resolution',
  hres: 'House Simple Resolution',
  sres: 'Senate Simple Resolution',
} as const;

export const BILL_STATUS_LABELS = {
  introduced: 'Introduced',
  in_committee: 'In Committee',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  resolving_differences: 'Resolving Differences',
  to_president: 'To President',
  became_law: 'Became Law',
  vetoed: 'Vetoed',
  failed: 'Failed',
} as const;

export const BILL_STATUS_COLORS = {
  introduced: 'bg-gray-100 text-gray-800',
  in_committee: 'bg-yellow-100 text-yellow-800',
  passed_house: 'bg-blue-100 text-blue-800',
  passed_senate: 'bg-indigo-100 text-indigo-800',
  resolving_differences: 'bg-purple-100 text-purple-800',
  to_president: 'bg-orange-100 text-orange-800',
  became_law: 'bg-green-100 text-green-800',
  vetoed: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
} as const;

// ============================================================================
// Party Constants
// ============================================================================

export const PARTY_LABELS = {
  D: 'Democrat',
  R: 'Republican',
  I: 'Independent',
  L: 'Libertarian',
  G: 'Green',
} as const;

export const PARTY_COLORS = {
  D: 'bg-blue-600',
  R: 'bg-red-600',
  I: 'bg-purple-600',
  L: 'bg-yellow-600',
  G: 'bg-green-600',
} as const;

export const PARTY_TEXT_COLORS = {
  D: 'text-blue-600',
  R: 'text-red-600',
  I: 'text-purple-600',
  L: 'text-yellow-600',
  G: 'text-green-600',
} as const;

// ============================================================================
// Chamber Constants
// ============================================================================

export const CHAMBER_LABELS = {
  house: 'House of Representatives',
  senate: 'Senate',
  joint: 'Joint',
} as const;

export const CHAMBER_SHORT_LABELS = {
  house: 'House',
  senate: 'Senate',
  joint: 'Joint',
} as const;

// ============================================================================
// Vote Constants
// ============================================================================

export const VOTE_POSITION_LABELS = {
  yea: 'Yea',
  nay: 'Nay',
  present: 'Present',
  not_voting: 'Not Voting',
} as const;

export const VOTE_POSITION_COLORS = {
  yea: 'bg-green-100 text-green-800',
  nay: 'bg-red-100 text-red-800',
  present: 'bg-yellow-100 text-yellow-800',
  not_voting: 'bg-gray-100 text-gray-800',
} as const;

export const VOTE_RESULT_LABELS = {
  passed: 'Passed',
  failed: 'Failed',
  agreed_to: 'Agreed To',
  rejected: 'Rejected',
} as const;

// ============================================================================
// Conflict of Interest Constants
// ============================================================================

export const COI_TYPE_LABELS = {
  stock_holding: 'Stock Holding',
  family_employment: 'Family Employment',
  lobbying_contact: 'Lobbying Contact',
  campaign_donation: 'Campaign Donation',
} as const;

export const COI_SEVERITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

export const COI_SEVERITY_COLORS = {
  high: 'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
} as const;

// ============================================================================
// API Constants
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const API_ENDPOINTS = {
  bills: '/api/v1/bills',
  legislators: '/api/v1/legislators',
  votes: '/api/v1/votes',
  analysis: '/api/v1/analysis',
  conflicts: '/api/v1/conflicts',
  search: '/api/v1/search',
  health: '/api/health',
} as const;

// ============================================================================
// WebSocket Events
// ============================================================================

export const WS_EVENTS = {
  VOTE_UPDATE: 'vote:update',
  TALLY_UPDATE: 'tally:update',
  BILL_STATUS_CHANGE: 'bill:status_change',
  CONNECTION_ESTABLISHED: 'connection:established',
  ERROR: 'error',
} as const;

// ============================================================================
// US States
// ============================================================================

export const US_STATES = {
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

// ============================================================================
// Current Congress
// ============================================================================

export const CURRENT_CONGRESS = 119;
export const CONGRESS_START_YEAR = 2025;
