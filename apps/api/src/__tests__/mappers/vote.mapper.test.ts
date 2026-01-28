/**
 * Vote Mapper Tests
 *
 * Verifies transformation from Prisma Vote entities to API Vote DTOs.
 * Uses type assertions for mock data - tests focus on mapper behavior,
 * not on providing complete Prisma entity shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  mapRollCallVoteSummaryToApi,
  mapRollCallVoteToApi,
  mapLegislatorVoteToApi,
  mapVoteWithLegislatorToApi,
  mapPartyBreakdownToApi,
} from '../../mappers/vote.mapper.js';
import type { RollCallVoteSummary, RollCallVoteWithRelations, VoteWithLegislator } from '../../repositories/vote.repository.js';

describe('Vote Mappers', () => {
  describe('mapRollCallVoteSummaryToApi', () => {
    const mockVoteSummary = {
      id: 'vote-123',
      chamber: 'HOUSE',
      congressNumber: 118,
      session: 2,
      rollNumber: 456,
      voteType: 'YEA_AND_NAY',
      voteCategory: 'PASSAGE',
      question: 'On Passage of the Bill',
      result: 'PASSED',
      yeas: 220,
      nays: 210,
      present: 2,
      notVoting: 3,
      voteDate: new Date('2024-03-15T14:30:00Z'),
    } as unknown as RollCallVoteSummary;

    it('maps basic vote fields correctly', () => {
      const result = mapRollCallVoteSummaryToApi(mockVoteSummary);

      expect(result.id).toBe('vote-123');
      expect(result.session).toBe(2);
      expect(result.question).toBe('On Passage of the Bill');
      expect(result.yeas).toBe(220);
      expect(result.nays).toBe(210);
      expect(result.present).toBe(2);
      expect(result.notVoting).toBe(3);
    });

    it('converts chamber from UPPERCASE to lowercase', () => {
      const result = mapRollCallVoteSummaryToApi(mockVoteSummary);
      expect(result.chamber).toBe('house');

      const senateVote = { ...mockVoteSummary, chamber: 'SENATE' } as RollCallVoteSummary;
      expect(mapRollCallVoteSummaryToApi(senateVote).chamber).toBe('senate');
    });

    it('maps rollNumber to rollCallNumber', () => {
      const result = mapRollCallVoteSummaryToApi(mockVoteSummary);
      expect(result.rollCallNumber).toBe(456);
    });

    it('converts voteDate to date ISO string', () => {
      const result = mapRollCallVoteSummaryToApi(mockVoteSummary);
      expect(result.date).toBe('2024-03-15T14:30:00.000Z');
    });

    it('converts result from UPPERCASE to lowercase', () => {
      const result = mapRollCallVoteSummaryToApi(mockVoteSummary);
      expect(result.result).toBe('passed');

      const failedVote = { ...mockVoteSummary, result: 'FAILED' } as RollCallVoteSummary;
      expect(mapRollCallVoteSummaryToApi(failedVote).result).toBe('failed');

      const agreedVote = { ...mockVoteSummary, result: 'AGREED_TO' } as RollCallVoteSummary;
      expect(mapRollCallVoteSummaryToApi(agreedVote).result).toBe('agreed_to');

      const rejectedVote = { ...mockVoteSummary, result: 'REJECTED' } as RollCallVoteSummary;
      expect(mapRollCallVoteSummaryToApi(rejectedVote).result).toBe('rejected');
    });
  });

  describe('mapRollCallVoteToApi', () => {
    const mockVoteWithRelations = {
      id: 'vote-789',
      chamber: 'SENATE',
      congressNumber: 118,
      session: 1,
      rollNumber: 123,
      voteType: 'RECORDED_VOTE',
      voteCategory: 'CLOTURE',
      question: 'On the Cloture Motion',
      result: 'AGREED_TO',
      yeas: 60,
      nays: 40,
      present: 0,
      notVoting: 0,
      voteDate: new Date('2024-02-10T18:00:00Z'),
      billId: 'bill-abc',
      bill: {
        id: 'bill-abc',
        title: 'Test Bill for Cloture',
        shortTitle: 'Test Bill',
        billType: 'S',
        billNumber: 999,
      },
      individualVotes: [],
      requiresMajority: null,
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10'),
    } as unknown as RollCallVoteWithRelations;

    it('maps all vote fields correctly', () => {
      const result = mapRollCallVoteToApi(mockVoteWithRelations);

      expect(result.id).toBe('vote-789');
      expect(result.chamber).toBe('senate');
      expect(result.session).toBe(1);
      expect(result.rollCallNumber).toBe(123);
      expect(result.question).toBe('On the Cloture Motion');
      expect(result.result).toBe('agreed_to');
      expect(result.yeas).toBe(60);
      expect(result.nays).toBe(40);
      expect(result.present).toBe(0);
      expect(result.notVoting).toBe(0);
      expect(result.date).toBe('2024-02-10T18:00:00.000Z');
    });

    it('includes billId when present', () => {
      const result = mapRollCallVoteToApi(mockVoteWithRelations);
      expect(result.billId).toBe('bill-abc');
    });

    it('maps bill relation correctly', () => {
      const result = mapRollCallVoteToApi(mockVoteWithRelations);

      expect(result.bill).toBeDefined();
      expect(result.bill?.id).toBe('bill-abc');
      expect(result.bill?.title).toBe('Test Bill for Cloture');
      expect(result.bill?.shortTitle).toBe('Test Bill');
      expect(result.bill?.type).toBe('s');
      expect(result.bill?.number).toBe(999);
    });

    it('handles vote with no bill', () => {
      const voteNoBill = {
        ...mockVoteWithRelations,
        billId: null,
        bill: null,
      } as unknown as RollCallVoteWithRelations;
      const result = mapRollCallVoteToApi(voteNoBill);

      expect(result.billId).toBeUndefined();
      expect(result.bill).toBeUndefined();
    });

    it('handles bill with null shortTitle', () => {
      const voteNullShortTitle = {
        ...mockVoteWithRelations,
        bill: {
          ...mockVoteWithRelations.bill!,
          shortTitle: null,
        },
      } as unknown as RollCallVoteWithRelations;
      const result = mapRollCallVoteToApi(voteNullShortTitle);

      expect(result.bill?.shortTitle).toBeUndefined();
    });
  });

  describe('mapLegislatorVoteToApi', () => {
    const mockVoteWithLegislator = {
      id: 'iv-1',
      legislatorId: 'A000001',
      rollCallId: 'vote-123',
      position: 'YEA',
      isProxy: false,
      pairedWithId: null,
      legislator: {
        id: 'A000001',
        fullName: 'John Smith',
        party: 'D',
        state: 'CA',
        chamber: 'HOUSE',
      },
    } as unknown as VoteWithLegislator;

    it('maps legislator vote correctly', () => {
      const result = mapLegislatorVoteToApi(mockVoteWithLegislator);

      expect(result.legislatorId).toBe('A000001');
      expect(result.voteId).toBe('vote-123');
      expect(result.position).toBe('yea');
    });

    it('converts position from UPPERCASE to lowercase', () => {
      expect(mapLegislatorVoteToApi({ ...mockVoteWithLegislator, position: 'NAY' } as unknown as VoteWithLegislator).position).toBe('nay');
      expect(mapLegislatorVoteToApi({ ...mockVoteWithLegislator, position: 'PRESENT' } as unknown as VoteWithLegislator).position).toBe('present');
      expect(mapLegislatorVoteToApi({ ...mockVoteWithLegislator, position: 'NOT_VOTING' } as unknown as VoteWithLegislator).position).toBe('not_voting');
    });
  });

  describe('mapVoteWithLegislatorToApi', () => {
    const mockVoteWithLegislator = {
      id: 'iv-2',
      legislatorId: 'B000002',
      rollCallId: 'vote-456',
      position: 'NAY',
      isProxy: false,
      pairedWithId: null,
      legislator: {
        id: 'B000002',
        fullName: 'Jane Doe',
        party: 'R',
        state: 'TX',
        chamber: 'SENATE',
      },
    } as unknown as VoteWithLegislator;

    it('maps vote with legislator details correctly', () => {
      const result = mapVoteWithLegislatorToApi(mockVoteWithLegislator);

      expect(result.legislatorId).toBe('B000002');
      expect(result.fullName).toBe('Jane Doe');
      expect(result.party).toBe('R');
      expect(result.state).toBe('TX');
      expect(result.position).toBe('nay');
    });

    it('passes party through without conversion (identical enum)', () => {
      const democratVote = {
        ...mockVoteWithLegislator,
        legislator: { ...mockVoteWithLegislator.legislator, party: 'D' },
      } as unknown as VoteWithLegislator;
      expect(mapVoteWithLegislatorToApi(democratVote).party).toBe('D');

      const independentVote = {
        ...mockVoteWithLegislator,
        legislator: { ...mockVoteWithLegislator.legislator, party: 'I' },
      } as unknown as VoteWithLegislator;
      expect(mapVoteWithLegislatorToApi(independentVote).party).toBe('I');
    });
  });

  describe('mapPartyBreakdownToApi', () => {
    it('converts party breakdown from UPPERCASE to lowercase keys', () => {
      const breakdown = {
        D: { YEA: 180, NAY: 20, PRESENT: 1, NOT_VOTING: 2 },
        R: { YEA: 40, NAY: 190, PRESENT: 0, NOT_VOTING: 1 },
      };

      const result = mapPartyBreakdownToApi(breakdown);

      expect(result.D).toEqual({ yea: 180, nay: 20, present: 1, notVoting: 2 });
      expect(result.R).toEqual({ yea: 40, nay: 190, present: 0, notVoting: 1 });
    });

    it('handles missing position keys with zero defaults', () => {
      const breakdown = {
        D: { YEA: 100 }, // Missing NAY, PRESENT, NOT_VOTING
      };

      const result = mapPartyBreakdownToApi(breakdown);

      expect(result.D).toEqual({ yea: 100, nay: 0, present: 0, notVoting: 0 });
    });

    it('handles empty breakdown', () => {
      const breakdown = {};
      const result = mapPartyBreakdownToApi(breakdown);
      expect(result).toEqual({});
    });

    it('handles all party types', () => {
      const breakdown = {
        D: { YEA: 10, NAY: 5, PRESENT: 1, NOT_VOTING: 1 },
        R: { YEA: 8, NAY: 7, PRESENT: 0, NOT_VOTING: 2 },
        I: { YEA: 2, NAY: 0, PRESENT: 0, NOT_VOTING: 0 },
        L: { YEA: 1, NAY: 0, PRESENT: 0, NOT_VOTING: 0 },
        G: { YEA: 0, NAY: 1, PRESENT: 0, NOT_VOTING: 0 },
      };

      const result = mapPartyBreakdownToApi(breakdown);

      expect(Object.keys(result)).toHaveLength(5);
      expect(result.I!.yea).toBe(2);
      expect(result.L!.yea).toBe(1);
      expect(result.G!.nay).toBe(1);
    });
  });
});
