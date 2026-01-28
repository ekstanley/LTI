/**
 * Mappers Index
 *
 * Re-exports all mapper functions for convenient importing.
 * Mappers transform between Prisma entities and API DTOs.
 */

// Enum mappers (bidirectional)
export {
  billTypeToApi,
  apiToBillType,
  billTypeToChamber,
  partyToApi,
  apiToParty,
  chamberToApi,
  apiToChamber,
  billStatusToApi,
  apiToBillStatus,
  votePositionToApi,
  apiToVotePosition,
  voteResultToApi,
  apiToVoteResult,
} from './enums.js';

// Bill mappers
export { mapBillSummaryToApi, mapBillToApi } from './bill.mapper.js';

// Legislator mappers
export {
  mapLegislatorSummaryToApi,
  mapLegislatorToApi,
  mapCommitteeMembershipToApi,
  mapLegislatorWithCommitteesToApi,
} from './legislator.mapper.js';

// Vote mappers
export {
  mapRollCallVoteSummaryToApi,
  mapRollCallVoteToApi,
  mapLegislatorVoteToApi,
  mapVoteWithLegislatorToApi,
  mapPartyBreakdownToApi,
} from './vote.mapper.js';
