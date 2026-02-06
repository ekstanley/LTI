/**
 * Votes Routes Integration Tests
 *
 * Tests API endpoints for roll call vote operations.
 * Mocks service layer to isolate route behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Vote, PaginatedResponse } from '@ltip/shared';

// Mock the service before importing routes
vi.mock('../../services/index.js', () => ({
  voteService: {
    list: vi.fn(),
    getById: vi.fn(),
    getVoteBreakdown: vi.fn(),
    getPartyBreakdown: vi.fn(),
    getRecent: vi.fn(),
    compareVotingRecords: vi.fn(),
  },
}));

// Import after mocking
import { votesRouter } from '../../routes/votes.js';
import { voteService } from '../../services/index.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with votes router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/votes', votesRouter);
  app.use(errorHandler);
  return app;
}

describe('Votes Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/v1/votes', () => {
    it('returns 200 with paginated votes list', async () => {
      const mockResponse = {
        data: [
          {
            id: 'vote-123',
            chamber: 'house',
            congressNumber: 118,
            session: 1,
            rollNumber: 100,
            question: 'On Passage',
            result: 'passed',
            voteDate: '2023-01-15T00:00:00.000Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(voteService.list).mockResolvedValue(mockResponse as unknown as PaginatedResponse<Vote>);

      const response = await request(app).get('/api/v1/votes').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(voteService.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
    });

    it('forwards filter parameters to service', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      };

      vi.mocked(voteService.list).mockResolvedValue(mockResponse as unknown as PaginatedResponse<Vote>);

      await request(app).get('/api/v1/votes').query({
        chamber: 'senate',
        congressNumber: 118,
        session: 1,
        result: 'passed',
        billId: 'hr-1234-118',
        voteDateAfter: '2023-01-01T00:00:00Z',
        voteDateBefore: '2023-12-31T23:59:59Z',
        limit: 10,
        offset: 0,
      });

      expect(voteService.list).toHaveBeenCalledWith({
        chamber: 'senate',
        congressNumber: 118,
        session: 1,
        result: 'passed',
        billId: 'hr-1234-118',
        voteDateAfter: '2023-01-01T00:00:00Z',
        voteDateBefore: '2023-12-31T23:59:59Z',
        limit: 10,
        offset: 0,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const response = await request(app).get('/api/v1/votes').query({
        limit: -1, // Invalid: negative limit
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'limit',
          }),
        ])
      );
    });

    it('returns 500 when service throws error', async () => {
      vi.mocked(voteService.list).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/votes').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/votes/:id', () => {
    const validVoteId = 'vote-123';

    it('returns 200 with vote details for valid ID', async () => {
      const mockVote = {
        id: validVoteId,
        chamber: 'house',
        congressNumber: 118,
        session: 1,
        rollNumber: 100,
        question: 'On Passage',
        result: 'passed',
        voteDate: '2023-01-15T00:00:00.000Z',
        totalYes: 220,
        totalNo: 210,
        totalNotVoting: 5,
      };

      vi.mocked(voteService.getById).mockResolvedValue(mockVote as unknown as Vote);

      const response = await request(app).get(`/api/v1/votes/${validVoteId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVote);
      expect(voteService.getById).toHaveBeenCalledWith(validVoteId);
    });

    it('returns 404 when vote not found', async () => {
      vi.mocked(voteService.getById).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/votes/${validVoteId}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Vote not found');
    });

    it('returns 400 for invalid vote ID format', async () => {
      const response = await request(app).get('/api/v1/votes/invalid@id!');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/votes/:id/breakdown', () => {
    const validVoteId = 'vote-123';

    it('returns 200 with individual vote breakdown', async () => {
      const mockBreakdown = {
        vote: {
          id: validVoteId,
          question: 'On Passage',
          result: 'passed',
        },
        votes: [
          {
            legislatorId: 'L000001',
            fullName: 'John Doe',
            party: 'democrat',
            state: 'CA',
            position: 'yes',
          },
          {
            legislatorId: 'L000002',
            fullName: 'Jane Smith',
            party: 'republican',
            state: 'TX',
            position: 'no',
          },
        ],
      };

      vi.mocked(voteService.getVoteBreakdown).mockResolvedValue(
        mockBreakdown as unknown as Awaited<ReturnType<typeof voteService.getVoteBreakdown>>
      );

      const response = await request(app).get(`/api/v1/votes/${validVoteId}/breakdown`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBreakdown);
      expect(voteService.getVoteBreakdown).toHaveBeenCalledWith(validVoteId);
    });

    it('returns 404 when vote not found', async () => {
      vi.mocked(voteService.getVoteBreakdown).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/votes/${validVoteId}/breakdown`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/votes/:id/party-breakdown', () => {
    const validVoteId = 'vote-123';

    it('returns 200 with party breakdown', async () => {
      const mockPartyBreakdown: Record<string, { yea: number; nay: number; present: number; notVoting: number }> = {
        democrat: { yea: 215, nay: 0, present: 0, notVoting: 5 },
        republican: { yea: 5, nay: 210, present: 0, notVoting: 0 },
      };

      vi.mocked(voteService.getPartyBreakdown).mockResolvedValue(mockPartyBreakdown);

      const response = await request(app).get(`/api/v1/votes/${validVoteId}/party-breakdown`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockPartyBreakdown });
      expect(voteService.getPartyBreakdown).toHaveBeenCalledWith(validVoteId);
    });

    it('returns empty record when vote has no individual votes', async () => {
      vi.mocked(voteService.getPartyBreakdown).mockResolvedValue({});

      const response = await request(app).get(`/api/v1/votes/${validVoteId}/party-breakdown`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: {} });
    });
  });

  describe('GET /api/v1/votes/recent/:chamber', () => {
    it('returns 200 with recent votes for house', async () => {
      const mockVotes = [
        {
          id: 'vote-456',
          chamber: 'house',
          rollNumber: 105,
          question: 'On Agreeing to the Amendment',
          result: 'passed',
          voteDate: '2023-02-01T00:00:00.000Z',
        },
      ];

      vi.mocked(voteService.getRecent).mockResolvedValue(mockVotes as unknown as Vote[]);

      const response = await request(app).get('/api/v1/votes/recent/house').query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockVotes });
      expect(voteService.getRecent).toHaveBeenCalledWith('house', 10);
    });

    it('returns 200 with recent votes for senate', async () => {
      const mockVotes = [
        {
          id: 'vote-789',
          chamber: 'senate',
          rollNumber: 50,
          question: 'On Passage of the Bill',
          result: 'failed',
          voteDate: '2023-02-01T00:00:00.000Z',
        },
      ];

      vi.mocked(voteService.getRecent).mockResolvedValue(mockVotes as unknown as Vote[]);

      const response = await request(app).get('/api/v1/votes/recent/senate').query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockVotes });
      expect(voteService.getRecent).toHaveBeenCalledWith('senate', 5);
    });

    it('uses default limit when not provided', async () => {
      vi.mocked(voteService.getRecent).mockResolvedValue([]);

      await request(app).get('/api/v1/votes/recent/house');

      expect(voteService.getRecent).toHaveBeenCalledWith('house', 10);
    });

    it('returns 400 for invalid chamber', async () => {
      const response = await request(app).get('/api/v1/votes/recent/invalid-chamber');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/votes/compare', () => {
    const validLegislator1 = 'L000001';
    const validLegislator2 = 'L000002';

    it('returns 200 with comparison data for valid legislator IDs', async () => {
      const mockComparison = {
        legislator1: {
          id: validLegislator1,
          fullName: 'John Doe',
          party: 'democrat',
          state: 'CA',
        },
        legislator2: {
          id: validLegislator2,
          fullName: 'Jane Smith',
          party: 'republican',
          state: 'TX',
        },
        agreement: {
          totalVotes: 100,
          sameVotes: 35,
          differentVotes: 65,
          agreementPercentage: 35.0,
        },
        votes: [
          {
            voteId: 'vote-123',
            question: 'On Passage',
            legislator1Position: 'yes',
            legislator2Position: 'no',
            agreed: false,
          },
        ],
      };

      vi.mocked(voteService.compareVotingRecords).mockResolvedValue(
        mockComparison as unknown as Awaited<ReturnType<typeof voteService.compareVotingRecords>>
      );

      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator1: validLegislator1,
        legislator2: validLegislator2,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockComparison);
      expect(voteService.compareVotingRecords).toHaveBeenCalledWith(
        validLegislator1,
        validLegislator2,
        undefined
      );
    });

    it('returns 400 when legislator1 is missing', async () => {
      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator2: validLegislator2,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'legislator1',
          }),
        ])
      );
    });

    it('returns 400 when legislator2 is missing', async () => {
      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator1: validLegislator1,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'legislator2',
          }),
        ])
      );
    });

    it('forwards optional congressNumber to service', async () => {
      const mockComparison = {
        legislator1: { id: validLegislator1, fullName: 'John Doe', party: 'democrat', state: 'CA' },
        legislator2: { id: validLegislator2, fullName: 'Jane Smith', party: 'republican', state: 'TX' },
        agreement: { totalVotes: 50, sameVotes: 20, differentVotes: 30, agreementPercentage: 40.0 },
        votes: [],
      };

      vi.mocked(voteService.compareVotingRecords).mockResolvedValue(
        mockComparison as unknown as Awaited<ReturnType<typeof voteService.compareVotingRecords>>
      );

      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator1: validLegislator1,
        legislator2: validLegislator2,
        congressNumber: 118,
      });

      expect(response.status).toBe(200);
      expect(voteService.compareVotingRecords).toHaveBeenCalledWith(validLegislator1, validLegislator2, 118);
    });

    it('returns 400 for invalid legislator ID format', async () => {
      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator1: 'invalid@id!',
        legislator2: validLegislator2,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'legislator1',
            message: expect.stringContaining('Invalid legislator ID format'),
          }),
        ])
      );
    });

    it('returns 500 when service throws error', async () => {
      vi.mocked(voteService.compareVotingRecords).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/votes/compare').query({
        legislator1: validLegislator1,
        legislator2: validLegislator2,
      });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });
});
