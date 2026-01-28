/**
 * Enum Mappers
 *
 * Bidirectional transformation between Prisma enums (UPPERCASE)
 * and API contract enums (lowercase from @ltip/shared).
 *
 * Note: Party enum is identical in both (D, R, I, L, G) - no mapping needed.
 */

import { BillType, Chamber, BillStatus, VotePosition, VoteResult, Party } from '@prisma/client';
import type {
  BillType as ApiBillType,
  Chamber as ApiChamber,
  BillStatus as ApiBillStatus,
  VotePosition as ApiVotePosition,
  VoteResult as ApiVoteResult,
  Party as ApiParty,
} from '@ltip/shared';

// ============================================================================
// Bill Type Mappings
// ============================================================================

const billTypeMap: Record<BillType, ApiBillType> = {
  HR: 'hr',
  S: 's',
  HJRES: 'hjres',
  SJRES: 'sjres',
  HCONRES: 'hconres',
  SCONRES: 'sconres',
  HRES: 'hres',
  SRES: 'sres',
};

const apiBillTypeMap: Record<ApiBillType, BillType> = {
  hr: 'HR',
  s: 'S',
  hjres: 'HJRES',
  sjres: 'SJRES',
  hconres: 'HCONRES',
  sconres: 'SCONRES',
  hres: 'HRES',
  sres: 'SRES',
};

export function billTypeToApi(type: BillType): ApiBillType {
  return billTypeMap[type];
}

export function apiToBillType(type: ApiBillType): BillType {
  const result = apiBillTypeMap[type];
  if (!result) throw new Error(`Unknown API bill type: ${type}`);
  return result;
}

/**
 * Derive chamber from bill type
 * House bills: HR, HRES, HJRES, HCONRES
 * Senate bills: S, SRES, SJRES, SCONRES
 */
export function billTypeToChamber(type: BillType): ApiChamber {
  const houseBillTypes: BillType[] = ['HR', 'HRES', 'HJRES', 'HCONRES'];
  return houseBillTypes.includes(type) ? 'house' : 'senate';
}

// ============================================================================
// Party Mappings
// ============================================================================

// Prisma Party and API Party are identical (D, R, I, L, G)
// Only 'O' (Other) in Prisma needs special handling

const partyMap: Record<Party, ApiParty> = {
  D: 'D',
  R: 'R',
  I: 'I',
  L: 'L',
  G: 'G',
  O: 'I', // Map 'Other' to 'Independent' for API
};

export function partyToApi(party: Party): ApiParty {
  return partyMap[party];
}

export function apiToParty(party: ApiParty): Party {
  // Direct mapping - API types are subset of Prisma types
  return party as Party;
}

// ============================================================================
// Chamber Mappings
// ============================================================================

const chamberMap: Record<Chamber, ApiChamber> = {
  HOUSE: 'house',
  SENATE: 'senate',
};

const apiChamberMap: Record<ApiChamber, Chamber | null> = {
  house: 'HOUSE',
  senate: 'SENATE',
  joint: null, // API has 'joint' but Prisma doesn't - handle specially
};

export function chamberToApi(chamber: Chamber): ApiChamber {
  return chamberMap[chamber];
}

export function apiToChamber(chamber: ApiChamber): Chamber | null {
  const result = apiChamberMap[chamber];
  return result === undefined ? null : result;
}

// ============================================================================
// Bill Status Mappings
// ============================================================================

// Prisma has more statuses than API - map to nearest equivalent
const billStatusMap: Record<BillStatus, ApiBillStatus> = {
  INTRODUCED: 'introduced',
  IN_COMMITTEE: 'in_committee',
  REPORTED_BY_COMMITTEE: 'in_committee', // Collapse to in_committee
  PASSED_HOUSE: 'passed_house',
  PASSED_SENATE: 'passed_senate',
  RESOLVING_DIFFERENCES: 'resolving_differences',
  TO_PRESIDENT: 'to_president',
  SIGNED_INTO_LAW: 'became_law',
  VETOED: 'vetoed',
  VETO_OVERRIDDEN: 'became_law', // Ultimately became law
  POCKET_VETOED: 'vetoed', // Form of veto
  FAILED: 'failed',
  WITHDRAWN: 'failed', // Effectively failed
  ENACTED: 'became_law', // Alternative name for law
};

const apiBillStatusMap: Record<ApiBillStatus, BillStatus> = {
  introduced: 'INTRODUCED',
  in_committee: 'IN_COMMITTEE',
  passed_house: 'PASSED_HOUSE',
  passed_senate: 'PASSED_SENATE',
  resolving_differences: 'RESOLVING_DIFFERENCES',
  to_president: 'TO_PRESIDENT',
  became_law: 'SIGNED_INTO_LAW',
  vetoed: 'VETOED',
  failed: 'FAILED',
};

export function billStatusToApi(status: BillStatus): ApiBillStatus {
  return billStatusMap[status];
}

export function apiToBillStatus(status: ApiBillStatus): BillStatus {
  const result = apiBillStatusMap[status];
  if (!result) throw new Error(`Unknown API bill status: ${status}`);
  return result;
}

// ============================================================================
// Vote Position Mappings
// ============================================================================

const votePositionMap: Record<VotePosition, ApiVotePosition> = {
  YEA: 'yea',
  NAY: 'nay',
  PRESENT: 'present',
  NOT_VOTING: 'not_voting',
};

const apiVotePositionMap: Record<ApiVotePosition, VotePosition> = {
  yea: 'YEA',
  nay: 'NAY',
  present: 'PRESENT',
  not_voting: 'NOT_VOTING',
};

export function votePositionToApi(position: VotePosition): ApiVotePosition {
  return votePositionMap[position];
}

export function apiToVotePosition(position: ApiVotePosition): VotePosition {
  const result = apiVotePositionMap[position];
  if (!result) throw new Error(`Unknown API vote position: ${position}`);
  return result;
}

// ============================================================================
// Vote Result Mappings
// ============================================================================

const voteResultMap: Record<VoteResult, ApiVoteResult> = {
  PASSED: 'passed',
  FAILED: 'failed',
  AGREED_TO: 'agreed_to',
  REJECTED: 'rejected',
};

const apiVoteResultMap: Record<ApiVoteResult, VoteResult> = {
  passed: 'PASSED',
  failed: 'FAILED',
  agreed_to: 'AGREED_TO',
  rejected: 'REJECTED',
};

export function voteResultToApi(result: VoteResult): ApiVoteResult {
  return voteResultMap[result];
}

export function apiToVoteResult(result: ApiVoteResult): VoteResult {
  const mapped = apiVoteResultMap[result];
  if (!mapped) throw new Error(`Unknown API vote result: ${result}`);
  return mapped;
}
