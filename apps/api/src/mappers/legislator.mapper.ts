/**
 * Legislator Mapper
 *
 * Transforms Prisma Legislator entities to API Legislator DTOs.
 * Handles field name differences and enum conversion.
 *
 * Key mappings:
 * - Prisma `id` → API `id` AND `bioguideId` (they're the same value)
 * - Prisma `twitterHandle` → API `twitter`
 * - API `imageUrl` - not stored in DB, omitted
 *
 * Note: Uses conditional spreads for optional properties to satisfy
 * exactOptionalPropertyTypes - properties are omitted rather than set to undefined.
 */

import type { Legislator } from '@ltip/shared';

import type { LegislatorSummary, LegislatorWithRelations } from '../repositories/legislator.repository.js';

import { partyToApi, chamberToApi } from './enums.js';

/**
 * Map Prisma LegislatorSummary to API Legislator (partial - for list views)
 * Note: termStart/termEnd not available in summary, requires full entity
 */
export function mapLegislatorSummaryToApi(
  legislator: LegislatorSummary
): Pick<Legislator, 'id' | 'bioguideId' | 'firstName' | 'lastName' | 'fullName' | 'party' | 'state' | 'district' | 'chamber' | 'website' | 'twitter' | 'inOffice'> {
  return {
    id: legislator.id,
    bioguideId: legislator.id, // In Prisma schema, id IS the bioguideId
    firstName: legislator.firstName,
    lastName: legislator.lastName,
    fullName: legislator.fullName,
    party: partyToApi(legislator.party),
    state: legislator.state,
    ...(legislator.district != null && { district: legislator.district }),
    chamber: chamberToApi(legislator.chamber),
    ...(legislator.website != null && { website: legislator.website }),
    ...(legislator.twitterHandle != null && { twitter: legislator.twitterHandle }),
    inOffice: legislator.inOffice,
  };
}

/**
 * Map Prisma LegislatorWithRelations to full API Legislator
 */
export function mapLegislatorToApi(legislator: LegislatorWithRelations): Legislator {
  return {
    id: legislator.id,
    bioguideId: legislator.id, // In Prisma schema, id IS the bioguideId
    firstName: legislator.firstName,
    lastName: legislator.lastName,
    fullName: legislator.fullName,
    party: partyToApi(legislator.party),
    state: legislator.state,
    ...(legislator.district != null && { district: legislator.district }),
    chamber: chamberToApi(legislator.chamber),
    // imageUrl not stored in DB - omitted
    ...(legislator.website != null && { website: legislator.website }),
    ...(legislator.twitterHandle != null && { twitter: legislator.twitterHandle }),
    inOffice: legislator.inOffice,
    termStart: legislator.termStart?.toISOString() ?? new Date().toISOString(),
    ...(legislator.termEnd != null && { termEnd: legislator.termEnd.toISOString() }),
  };
}

/**
 * Map committee membership from Prisma to API structure
 */
export function mapCommitteeMembershipToApi(membership: LegislatorWithRelations['committees'][number]) {
  return {
    committeeId: membership.committee.id,
    committeeName: membership.committee.name,
    chamber: chamberToApi(membership.committee.chamber),
    ...(membership.role != null && { role: membership.role }),
    isSubcommittee: membership.committee.parentId !== null,
  };
}

/**
 * Map legislator with committee memberships
 */
export function mapLegislatorWithCommitteesToApi(
  legislator: LegislatorWithRelations
): Legislator & { committees: ReturnType<typeof mapCommitteeMembershipToApi>[] } {
  return {
    ...mapLegislatorToApi(legislator),
    committees: legislator.committees.map(mapCommitteeMembershipToApi),
  };
}
