/**
 * Bill Service Unit Tests
 *
 * Tests business logic layer for bill operations.
 * Mocks repository layer to isolate service behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { billService } from '../../services/bill.service.js';
import { billRepository } from '../../repositories/bill.repository.js';
import type { BillSummary, BillWithRelations } from '../../repositories/bill.repository.js';

// Mock the repository module
vi.mock('../../repositories/bill.repository.js', () => ({
  billRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    search: vi.fn(),
    getActions: vi.fn(),
    getTextVersions: vi.fn(),
  },
}));

describe('BillService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    // Mock BillSummary matching the Prisma select type
    const mockBillSummary: BillSummary = {
      id: 'hr-1234-118',
      billType: 'HR',
      billNumber: 1234,
      congressNumber: 118,
      title: 'Test Bill Act',
      shortTitle: 'Test Bill',
      introducedDate: new Date('2023-01-15'),
      status: 'INTRODUCED',
      lastActionDate: new Date('2023-01-20'),
      sponsorCount: 5,
      cosponsorsD: 3,
      cosponsorsR: 1,
      cosponsorsI: 0,
    };

    it('returns paginated bill summaries with correct format', async () => {
      const mockRepoResult = {
        data: [mockBillSummary],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(billRepository.findMany).mockResolvedValue(mockRepoResult);

      const result = await billService.list({ limit: 20, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    });

    it('transforms bill data to API format', async () => {
      const mockRepoResult = {
        data: [mockBillSummary],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(billRepository.findMany).mockResolvedValue(mockRepoResult);

      const result = await billService.list({ limit: 20, offset: 0 });
      const bill = result.data[0];

      // Verify API format transformations
      expect(bill).toBeDefined();
      expect(bill!.id).toBe('hr-1234-118');
      expect(bill!.billType).toBe('hr'); // lowercase
      expect(bill!.billNumber).toBe(1234);
      expect(bill!.congressNumber).toBe(118);
      expect(bill!.title).toBe('Test Bill Act');
    });

    it('uses search endpoint when search param provided', async () => {
      const mockSearchResult = {
        data: [{ ...mockBillSummary, rank: 0.95 }],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(billRepository.search).mockResolvedValue(mockSearchResult);

      await billService.list({ limit: 20, offset: 0, search: 'healthcare' });

      expect(billRepository.search).toHaveBeenCalledWith(
        'healthcare',
        expect.objectContaining({ page: 1, limit: 20 })
      );
      expect(billRepository.findMany).not.toHaveBeenCalled();
    });

    it('converts API chamber filter to bill types', async () => {
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

      vi.mocked(billRepository.findMany).mockResolvedValue(mockRepoResult);

      await billService.list({ limit: 20, offset: 0, chamber: 'house' });

      expect(billRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          billType: ['HR', 'HRES', 'HJRES', 'HCONRES'],
        }),
        expect.any(Object)
      );
    });

    it('applies congress number filter', async () => {
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

      vi.mocked(billRepository.findMany).mockResolvedValue(mockRepoResult);

      await billService.list({ limit: 20, offset: 0, congressNumber: 118 });

      expect(billRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ congressNumber: 118 }),
        expect.any(Object)
      );
    });

    it('calculates hasMore correctly when more results exist', async () => {
      const mockRepoResult = {
        data: [mockBillSummary],
        pagination: {
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      };

      vi.mocked(billRepository.findMany).mockResolvedValue(mockRepoResult);

      const result = await billService.list({ limit: 20, offset: 0 });

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.total).toBe(100);
    });
  });

  describe('getById', () => {
    const mockBillWithRelations = {
      id: 'hr-1234-118',
      billType: 'HR',
      billNumber: 1234,
      congressNumber: 118,
      title: 'Test Bill Act',
      shortTitle: 'Test Bill',
      introducedDate: new Date('2023-01-15'),
      status: 'INTRODUCED',
      summary: 'This bill does testing things.',
      fullTextUrl: 'https://congress.gov/bill/118th/hr/1234/text',
      pdfUrl: null,
      createdAt: new Date('2023-01-15'),
      updatedAt: new Date('2023-01-20'),
      policyArea: {
        id: 'pa-1',
        name: 'Economics',
      },
      subjects: [],
      sponsors: [
        {
          id: 'sp-1',
          isPrimary: true,
          cosponsorDate: null,
          legislator: {
            id: 'A000001',
            firstName: 'John',
            lastName: 'Smith',
            fullName: 'John Smith',
            party: 'D',
            chamber: 'HOUSE',
            state: 'CA',
            district: 12,
            termStart: new Date('2023-01-03'),
            termEnd: new Date('2025-01-03'),
            inOffice: true,
          },
        },
      ],
      actions: [],
      textVersions: [],
      committees: [],
    } as unknown as BillWithRelations;

    it('returns mapped bill when found', async () => {
      vi.mocked(billRepository.findById).mockResolvedValue(mockBillWithRelations);

      const result = await billService.getById('hr-1234-118');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('hr-1234-118');
      expect(result!.billType).toBe('hr');
    });

    it('returns null when bill not found', async () => {
      vi.mocked(billRepository.findById).mockResolvedValue(null);

      const result = await billService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getActions', () => {
    it('delegates to repository', async () => {
      const mockActions = [
        {
          id: 'act-1',
          billId: 'hr-1234-118',
          actionDate: new Date('2023-01-20'),
          actionCode: 'H11000',
          actionText: 'Introduced in House',
          chamber: 'HOUSE' as const,
          committeeId: null,
          committee: null,
        },
      ];

      vi.mocked(billRepository.getActions).mockResolvedValue(mockActions);

      const result = await billService.getActions('hr-1234-118');

      expect(billRepository.getActions).toHaveBeenCalledWith('hr-1234-118');
      expect(result).toEqual(mockActions);
    });
  });

  describe('getTextVersions', () => {
    it('delegates to repository', async () => {
      const mockVersions = [
        {
          id: 'tv-1',
          billId: 'hr-1234-118',
          versionCode: 'IH',
          versionName: 'Introduced in House',
          textUrl: 'https://congress.gov/bill/118th/hr/1234/text/ih',
          textHash: 'sha256:abc123',
          textFormat: 'HTML' as const,
          pageCount: null,
          wordCount: null,
          publishedDate: new Date('2023-01-15'),
        },
      ];

      vi.mocked(billRepository.getTextVersions).mockResolvedValue(mockVersions);

      const result = await billService.getTextVersions('hr-1234-118');

      expect(billRepository.getTextVersions).toHaveBeenCalledWith('hr-1234-118');
      expect(result).toEqual(mockVersions);
    });
  });

  describe('getCosponsors', () => {
    it('returns non-primary sponsors mapped to API format', async () => {
      const mockBill = {
        id: 'hr-1234-118',
        billType: 'HR',
        billNumber: 1234,
        congressNumber: 118,
        title: 'Test Bill',
        shortTitle: 'Test',
        introducedDate: new Date('2023-01-15'),
        status: 'INTRODUCED',
        summary: null,
        fullTextUrl: null,
        pdfUrl: null,
        policyArea: null,
        subjects: [],
        sponsors: [
          {
            id: 'sp-1',
            isPrimary: true,
            cosponsorDate: null,
            legislator: {
              id: 'A000001',
              fullName: 'John Smith',
              party: 'D',
              chamber: 'HOUSE',
              state: 'CA',
              district: 12,
            },
          },
          {
            id: 'sp-2',
            isPrimary: false,
            cosponsorDate: new Date('2023-02-01'),
            legislator: {
              id: 'B000002',
              fullName: 'Jane Doe',
              party: 'R',
              chamber: 'HOUSE',
              state: 'TX',
              district: 5,
            },
          },
        ],
        actions: [],
        textVersions: [],
        committees: [],
      } as unknown as BillWithRelations;

      vi.mocked(billRepository.findById).mockResolvedValue(mockBill);

      const result = await billService.getCosponsors('hr-1234-118');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'B000002',
        fullName: 'Jane Doe',
        party: 'R',
        state: 'TX',
        chamber: 'house',
        cosponsorDate: '2023-02-01T00:00:00.000Z',
      });
    });

    it('returns empty array when bill not found', async () => {
      vi.mocked(billRepository.findById).mockResolvedValue(null);

      const result = await billService.getCosponsors('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
