/**
 * Legislator Mapper Tests
 *
 * Verifies transformation from Prisma Legislator entities to API Legislator DTOs.
 * Uses type assertions for mock data - tests focus on mapper behavior,
 * not on providing complete Prisma entity shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  mapLegislatorSummaryToApi,
  mapLegislatorToApi,
  mapCommitteeMembershipToApi,
  mapLegislatorWithCommitteesToApi,
} from '../../mappers/legislator.mapper.js';
import type { LegislatorSummary, LegislatorWithRelations } from '../../repositories/legislator.repository.js';

describe('Legislator Mappers', () => {
  describe('mapLegislatorSummaryToApi', () => {
    const mockLegislatorSummary = {
      id: 'A000001',
      firstName: 'John',
      lastName: 'Smith',
      fullName: 'John Smith',
      nickName: 'Johnny',
      party: 'D',
      chamber: 'HOUSE',
      state: 'CA',
      district: 12,
      isVotingMember: true,
      leadershipRole: 'Speaker',
      inOffice: true,
      website: 'https://smith.house.gov',
      twitterHandle: 'repjohnsmith',
    } as LegislatorSummary;

    it('maps basic fields correctly', () => {
      const result = mapLegislatorSummaryToApi(mockLegislatorSummary);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Smith');
      expect(result.fullName).toBe('John Smith');
      expect(result.state).toBe('CA');
      expect(result.district).toBe(12);
      expect(result.inOffice).toBe(true);
    });

    it('maps id to both id and bioguideId', () => {
      const result = mapLegislatorSummaryToApi(mockLegislatorSummary);

      expect(result.id).toBe('A000001');
      expect(result.bioguideId).toBe('A000001');
    });

    it('converts party from Prisma to API format', () => {
      const result = mapLegislatorSummaryToApi(mockLegislatorSummary);
      expect(result.party).toBe('D');

      const republican = { ...mockLegislatorSummary, party: 'R' } as LegislatorSummary;
      expect(mapLegislatorSummaryToApi(republican).party).toBe('R');
    });

    it('converts chamber from UPPERCASE to lowercase', () => {
      const result = mapLegislatorSummaryToApi(mockLegislatorSummary);
      expect(result.chamber).toBe('house');

      const senator = { ...mockLegislatorSummary, chamber: 'SENATE' } as LegislatorSummary;
      expect(mapLegislatorSummaryToApi(senator).chamber).toBe('senate');
    });

    it('maps twitterHandle to twitter', () => {
      const result = mapLegislatorSummaryToApi(mockLegislatorSummary);
      expect(result.twitter).toBe('repjohnsmith');
    });

    it('handles null optional fields', () => {
      const legislatorWithNulls = {
        ...mockLegislatorSummary,
        district: null,
        website: null,
        twitterHandle: null,
      } as LegislatorSummary;
      const result = mapLegislatorSummaryToApi(legislatorWithNulls);

      expect(result.district).toBeUndefined();
      expect(result.website).toBeUndefined();
      expect(result.twitter).toBeUndefined();
    });

    it('maps Other party to Independent', () => {
      const otherParty = { ...mockLegislatorSummary, party: 'O' } as LegislatorSummary;
      const result = mapLegislatorSummaryToApi(otherParty);
      expect(result.party).toBe('I');
    });
  });

  describe('mapLegislatorToApi', () => {
    const mockLegislatorWithRelations = {
      id: 'B000002',
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      nickName: null,
      party: 'R',
      chamber: 'SENATE',
      state: 'TX',
      district: null,
      isVotingMember: true,
      leadershipRole: null,
      inOffice: true,
      website: 'https://doe.senate.gov',
      twitterHandle: 'senjanedoe',
      phone: '202-555-1234',
      termStart: new Date('2023-01-03'),
      termEnd: new Date('2029-01-03'),
      committees: [],
      partyHistory: [],
    } as unknown as LegislatorWithRelations;

    it('maps all basic fields correctly', () => {
      const result = mapLegislatorToApi(mockLegislatorWithRelations);

      expect(result.id).toBe('B000002');
      expect(result.bioguideId).toBe('B000002');
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Doe');
      expect(result.fullName).toBe('Jane Doe');
      expect(result.state).toBe('TX');
      expect(result.inOffice).toBe(true);
    });

    it('converts party and chamber correctly', () => {
      const result = mapLegislatorToApi(mockLegislatorWithRelations);

      expect(result.party).toBe('R');
      expect(result.chamber).toBe('senate');
    });

    it('converts termStart and termEnd to ISO strings', () => {
      const result = mapLegislatorToApi(mockLegislatorWithRelations);

      expect(result.termStart).toBe('2023-01-03T00:00:00.000Z');
      expect(result.termEnd).toBe('2029-01-03T00:00:00.000Z');
    });

    it('handles null termStart with fallback to current date', () => {
      const legislatorNoTermStart = {
        ...mockLegislatorWithRelations,
        termStart: null,
      } as unknown as LegislatorWithRelations;
      const result = mapLegislatorToApi(legislatorNoTermStart);

      // Should be a valid ISO date string
      expect(result.termStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('handles null termEnd', () => {
      const legislatorNoTermEnd = {
        ...mockLegislatorWithRelations,
        termEnd: null,
      } as unknown as LegislatorWithRelations;
      const result = mapLegislatorToApi(legislatorNoTermEnd);

      expect(result.termEnd).toBeUndefined();
    });

    it('handles senators with no district', () => {
      const result = mapLegislatorToApi(mockLegislatorWithRelations);
      expect(result.district).toBeUndefined();
    });
  });

  describe('mapCommitteeMembershipToApi', () => {
    const mockMembership = {
      id: 'cm-1',
      legislatorId: 'A000001',
      committeeId: 'HSAG',
      role: 'Chair',
      startDate: new Date('2023-01-03'),
      endDate: null,
      committee: {
        id: 'HSAG',
        name: 'House Agriculture',
        chamber: 'HOUSE',
        parentId: null,
        type: 'STANDING',
        jurisdiction: null,
      },
    } as unknown as LegislatorWithRelations['committees'][number];

    it('maps committee membership correctly', () => {
      const result = mapCommitteeMembershipToApi(mockMembership);

      expect(result.committeeId).toBe('HSAG');
      expect(result.committeeName).toBe('House Agriculture');
      expect(result.chamber).toBe('house');
      expect(result.role).toBe('Chair');
      expect(result.isSubcommittee).toBe(false);
    });

    it('identifies subcommittees correctly', () => {
      const subcommitteeMembership = {
        ...mockMembership,
        committee: {
          ...mockMembership.committee,
          parentId: 'HSAG',
        },
      } as unknown as LegislatorWithRelations['committees'][number];
      const result = mapCommitteeMembershipToApi(subcommitteeMembership);

      expect(result.isSubcommittee).toBe(true);
    });

    it('handles null role', () => {
      const membershipNoRole = {
        ...mockMembership,
        role: null,
      } as unknown as LegislatorWithRelations['committees'][number];
      const result = mapCommitteeMembershipToApi(membershipNoRole);

      expect(result.role).toBeUndefined();
    });
  });

  describe('mapLegislatorWithCommitteesToApi', () => {
    const mockLegislatorWithCommittees = {
      id: 'C000003',
      firstName: 'Bob',
      lastName: 'Johnson',
      fullName: 'Bob Johnson',
      nickName: null,
      party: 'I',
      chamber: 'SENATE',
      state: 'VT',
      district: null,
      isVotingMember: true,
      leadershipRole: null,
      inOffice: true,
      website: null,
      twitterHandle: null,
      phone: null,
      termStart: new Date('2007-01-03'),
      termEnd: new Date('2031-01-03'),
      committees: [
        {
          id: 'cm-1',
          legislatorId: 'C000003',
          committeeId: 'SSBU',
          role: 'Chair',
          startDate: new Date('2023-01-03'),
          endDate: null,
          committee: {
            id: 'SSBU',
            name: 'Senate Budget',
            chamber: 'SENATE',
            parentId: null,
            type: 'STANDING',
            jurisdiction: null,
          },
        },
        {
          id: 'cm-2',
          legislatorId: 'C000003',
          committeeId: 'SSVR',
          role: 'Member',
          startDate: new Date('2023-01-03'),
          endDate: null,
          committee: {
            id: 'SSVR',
            name: 'Senate Veterans Affairs',
            chamber: 'SENATE',
            parentId: null,
            type: 'STANDING',
            jurisdiction: null,
          },
        },
      ],
      partyHistory: [],
    } as unknown as LegislatorWithRelations;

    it('includes all legislator fields', () => {
      const result = mapLegislatorWithCommitteesToApi(mockLegislatorWithCommittees);

      expect(result.id).toBe('C000003');
      expect(result.bioguideId).toBe('C000003');
      expect(result.fullName).toBe('Bob Johnson');
      expect(result.party).toBe('I');
      expect(result.chamber).toBe('senate');
    });

    it('includes mapped committees array', () => {
      const result = mapLegislatorWithCommitteesToApi(mockLegislatorWithCommittees);

      expect(result.committees).toHaveLength(2);
      expect(result.committees[0]).toEqual({
        committeeId: 'SSBU',
        committeeName: 'Senate Budget',
        chamber: 'senate',
        role: 'Chair',
        isSubcommittee: false,
      });
      expect(result.committees[1]).toEqual({
        committeeId: 'SSVR',
        committeeName: 'Senate Veterans Affairs',
        chamber: 'senate',
        role: 'Member',
        isSubcommittee: false,
      });
    });

    it('handles legislator with no committees', () => {
      const legislatorNoCommittees = {
        ...mockLegislatorWithCommittees,
        committees: [],
      } as unknown as LegislatorWithRelations;
      const result = mapLegislatorWithCommitteesToApi(legislatorNoCommittees);

      expect(result.committees).toEqual([]);
    });
  });
});
