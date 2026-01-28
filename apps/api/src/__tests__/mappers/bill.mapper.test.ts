/**
 * Bill Mapper Tests
 *
 * Verifies transformation from Prisma Bill entities to API Bill DTOs.
 * Uses type assertions for mock data - tests focus on mapper behavior,
 * not on providing complete Prisma entity shapes.
 */

import { describe, it, expect } from 'vitest';
import { mapBillSummaryToApi, mapBillToApi } from '../../mappers/bill.mapper.js';
import type { BillSummary, BillWithRelations } from '../../repositories/bill.repository.js';

describe('Bill Mappers', () => {
  describe('mapBillSummaryToApi', () => {
    // Type assertion allows us to provide only the fields the mapper actually uses
    const mockBillSummary = {
      id: 'bill-123',
      congressNumber: 118,
      billType: 'HR',
      billNumber: 1234,
      title: 'Test Bill Title',
      shortTitle: 'Test Bill',
      introducedDate: new Date('2024-01-15'),
      status: 'INTRODUCED',
      sponsorCount: 5,
    } as BillSummary;

    it('maps basic bill fields correctly', () => {
      const result = mapBillSummaryToApi(mockBillSummary);

      expect(result.id).toBe('bill-123');
      expect(result.congressNumber).toBe(118);
      expect(result.billNumber).toBe(1234);
      expect(result.title).toBe('Test Bill Title');
      expect(result.shortTitle).toBe('Test Bill');
    });

    it('converts billType from Prisma to API format', () => {
      const result = mapBillSummaryToApi(mockBillSummary);
      expect(result.billType).toBe('hr');
    });

    it('converts status from Prisma to API format', () => {
      const result = mapBillSummaryToApi(mockBillSummary);
      expect(result.status).toBe('introduced');
    });

    it('derives chamber from billType', () => {
      const result = mapBillSummaryToApi(mockBillSummary);
      expect(result.chamber).toBe('house');

      const senateBill = { ...mockBillSummary, billType: 'S' } as BillSummary;
      const senateResult = mapBillSummaryToApi(senateBill);
      expect(senateResult.chamber).toBe('senate');
    });

    it('converts introducedDate to ISO string', () => {
      const result = mapBillSummaryToApi(mockBillSummary);
      expect(result.introducedDate).toBe('2024-01-15T00:00:00.000Z');
    });

    it('maps sponsorCount to cosponsorsCount', () => {
      const result = mapBillSummaryToApi(mockBillSummary);
      expect(result.cosponsorsCount).toBe(5);
    });

    it('handles null shortTitle', () => {
      const billWithNullShortTitle = { ...mockBillSummary, shortTitle: null } as BillSummary;
      const result = mapBillSummaryToApi(billWithNullShortTitle);
      expect(result.shortTitle).toBeUndefined();
    });
  });

  describe('mapBillToApi', () => {
    const mockBillWithRelations = {
      id: 'bill-456',
      congressNumber: 118,
      billType: 'S',
      billNumber: 789,
      title: 'Full Bill Title',
      shortTitle: 'Full Bill',
      introducedDate: new Date('2024-02-20'),
      status: 'PASSED_SENATE',
      policyArea: { id: 'pa-1', name: 'Healthcare', parentId: null },
      subjects: [
        { subject: { id: 's-1', name: 'Medicare', parentId: null } },
        { subject: { id: 's-2', name: 'Insurance', parentId: null } },
      ],
      sponsors: [
        {
          id: 'sp-1',
          billId: 'bill-456',
          legislatorId: 'A000001',
          isPrimary: true,
          cosponsorDate: null,
          withdrawnDate: null,
          legislator: {
            id: 'A000001',
            firstName: 'John',
            lastName: 'Smith',
            fullName: 'John Smith',
            party: 'D',
            state: 'CA',
            district: 12,
            chamber: 'HOUSE',
            inOffice: true,
            termStart: new Date('2023-01-03'),
            termEnd: new Date('2025-01-03'),
          },
        },
        {
          id: 'sp-2',
          billId: 'bill-456',
          legislatorId: 'B000002',
          isPrimary: false,
          cosponsorDate: null,
          withdrawnDate: null,
          legislator: {
            id: 'B000002',
            firstName: 'Jane',
            lastName: 'Doe',
            fullName: 'Jane Doe',
            party: 'R',
            state: 'TX',
            district: null,
            chamber: 'SENATE',
            inOffice: true,
            termStart: new Date('2021-01-03'),
            termEnd: null,
          },
        },
      ],
      createdAt: new Date('2024-02-20T10:00:00Z'),
      updatedAt: new Date('2024-03-01T15:30:00Z'),
    } as unknown as BillWithRelations;

    it('maps all basic fields correctly', () => {
      const result = mapBillToApi(mockBillWithRelations);

      expect(result.id).toBe('bill-456');
      expect(result.congressNumber).toBe(118);
      expect(result.billType).toBe('s');
      expect(result.billNumber).toBe(789);
      expect(result.title).toBe('Full Bill Title');
      expect(result.shortTitle).toBe('Full Bill');
    });

    it('derives senate chamber from S billType', () => {
      const result = mapBillToApi(mockBillWithRelations);
      expect(result.chamber).toBe('senate');
    });

    it('converts status to API format', () => {
      const result = mapBillToApi(mockBillWithRelations);
      expect(result.status).toBe('passed_senate');
    });

    it('extracts policy area name', () => {
      const result = mapBillToApi(mockBillWithRelations);
      expect(result.policyArea).toBe('Healthcare');
    });

    it('extracts subject names into array', () => {
      const result = mapBillToApi(mockBillWithRelations);
      expect(result.subjects).toEqual(['Medicare', 'Insurance']);
    });

    it('maps primary sponsor correctly', () => {
      const result = mapBillToApi(mockBillWithRelations);

      expect(result.sponsor).toBeDefined();
      expect(result.sponsor?.id).toBe('A000001');
      expect(result.sponsor?.bioguideId).toBe('A000001');
      expect(result.sponsor?.firstName).toBe('John');
      expect(result.sponsor?.lastName).toBe('Smith');
      expect(result.sponsor?.fullName).toBe('John Smith');
      expect(result.sponsor?.party).toBe('D');
      expect(result.sponsor?.state).toBe('CA');
      expect(result.sponsor?.district).toBe(12);
      expect(result.sponsor?.chamber).toBe('house');
      expect(result.sponsor?.inOffice).toBe(true);
    });

    it('converts sponsor dates to ISO strings', () => {
      const result = mapBillToApi(mockBillWithRelations);

      expect(result.sponsor?.termStart).toBe('2023-01-03T00:00:00.000Z');
      expect(result.sponsor?.termEnd).toBe('2025-01-03T00:00:00.000Z');
    });

    it('calculates cosponsorsCount from sponsors array length', () => {
      const result = mapBillToApi(mockBillWithRelations);
      expect(result.cosponsorsCount).toBe(2);
    });

    it('converts timestamps to ISO strings', () => {
      const result = mapBillToApi(mockBillWithRelations);

      expect(result.createdAt).toBe('2024-02-20T10:00:00.000Z');
      expect(result.updatedAt).toBe('2024-03-01T15:30:00.000Z');
    });

    it('handles bill with no primary sponsor', () => {
      const billNoPrimary = {
        ...mockBillWithRelations,
        sponsors: (mockBillWithRelations.sponsors as unknown[]).map((s: unknown) => ({
          ...(s as object),
          isPrimary: false,
        })),
      } as unknown as BillWithRelations;
      const result = mapBillToApi(billNoPrimary);
      expect(result.sponsor).toBeUndefined();
    });

    it('handles bill with no policy area', () => {
      const billNoPolicyArea = { ...mockBillWithRelations, policyArea: null } as unknown as BillWithRelations;
      const result = mapBillToApi(billNoPolicyArea);
      expect(result.policyArea).toBeUndefined();
    });

    it('handles sponsor with null district', () => {
      const billWithSenateSponsor = {
        ...mockBillWithRelations,
        sponsors: [mockBillWithRelations.sponsors[1]],
      } as unknown as BillWithRelations;
      const result = mapBillToApi(billWithSenateSponsor);
      expect(result.sponsor?.district).toBeUndefined();
    });

    it('handles sponsor with null termStart', () => {
      const primarySponsor = mockBillWithRelations.sponsors[0]!;
      const billWithNoTermStart = {
        ...mockBillWithRelations,
        sponsors: [
          {
            ...primarySponsor,
            legislator: {
              ...primarySponsor.legislator,
              termStart: null,
            },
          },
        ],
      } as unknown as BillWithRelations;
      const result = mapBillToApi(billWithNoTermStart);
      // Should default to current date
      expect(result.sponsor?.termStart).toBeDefined();
    });
  });
});
