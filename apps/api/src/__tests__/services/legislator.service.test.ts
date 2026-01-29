/**
 * Legislator Service Unit Tests
 *
 * Tests business logic layer for legislator operations.
 * Mocks repository layer to isolate service behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { legislatorService } from '../../services/legislator.service.js';
import { legislatorRepository } from '../../repositories/legislator.repository.js';
import { voteRepository } from '../../repositories/vote.repository.js';
import type {
  LegislatorSummary,
  LegislatorWithRelations,
} from '../../repositories/legislator.repository.js';

// Mock the repository modules
vi.mock('../../repositories/legislator.repository.js', () => ({
  legislatorRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    search: vi.fn(),
    getVotingStats: vi.fn(),
    getSponsorshipStats: vi.fn(),
  },
}));

vi.mock('../../repositories/vote.repository.js', () => ({
  voteRepository: {
    getLegislatorVotes: vi.fn(),
  },
}));

describe('LegislatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLegislatorSummary: LegislatorSummary = {
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
  };

  describe('list', () => {
    it('returns paginated legislator summaries with correct format', async () => {
      const mockRepoResult = {
        data: [mockLegislatorSummary],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      const result = await legislatorService.list({ limit: 20, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    });

    it('transforms legislator data to API format', async () => {
      const mockRepoResult = {
        data: [mockLegislatorSummary],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      const result = await legislatorService.list({ limit: 20, offset: 0 });
      const legislator = result.data[0];

      // Verify API format transformations
      expect(legislator).toBeDefined();
      expect(legislator!.id).toBe('A000001');
      expect(legislator!.bioguideId).toBe('A000001');
      expect(legislator!.fullName).toBe('John Smith');
      expect(legislator!.chamber).toBe('house'); // lowercase
      expect(legislator!.party).toBe('D');
      expect(legislator!.twitter).toBe('repjohnsmith');
    });

    it('defaults to inOffice=true filter', async () => {
      const mockRepoResult = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      await legislatorService.list({ limit: 20, offset: 0 });

      expect(legislatorRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ inOffice: true }),
        expect.any(Object)
      );
    });

    it('uses search endpoint when search param provided', async () => {
      const mockSearchResult = {
        data: [{ ...mockLegislatorSummary, rank: 0.95 }],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.search).mockResolvedValue(mockSearchResult);

      await legislatorService.list({ limit: 20, offset: 0, search: 'smith' });

      expect(legislatorRepository.search).toHaveBeenCalledWith(
        'smith',
        expect.objectContaining({ page: 1, limit: 20 })
      );
      expect(legislatorRepository.findMany).not.toHaveBeenCalled();
    });

    it('applies party filter with API-to-Prisma conversion', async () => {
      const mockRepoResult = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      await legislatorService.list({ limit: 20, offset: 0, party: 'D' });

      expect(legislatorRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ party: 'D' }),
        expect.any(Object)
      );
    });

    it('applies chamber filter with API-to-Prisma conversion', async () => {
      const mockRepoResult = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      await legislatorService.list({ limit: 20, offset: 0, chamber: 'senate' });

      expect(legislatorRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ chamber: 'SENATE' }),
        expect.any(Object)
      );
    });

    it('normalizes state filter to uppercase', async () => {
      const mockRepoResult = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(legislatorRepository.findMany).mockResolvedValue(mockRepoResult);

      await legislatorService.list({ limit: 20, offset: 0, state: 'ca' });

      expect(legislatorRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'CA' }),
        expect.any(Object)
      );
    });
  });

  describe('getById', () => {
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

    it('returns mapped legislator when found', async () => {
      vi.mocked(legislatorRepository.findById).mockResolvedValue(mockLegislatorWithRelations);

      const result = await legislatorService.getById('B000002');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('B000002');
      expect(result!.chamber).toBe('senate');
      expect(result!.party).toBe('R');
    });

    it('returns null when legislator not found', async () => {
      vi.mocked(legislatorRepository.findById).mockResolvedValue(null);

      const result = await legislatorService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getWithCommittees', () => {
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
      ],
      partyHistory: [],
    } as unknown as LegislatorWithRelations;

    it('returns legislator with mapped committees', async () => {
      vi.mocked(legislatorRepository.findById).mockResolvedValue(mockLegislatorWithCommittees);

      const result = await legislatorService.getWithCommittees('C000003');

      expect(result).not.toBeNull();
      expect(result!.committees).toHaveLength(1);
      expect(result!.committees[0]).toEqual({
        committeeId: 'SSBU',
        committeeName: 'Senate Budget',
        chamber: 'senate',
        role: 'Chair',
        isSubcommittee: false,
      });
    });

    it('returns null when legislator not found', async () => {
      vi.mocked(legislatorRepository.findById).mockResolvedValue(null);

      const result = await legislatorService.getWithCommittees('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns combined voting and sponsorship stats', async () => {
      const mockVotingStats = {
        totalVotes: 500,
        yesVotes: 300,
        noVotes: 150,
        presentVotes: 25,
        notVotingVotes: 25,
        participationRate: 95,
        partyLoyaltyRate: 92,
      };

      const mockSponsorshipStats = {
        byStatus: { INTRODUCED: 15, IN_COMMITTEE: 7, BECAME_LAW: 3 } as Record<string, number>,
        totalSponsored: 25,
        totalCosponsored: 150,
      };

      vi.mocked(legislatorRepository.getVotingStats).mockResolvedValue(mockVotingStats);
      vi.mocked(legislatorRepository.getSponsorshipStats).mockResolvedValue(mockSponsorshipStats);

      const result = await legislatorService.getStats('A000001');

      expect(result).toEqual({
        voting: mockVotingStats,
        sponsorship: mockSponsorshipStats,
      });
      expect(legislatorRepository.getVotingStats).toHaveBeenCalledWith('A000001');
      expect(legislatorRepository.getSponsorshipStats).toHaveBeenCalledWith('A000001');
    });
  });

  describe('getVotes', () => {
    it('returns mapped voting record', async () => {
      const mockVoteResult = {
        data: [
          {
            rollCallId: 'rc-1',
            position: 'YEA',
            rollCall: {
              voteDate: new Date('2024-01-15'),
              question: 'On Passage of the Bill',
              chamber: 'SENATE',
              result: 'passed',
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(voteRepository.getLegislatorVotes).mockResolvedValue(mockVoteResult as never);

      const result = await legislatorService.getVotes('A000001', 20, 0);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        voteId: 'rc-1',
        date: '2024-01-15T00:00:00.000Z',
        question: 'On Passage of the Bill',
        position: 'yea',
        chamber: 'senate',
        result: 'passed',
      });
    });
  });
});
