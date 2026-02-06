/**
 * Legislators Routes Integration Tests
 *
 * Tests API endpoints for legislator operations.
 * Mocks service layer to isolate route behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Legislator, PaginatedResponse } from '@ltip/shared';

// Mock the service before importing routes
vi.mock('../../services/index.js', () => ({
  legislatorService: {
    list: vi.fn(),
    getById: vi.fn(),
    getWithCommittees: vi.fn(),
    getBills: vi.fn(),
    getVotes: vi.fn(),
    getStats: vi.fn(),
  },
}));

// Import after mocking
import { legislatorsRouter } from '../../routes/legislators.js';
import { legislatorService } from '../../services/index.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with legislators router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/legislators', legislatorsRouter);
  app.use(errorHandler);
  return app;
}

describe('Legislators Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/v1/legislators', () => {
    it('returns 200 with paginated legislators list', async () => {
      const mockResponse = {
        data: [
          {
            id: 'L000001',
            bioguideId: 'D000001',
            fullName: 'John Doe',
            party: 'democrat',
            state: 'CA',
            chamber: 'house',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(legislatorService.list).mockResolvedValue(
        mockResponse as unknown as PaginatedResponse<Partial<Legislator>>
      );

      const response = await request(app).get('/api/v1/legislators').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(legislatorService.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
    });

    it('forwards filter parameters to service', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      };

      vi.mocked(legislatorService.list).mockResolvedValue(
        mockResponse as unknown as PaginatedResponse<Partial<Legislator>>
      );

      await request(app).get('/api/v1/legislators').query({
        chamber: 'senate',
        party: 'R',
        state: 'TX',
        inOffice: true,
        limit: 10,
        offset: 0,
      });

      expect(legislatorService.list).toHaveBeenCalledWith({
        chamber: 'senate',
        party: 'R',
        state: 'TX',
        inOffice: true,
        limit: 10,
        offset: 0,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const response = await request(app).get('/api/v1/legislators').query({
        limit: 999, // Invalid: exceeds maximum
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
      vi.mocked(legislatorService.list).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/legislators').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/legislators/:id', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with legislator details for valid ID', async () => {
      const mockLegislator = {
        id: validLegislatorId,
        bioguideId: 'D000001',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        party: 'democrat',
        state: 'CA',
        chamber: 'house',
        inOffice: true,
      };

      vi.mocked(legislatorService.getById).mockResolvedValue(mockLegislator as unknown as Legislator);

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockLegislator);
      expect(legislatorService.getById).toHaveBeenCalledWith(validLegislatorId);
    });

    it('returns 404 when legislator not found', async () => {
      vi.mocked(legislatorService.getById).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Legislator not found');
    });

    it('returns 400 for invalid legislator ID format', async () => {
      const response = await request(app).get('/api/v1/legislators/invalid@id');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FORMAT');
    });
  });

  describe('GET /api/v1/legislators/:id/committees', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with committee assignments', async () => {
      const mockLegislatorWithCommittees = {
        id: validLegislatorId,
        fullName: 'John Doe',
        committees: [
          {
            id: 'HSAG',
            name: 'House Committee on Agriculture',
            role: 'member',
          },
        ],
      };

      vi.mocked(legislatorService.getWithCommittees).mockResolvedValue(
        mockLegislatorWithCommittees as unknown as Awaited<ReturnType<typeof legislatorService.getWithCommittees>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/committees`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockLegislatorWithCommittees.committees });
      expect(legislatorService.getWithCommittees).toHaveBeenCalledWith(validLegislatorId);
    });

    it('returns 404 when legislator not found', async () => {
      vi.mocked(legislatorService.getWithCommittees).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/committees`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/legislators/:id/bills', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with sponsored bills', async () => {
      const mockResponse = {
        data: [
          {
            id: 'hr-1234-118',
            title: 'Test Bill Act',
            billType: 'hr',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(legislatorService.getBills).mockResolvedValue(
        mockResponse as unknown as PaginatedResponse<Partial<Legislator>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/bills`).query({
        limit: 20,
        offset: 0,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(legislatorService.getBills).toHaveBeenCalledWith(validLegislatorId, false, 20, 0);
    });

    it('filters for primary sponsor only when requested', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      };

      vi.mocked(legislatorService.getBills).mockResolvedValue(
        mockResponse as unknown as PaginatedResponse<Partial<Legislator>>
      );

      await request(app).get(`/api/v1/legislators/${validLegislatorId}/bills`).query({
        primaryOnly: true,
      });

      expect(legislatorService.getBills).toHaveBeenCalledWith(validLegislatorId, true, 20, 0);
    });
  });

  describe('GET /api/v1/legislators/:id/votes', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with voting record', async () => {
      const mockResponse = {
        data: [
          {
            voteId: 'vote-123',
            position: 'yes',
            date: '2023-01-15T00:00:00.000Z',
            question: 'On Passage',
            chamber: 'house',
            result: 'passed',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(legislatorService.getVotes).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof legislatorService.getVotes>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/votes`).query({
        limit: 20,
        offset: 0,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(legislatorService.getVotes).toHaveBeenCalledWith(validLegislatorId, 20, 0);
    });

    it('uses default pagination when not provided', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      };

      vi.mocked(legislatorService.getVotes).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof legislatorService.getVotes>>
      );

      await request(app).get(`/api/v1/legislators/${validLegislatorId}/votes`);

      expect(legislatorService.getVotes).toHaveBeenCalledWith(validLegislatorId, 20, 0);
    });
  });

  describe('GET /api/v1/legislators/:id/voting-record', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with voting record (alias endpoint)', async () => {
      const mockResponse = {
        data: [
          {
            voteId: 'vote-123',
            position: 'no',
            date: '2023-01-15T00:00:00.000Z',
            question: 'On Passage',
            chamber: 'senate',
            result: 'failed',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(legislatorService.getVotes).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof legislatorService.getVotes>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/voting-record`).query({
        limit: 20,
        offset: 0,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(legislatorService.getVotes).toHaveBeenCalledWith(validLegislatorId, 20, 0);
    });
  });

  describe('GET /api/v1/legislators/:id/stats', () => {
    const validLegislatorId = 'L000001';

    it('returns 200 with legislator statistics', async () => {
      const mockStats = {
        voting: { yes: 300, no: 150, present: 10, notVoting: 40 },
        sponsorship: {
          byStatus: { introduced: 15, passed_house: 5, enacted: 5 },
          totalSponsored: 25,
          totalCosponsored: 150,
        },
      };

      vi.mocked(legislatorService.getStats).mockResolvedValue(
        mockStats as unknown as Awaited<ReturnType<typeof legislatorService.getStats>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/stats`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(legislatorService.getStats).toHaveBeenCalledWith(validLegislatorId);
    });

    it('returns stats even when data is empty', async () => {
      const emptyStats = {
        voting: {},
        sponsorship: {
          byStatus: {},
          totalSponsored: 0,
          totalCosponsored: 0,
        },
      };

      vi.mocked(legislatorService.getStats).mockResolvedValue(
        emptyStats as unknown as Awaited<ReturnType<typeof legislatorService.getStats>>
      );

      const response = await request(app).get(`/api/v1/legislators/${validLegislatorId}/stats`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(emptyStats);
    });
  });
});
