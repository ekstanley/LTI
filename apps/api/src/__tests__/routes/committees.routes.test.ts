/**
 * Committees Routes Integration Tests
 *
 * Tests API endpoints for congressional committee operations.
 * Mocks service layer to isolate route behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the service before importing routes
vi.mock('../../services/index.js', () => ({
  committeeService: {
    list: vi.fn(),
    getStandingCommittees: vi.fn(),
    getById: vi.fn(),
    getSubcommittees: vi.fn(),
    getMembers: vi.fn(),
    getReferredBills: vi.fn(),
  },
}));

// Import after mocking
import { committeesRouter } from '../../routes/committees.js';
import { committeeService } from '../../services/index.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with committees router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/committees', committeesRouter);
  app.use(errorHandler);
  return app;
}

describe('Committees Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/v1/committees', () => {
    it('returns 200 with paginated committees list', async () => {
      const mockResponse = {
        data: [
          {
            id: 'HSAG',
            name: 'House Committee on Agriculture',
            chamber: 'house',
            type: 'standing',
            parentId: null,
            jurisdiction: 'Agriculture and rural development',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(committeeService.list).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof committeeService.list>>
      );

      const response = await request(app).get('/api/v1/committees').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(committeeService.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
    });

    it('forwards filter parameters to service', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      };

      vi.mocked(committeeService.list).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof committeeService.list>>
      );

      await request(app).get('/api/v1/committees').query({
        chamber: 'senate',
        type: 'standing',
        parentId: 'HSAG',
        limit: 10,
        offset: 0,
      });

      expect(committeeService.list).toHaveBeenCalledWith({
        chamber: 'senate',
        type: 'standing',
        parentId: 'HSAG',
        limit: 10,
        offset: 0,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const response = await request(app).get('/api/v1/committees').query({
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
      vi.mocked(committeeService.list).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/committees').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/committees/standing', () => {
    it('returns 200 with standing committees for house', async () => {
      const mockCommittees = [
        {
          id: 'HSAG',
          name: 'House Committee on Agriculture',
          chamber: 'house',
          type: 'standing',
        },
        {
          id: 'HSAP',
          name: 'House Committee on Appropriations',
          chamber: 'house',
          type: 'standing',
        },
      ];

      vi.mocked(committeeService.getStandingCommittees).mockResolvedValue(
        mockCommittees as unknown as Awaited<ReturnType<typeof committeeService.getStandingCommittees>>
      );

      const response = await request(app).get('/api/v1/committees/standing').query({ chamber: 'house' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockCommittees });
      expect(committeeService.getStandingCommittees).toHaveBeenCalledWith('house');
    });

    it('returns 200 with standing committees for senate', async () => {
      const mockCommittees = [
        {
          id: 'SSAF',
          name: 'Senate Committee on Armed Services',
          chamber: 'senate',
          type: 'standing',
        },
      ];

      vi.mocked(committeeService.getStandingCommittees).mockResolvedValue(
        mockCommittees as unknown as Awaited<ReturnType<typeof committeeService.getStandingCommittees>>
      );

      const response = await request(app).get('/api/v1/committees/standing').query({ chamber: 'senate' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockCommittees });
      expect(committeeService.getStandingCommittees).toHaveBeenCalledWith('senate');
    });

    it('returns 200 when chamber parameter omitted (optional)', async () => {
      const mockCommittees = [
        { id: 'HSAG', name: 'House Committee on Agriculture', chamber: 'house', type: 'standing' },
      ];

      vi.mocked(committeeService.getStandingCommittees).mockResolvedValue(
        mockCommittees as unknown as Awaited<ReturnType<typeof committeeService.getStandingCommittees>>
      );

      const response = await request(app).get('/api/v1/committees/standing');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockCommittees });
      expect(committeeService.getStandingCommittees).toHaveBeenCalledWith(undefined);
    });

    it('returns 400 for invalid chamber value', async () => {
      const response = await request(app).get('/api/v1/committees/standing').query({ chamber: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/committees/:id', () => {
    const validCommitteeId = 'HSAG';

    it('returns 200 with committee details for valid ID', async () => {
      const mockCommittee = {
        id: validCommitteeId,
        name: 'House Committee on Agriculture',
        chamber: 'house',
        type: 'standing',
        jurisdiction: 'Agriculture and rural development',
        subcommittees: [
          {
            id: 'HSAG01',
            name: 'Subcommittee on Livestock',
          },
        ],
        members: [
          {
            id: 'L000001',
            fullName: 'John Doe',
            party: 'democrat',
            state: 'CA',
            role: 'chair',
          },
        ],
      };

      vi.mocked(committeeService.getById).mockResolvedValue(
        mockCommittee as unknown as Awaited<ReturnType<typeof committeeService.getById>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCommittee);
      expect(committeeService.getById).toHaveBeenCalledWith(validCommitteeId);
    });

    it('returns 404 when committee not found', async () => {
      vi.mocked(committeeService.getById).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof committeeService.getById>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Committee not found');
    });

    it('returns 400 for invalid committee ID format', async () => {
      const response = await request(app).get('/api/v1/committees/invalid@id!');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/committees/:id/subcommittees', () => {
    const validCommitteeId = 'HSAG';

    it('returns 200 with subcommittees list', async () => {
      const mockSubcommittees = [
        {
          id: 'HSAG01',
          name: 'Subcommittee on Livestock',
        },
        {
          id: 'HSAG02',
          name: 'Subcommittee on Nutrition',
        },
      ];

      vi.mocked(committeeService.getSubcommittees).mockResolvedValue(
        mockSubcommittees as unknown as Awaited<ReturnType<typeof committeeService.getSubcommittees>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/subcommittees`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockSubcommittees });
      expect(committeeService.getSubcommittees).toHaveBeenCalledWith(validCommitteeId);
    });

    it('returns empty array when committee has no subcommittees', async () => {
      vi.mocked(committeeService.getSubcommittees).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof committeeService.getSubcommittees>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/subcommittees`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [] });
    });
  });

  describe('GET /api/v1/committees/:id/members', () => {
    const validCommitteeId = 'HSAG';

    it('returns 200 with committee members (current only)', async () => {
      const mockMembers = [
        {
          id: 'L000001',
          fullName: 'John Doe',
          party: 'democrat',
          state: 'CA',
          role: 'chair',
        },
        {
          id: 'L000002',
          fullName: 'Jane Smith',
          party: 'republican',
          state: 'TX',
          role: 'member',
        },
      ];

      vi.mocked(committeeService.getMembers).mockResolvedValue(
        mockMembers as unknown as Awaited<ReturnType<typeof committeeService.getMembers>>
      );

      // Do not send includeHistorical to get default (false).
      // Note: z.coerce.boolean() converts string "false" to true (Boolean("false") === true).
      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/members`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockMembers });
      expect(committeeService.getMembers).toHaveBeenCalledWith(validCommitteeId, false);
    });

    it('returns 200 with committee members (including historical)', async () => {
      const mockMembers = [
        {
          id: 'L000001',
          fullName: 'John Doe',
          party: 'democrat',
          state: 'CA',
          role: 'chair',
        },
        {
          id: 'L000003',
          fullName: 'Bob Johnson',
          party: 'democrat',
          state: 'NY',
          role: 'former member',
        },
      ];

      vi.mocked(committeeService.getMembers).mockResolvedValue(
        mockMembers as unknown as Awaited<ReturnType<typeof committeeService.getMembers>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/members`).query({
        includeHistorical: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockMembers });
      expect(committeeService.getMembers).toHaveBeenCalledWith(validCommitteeId, true);
    });

    it('defaults to current members when includeHistorical not provided', async () => {
      vi.mocked(committeeService.getMembers).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof committeeService.getMembers>>
      );

      await request(app).get(`/api/v1/committees/${validCommitteeId}/members`);

      expect(committeeService.getMembers).toHaveBeenCalledWith(validCommitteeId, false);
    });
  });

  describe('GET /api/v1/committees/:id/bills', () => {
    const validCommitteeId = 'HSAG';

    it('returns 200 with bills referred to committee', async () => {
      const mockResponse = {
        data: [
          {
            id: 'hr-1234-118',
            title: 'Farm Bill Act',
            billType: 'hr',
            status: 'in_committee',
            introducedDate: '2023-01-15T00:00:00.000Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(committeeService.getReferredBills).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof committeeService.getReferredBills>>
      );

      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/bills`).query({
        limit: 20,
        offset: 0,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(committeeService.getReferredBills).toHaveBeenCalledWith(validCommitteeId, 20, 0);
    });

    it('uses default pagination when not provided', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      };

      vi.mocked(committeeService.getReferredBills).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof committeeService.getReferredBills>>
      );

      await request(app).get(`/api/v1/committees/${validCommitteeId}/bills`);

      expect(committeeService.getReferredBills).toHaveBeenCalledWith(validCommitteeId, 20, 0);
    });

    it('returns 400 for invalid pagination parameters', async () => {
      const response = await request(app).get(`/api/v1/committees/${validCommitteeId}/bills`).query({
        limit: -1, // Invalid: negative limit
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
