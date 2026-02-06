/**
 * Bills Routes Integration Tests
 *
 * Tests API endpoints for bill operations.
 * Mocks service layer to isolate route behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the service before importing routes
vi.mock('../../services/index.js', () => ({
  billService: {
    list: vi.fn(),
    getById: vi.fn(),
    getSponsors: vi.fn(),
    getCosponsors: vi.fn(),
    getActions: vi.fn(),
    getTextVersions: vi.fn(),
    getRelatedBills: vi.fn(),
  },
}));

// Import after mocking
import { billsRouter } from '../../routes/bills.js';
import { billService } from '../../services/index.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with bills router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/bills', billsRouter);
  app.use(errorHandler);
  return app;
}

describe('Bills Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/v1/bills', () => {
    it('returns 200 with paginated bills list', async () => {
      const mockResponse = {
        data: [
          {
            id: 'hr-1234-118',
            billType: 'hr',
            billNumber: 1234,
            congressNumber: 118,
            title: 'Test Bill Act',
            status: 'introduced',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(billService.list).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof billService.list>>
      );

      const response = await request(app).get('/api/v1/bills').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(billService.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
    });

    it('forwards filter parameters to service', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      };

      vi.mocked(billService.list).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof billService.list>>
      );

      await request(app).get('/api/v1/bills').query({
        congressNumber: 118,
        billType: 'hr',
        status: 'passed_house',
        chamber: 'house',
        limit: 10,
        offset: 0,
      });

      expect(billService.list).toHaveBeenCalledWith({
        congressNumber: 118,
        billType: 'hr',
        status: 'passed_house',
        chamber: 'house',
        limit: 10,
        offset: 0,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const response = await request(app).get('/api/v1/bills').query({
        limit: -1, // Invalid: negative limit
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'limit',
            message: expect.stringContaining('must be') as string,
          }),
        ])
      );
    });

    it('returns 500 when service throws error', async () => {
      vi.mocked(billService.list).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/v1/bills').query({ limit: 20, offset: 0 });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/v1/bills/:id', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with bill details for valid ID', async () => {
      const mockBill = {
        id: validBillId,
        billType: 'hr',
        billNumber: 1234,
        congressNumber: 118,
        title: 'Test Bill Act',
        status: 'introduced',
        introducedDate: '2023-01-15T00:00:00.000Z',
      };

      vi.mocked(billService.getById).mockResolvedValue(
        mockBill as unknown as Awaited<ReturnType<typeof billService.getById>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBill);
      expect(billService.getById).toHaveBeenCalledWith(validBillId);
    });

    it('returns 404 when bill not found', async () => {
      vi.mocked(billService.getById).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof billService.getById>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Bill not found');
    });

    it('returns 400 for invalid bill ID format', async () => {
      const response = await request(app).get('/api/v1/bills/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FORMAT');
    });
  });

  describe('GET /api/v1/bills/:id/sponsors', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with sponsors list', async () => {
      const mockSponsors = [
        {
          id: 'L000001',
          fullName: 'John Doe',
          party: 'democrat',
          state: 'CA',
          isPrimarySponsor: true,
        },
        {
          id: 'L000002',
          fullName: 'Jane Smith',
          party: 'republican',
          state: 'TX',
          isPrimarySponsor: false,
        },
      ];

      vi.mocked(billService.getSponsors).mockResolvedValue(
        mockSponsors as unknown as Awaited<ReturnType<typeof billService.getSponsors>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/sponsors`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockSponsors });
      expect(billService.getSponsors).toHaveBeenCalledWith(validBillId);
    });

    it('returns empty array when no sponsors found', async () => {
      vi.mocked(billService.getSponsors).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof billService.getSponsors>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/sponsors`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [] });
    });
  });

  describe('GET /api/v1/bills/:id/cosponsors', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with cosponsors list', async () => {
      const mockCosponsors = [
        {
          id: 'L000002',
          fullName: 'Jane Smith',
          party: 'republican',
          state: 'TX',
        },
      ];

      vi.mocked(billService.getCosponsors).mockResolvedValue(
        mockCosponsors as unknown as Awaited<ReturnType<typeof billService.getCosponsors>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/cosponsors`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockCosponsors });
      expect(billService.getCosponsors).toHaveBeenCalledWith(validBillId);
    });
  });

  describe('GET /api/v1/bills/:id/actions', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with bill actions', async () => {
      const mockActions = [
        {
          id: 'action-1',
          actionDate: '2023-01-15T00:00:00.000Z',
          actionType: 'IntroReferral',
          description: 'Introduced in House',
        },
      ];

      vi.mocked(billService.getActions).mockResolvedValue(
        mockActions as unknown as Awaited<ReturnType<typeof billService.getActions>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/actions`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockActions });
      expect(billService.getActions).toHaveBeenCalledWith(validBillId);
    });
  });

  describe('GET /api/v1/bills/:id/text', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with bill text versions', async () => {
      const mockTextVersions = [
        {
          id: 'text-1',
          type: 'Introduced',
          date: '2023-01-15T00:00:00.000Z',
          url: 'https://example.com/text.pdf',
        },
      ];

      vi.mocked(billService.getTextVersions).mockResolvedValue(
        mockTextVersions as unknown as Awaited<ReturnType<typeof billService.getTextVersions>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/text`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockTextVersions });
      expect(billService.getTextVersions).toHaveBeenCalledWith(validBillId);
    });
  });

  describe('GET /api/v1/bills/:id/related', () => {
    const validBillId = 'hr-1234-118';

    it('returns 200 with related bills', async () => {
      const mockRelatedBills = [
        {
          id: 'hr-5678-118',
          title: 'Related Bill',
          relationshipType: 'identical',
        },
      ];

      vi.mocked(billService.getRelatedBills).mockResolvedValue(
        mockRelatedBills as unknown as Awaited<ReturnType<typeof billService.getRelatedBills>>
      );

      const response = await request(app).get(`/api/v1/bills/${validBillId}/related`).query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockRelatedBills });
      expect(billService.getRelatedBills).toHaveBeenCalledWith(validBillId, 10);
    });

    it('uses default limit when not provided', async () => {
      vi.mocked(billService.getRelatedBills).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof billService.getRelatedBills>>
      );

      await request(app).get(`/api/v1/bills/${validBillId}/related`);

      // Check that default limit (10) is used
      expect(billService.getRelatedBills).toHaveBeenCalledWith(validBillId, 10);
    });

    it('returns 400 for invalid limit parameter', async () => {
      const response = await request(app).get(`/api/v1/bills/${validBillId}/related`).query({
        limit: 999, // Exceeds maximum
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
