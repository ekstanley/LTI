/**
 * Bill Mapper
 *
 * Transforms Prisma Bill entities to API Bill DTOs.
 * Handles enum conversion and nested sponsor mapping.
 *
 * Note: Uses conditional spreads for optional properties to satisfy
 * exactOptionalPropertyTypes - properties are omitted rather than set to undefined.
 */

import type { Bill, Legislator } from '@ltip/shared';
import type { BillSummary, BillWithRelations } from '../repositories/bill.repository.js';
import { billTypeToApi, billStatusToApi, billTypeToChamber, chamberToApi, partyToApi } from './enums.js';

/**
 * Map Prisma BillSummary to API Bill (partial - for list views)
 */
export function mapBillSummaryToApi(
  bill: BillSummary
): Pick<Bill, 'id' | 'congressNumber' | 'billType' | 'billNumber' | 'title' | 'shortTitle' | 'introducedDate' | 'status' | 'chamber' | 'cosponsorsCount'> {
  return {
    id: bill.id,
    congressNumber: bill.congressNumber,
    billType: billTypeToApi(bill.billType),
    billNumber: bill.billNumber,
    title: bill.title,
    ...(bill.shortTitle != null && { shortTitle: bill.shortTitle }),
    introducedDate: bill.introducedDate.toISOString(),
    status: billStatusToApi(bill.status),
    chamber: billTypeToChamber(bill.billType),
    cosponsorsCount: bill.sponsorCount,
  };
}

/**
 * Map a sponsor's legislator to API Legislator
 */
function mapSponsorToApi(
  legislator: BillWithRelations['sponsors'][number]['legislator']
): Legislator {
  return {
    id: legislator.id,
    bioguideId: legislator.id, // id IS the bioguideId
    firstName: legislator.firstName,
    lastName: legislator.lastName,
    fullName: legislator.fullName,
    party: partyToApi(legislator.party),
    state: legislator.state,
    ...(legislator.district != null && { district: legislator.district }),
    chamber: chamberToApi(legislator.chamber),
    inOffice: legislator.inOffice,
    termStart: legislator.termStart?.toISOString() ?? new Date().toISOString(),
    ...(legislator.termEnd != null && { termEnd: legislator.termEnd.toISOString() }),
  };
}

/**
 * Map Prisma BillWithRelations to full API Bill
 */
export function mapBillToApi(bill: BillWithRelations): Bill {
  const primarySponsor = bill.sponsors.find((s) => s.isPrimary);

  return {
    id: bill.id,
    congressNumber: bill.congressNumber,
    billType: billTypeToApi(bill.billType),
    billNumber: bill.billNumber,
    title: bill.title,
    ...(bill.shortTitle != null && { shortTitle: bill.shortTitle }),
    introducedDate: bill.introducedDate.toISOString(),
    status: billStatusToApi(bill.status),
    chamber: billTypeToChamber(bill.billType),
    cosponsorsCount: bill.sponsors.length,
    subjects: bill.subjects.map((s) => s.subject.name),
    ...(bill.policyArea?.name != null && { policyArea: bill.policyArea.name }),
    ...(primarySponsor && { sponsor: mapSponsorToApi(primarySponsor.legislator) }),
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}
