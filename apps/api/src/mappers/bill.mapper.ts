/**
 * Bill Mapper
 *
 * Transforms Prisma Bill entities to API Bill DTOs.
 * Handles enum conversion and nested sponsor mapping.
 *
 * Note: Uses conditional spreads for optional properties to satisfy
 * exactOptionalPropertyTypes - properties are omitted rather than set to undefined.
 *
 * IMPORTANT: Date fields may be Date objects (from DB) or strings (from cache).
 * Always use toISODate() helper to handle both cases safely.
 */

import type { Bill, Legislator } from '@ltip/shared';
import type { BillSummary, BillWithRelations } from '../repositories/bill.repository.js';
import { billTypeToApi, billStatusToApi, billTypeToChamber, chamberToApi, partyToApi } from './enums.js';

/**
 * Safely convert Date or ISO string to ISO string
 * Handles cache deserialization where Dates become strings
 */
function toISODate(value: Date | string): string {
  if (typeof value === 'string') {
    return value; // Already an ISO string from cache
  }
  return value.toISOString();
}

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
    introducedDate: toISODate(bill.introducedDate),
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
    termStart: legislator.termStart ? toISODate(legislator.termStart) : new Date().toISOString(),
    ...(legislator.termEnd != null && { termEnd: toISODate(legislator.termEnd) }),
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
    introducedDate: toISODate(bill.introducedDate),
    status: billStatusToApi(bill.status),
    chamber: billTypeToChamber(bill.billType),
    cosponsorsCount: bill.sponsors.length,
    subjects: bill.subjects.map((s) => s.subject.name),
    ...(bill.policyArea?.name != null && { policyArea: bill.policyArea.name }),
    ...(primarySponsor && { sponsor: mapSponsorToApi(primarySponsor.legislator) }),
    createdAt: toISODate(bill.createdAt),
    updatedAt: toISODate(bill.updatedAt),
  };
}
