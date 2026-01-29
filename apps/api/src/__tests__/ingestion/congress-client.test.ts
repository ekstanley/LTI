/**
 * Congress.gov API Client Unit Tests
 *
 * Tests for the Congress.gov API client with mocked fetch and rate limiter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CongressApiClient,
  CongressApiError,
  getCongressClient,
  resetCongressClient,
} from '../../ingestion/congress-client.js';

// Mock the rate limiter
vi.mock('../../ingestion/rate-limiter.js', async () => {
  const actual = await vi.importActual('../../ingestion/rate-limiter.js');
  return {
    ...actual,
    getCongressApiLimiter: vi.fn(() => ({
      acquire: vi.fn().mockResolvedValue(undefined),
      tryAcquire: vi.fn().mockReturnValue(true),
      getStats: vi.fn().mockReturnValue({
        currentTokens: 100,
        maxTokens: 100,
        refillRatePerHour: 1000,
        requestsThisHour: 0,
        waitingRequests: 0,
      }),
    })),
    resetCongressApiLimiter: vi.fn(),
  };
});

describe('CongressApiClient', () => {
  const originalFetch = globalThis.fetch;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    resetCongressClient();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates client with API key', () => {
      const client = new CongressApiClient({ apiKey: mockApiKey });
      expect(client).toBeInstanceOf(CongressApiClient);
    });

    it('creates client without API key (uses config fallback)', () => {
      // Client should not throw - API key can come from config
      const client = new CongressApiClient({});
      expect(client).toBeInstanceOf(CongressApiClient);
    });
  });

  describe('getBills', () => {
    it('fetches bills for a congress', async () => {
      const mockResponse = {
        bills: [
          {
            congress: 118,
            type: 'hr',
            number: 1,
            originChamber: 'House',
            title: 'Test Bill',
            updateDate: '2024-01-01',
            url: 'https://api.congress.gov/v3/bill/118/hr/1',
          },
        ],
        pagination: {
          count: 1,
          next: null,
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const { bills } = await client.getBills(118);

      expect(bills).toHaveLength(1);
      expect(bills[0]?.title).toBe('Test Bill');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bill/118'),
        expect.any(Object)
      );
    });

    it('handles pagination parameters', async () => {
      const mockResponse = {
        bills: [],
        pagination: { count: 0, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      await client.getBills(118, { limit: 50 });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/limit=50/),
        expect.any(Object)
      );
    });

    it('filters by bill type', async () => {
      const mockResponse = {
        bills: [],
        pagination: { count: 0, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      await client.getBills(118, { type: 'hr' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bill/118/hr'),
        expect.any(Object)
      );
    });

    it('throws CongressApiError on API error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: { message: 'Not found' } }),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });

      await expect(client.getBills(999)).rejects.toThrow(CongressApiError);
    });

    it('returns next offset for pagination', async () => {
      const mockResponse = {
        bills: [
          {
            congress: 118,
            type: 'hr',
            number: 1,
            title: 'Bill 1',
            url: 'https://api.congress.gov/v3/bill/118/hr/1',
            updateDate: '2024-01-01',
          },
        ],
        pagination: {
          count: 2,
          next: 'https://api.congress.gov/v3/bill?offset=1',
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const { bills, nextOffset } = await client.getBills(118);

      expect(bills).toHaveLength(1);
      expect(nextOffset).toBe(20); // Default limit is 20
    });
  });

  describe('listBills', () => {
    it('iterates through all bills with auto-pagination', async () => {
      const mockPage1 = {
        bills: [
          {
            congress: 118,
            type: 'hr',
            number: 1,
            title: 'Bill 1',
            url: 'https://api.congress.gov/v3/bill/118/hr/1',
            updateDate: '2024-01-01',
          },
        ],
        pagination: {
          count: 2,
          next: 'https://api.congress.gov/v3/bill?offset=250',
        },
      };

      const mockPage2 = {
        bills: [
          {
            congress: 118,
            type: 'hr',
            number: 2,
            title: 'Bill 2',
            url: 'https://api.congress.gov/v3/bill/118/hr/2',
            updateDate: '2024-01-02',
          },
        ],
        pagination: {
          count: 2,
          next: null,
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage1),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage2),
        } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const bills: unknown[] = [];

      for await (const bill of client.listBills(118)) {
        bills.push(bill);
      }

      expect(bills).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBillDetail', () => {
    it('fetches bill details', async () => {
      const mockResponse = {
        bill: {
          congress: 118,
          type: 'hr',
          number: 1234,
          originChamber: 'House',
          title: 'Test Bill',
          introducedDate: '2024-01-01',
          updateDate: '2024-01-15',
          sponsors: [],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.getBillDetail(118, 'hr', 1234);

      expect(result.congress).toBe(118);
      expect(result.number).toBe(1234);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bill/118/hr/1234'),
        expect.any(Object)
      );
    });
  });

  describe('getBillActions', () => {
    it('fetches bill actions', async () => {
      const mockResponse = {
        actions: [
          {
            actionDate: '2024-01-15',
            text: 'Introduced in House',
            type: 'IntroReferral',
            actionCode: '1000',
            sourceSystem: { code: 9, name: 'Library of Congress' },
          },
        ],
        pagination: { count: 1, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.getBillActions(118, 'hr', 1234);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.text).toBe('Introduced in House');
    });
  });

  describe('getBillCosponsors', () => {
    it('fetches bill cosponsors', async () => {
      const mockResponse = {
        cosponsors: [
          {
            bioguideId: 'A000001',
            fullName: 'Rep. Test',
            firstName: 'Test',
            lastName: 'Rep',
            party: 'D',
            state: 'CA',
            sponsorshipDate: '2024-01-05',
            isOriginalCosponsor: true,
          },
        ],
        pagination: { count: 1, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.getBillCosponsors(118, 'hr', 1234);

      expect(result.cosponsors).toHaveLength(1);
      expect(result.cosponsors[0]?.bioguideId).toBe('A000001');
    });
  });

  describe('getBillTextVersions', () => {
    it('fetches bill text versions', async () => {
      const mockResponse = {
        textVersions: [
          {
            date: '2024-01-01',
            type: 'Introduced in House',
            url: 'https://...',
            formats: [],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.getBillTextVersions(118, 'hr', 1234);

      expect(result).toHaveLength(1);
    });
  });

  describe('getMembers', () => {
    it('fetches members', async () => {
      const mockResponse = {
        members: [
          {
            bioguideId: 'A000001',
            name: 'Test Member',
            partyName: 'Democratic',
            state: 'California',
            updateDate: '2024-01-01',
            url: 'https://api.congress.gov/v3/member/A000001',
          },
        ],
        pagination: { count: 1, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const { members } = await client.getMembers();

      expect(members).toHaveLength(1);
      expect(members[0]?.bioguideId).toBe('A000001');
    });
  });

  describe('listMembers', () => {
    it('iterates through all members with auto-pagination', async () => {
      const mockPage1 = {
        members: [
          {
            bioguideId: 'A000001',
            name: 'Test Member 1',
            partyName: 'Democratic',
            state: 'California',
            updateDate: '2024-01-01',
            url: 'https://api.congress.gov/v3/member/A000001',
          },
        ],
        pagination: { count: 2, next: 'https://api.congress.gov/v3/member?offset=250' },
      };

      const mockPage2 = {
        members: [
          {
            bioguideId: 'A000002',
            name: 'Test Member 2',
            partyName: 'Republican',
            state: 'Texas',
            updateDate: '2024-01-02',
            url: 'https://api.congress.gov/v3/member/A000002',
          },
        ],
        pagination: { count: 2, next: null },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage1),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage2),
        } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const members: unknown[] = [];

      for await (const member of client.listMembers()) {
        members.push(member);
      }

      expect(members).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMemberDetail', () => {
    it('fetches member details', async () => {
      const mockResponse = {
        member: {
          bioguideId: 'A000001',
          firstName: 'Test',
          lastName: 'Member',
          directOrderName: 'Test Member',
          partyHistory: [{ partyName: 'Democratic', partyAbbreviation: 'D', startYear: 2021 }],
          state: 'California',
          terms: [],
          updateDate: '2024-01-01',
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.getMemberDetail('A000001');

      expect(result.bioguideId).toBe('A000001');
      expect(result.firstName).toBe('Test');
    });
  });

  describe('getCommittees', () => {
    it('fetches committees', async () => {
      const mockResponse = {
        committees: [
          {
            systemCode: 'hsag00',
            name: 'Agriculture',
            chamber: 'House',
            committeeTypeCode: 'Standing',
            parent: null,
            updateDate: '2024-01-01',
            url: 'https://api.congress.gov/v3/committee/house/hsag00',
          },
        ],
        pagination: { count: 1, next: null },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const { committees } = await client.getCommittees();

      expect(committees).toHaveLength(1);
      expect(committees[0]?.systemCode).toBe('hsag00');
    });
  });

  describe('listCommittees', () => {
    it('iterates through all committees with auto-pagination', async () => {
      const mockPage1 = {
        committees: [
          {
            systemCode: 'hsag00',
            name: 'Agriculture',
            chamber: 'House',
            committeeTypeCode: 'Standing',
            parent: null,
            updateDate: '2024-01-01',
            url: 'https://api.congress.gov/v3/committee/house/hsag00',
          },
        ],
        pagination: { count: 2, next: 'https://api.congress.gov/v3/committee?offset=250' },
      };

      const mockPage2 = {
        committees: [
          {
            systemCode: 'ssju00',
            name: 'Judiciary',
            chamber: 'Senate',
            committeeTypeCode: 'Standing',
            parent: null,
            updateDate: '2024-01-02',
            url: 'https://api.congress.gov/v3/committee/senate/ssju00',
          },
        ],
        pagination: { count: 2, next: null },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage1),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPage2),
        } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const committees: unknown[] = [];

      for await (const committee of client.listCommittees()) {
        committees.push(committee);
      }

      expect(committees).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRateLimiterStats', () => {
    it('returns rate limiter statistics', () => {
      const client = new CongressApiClient({ apiKey: mockApiKey });
      const stats = client.getRateLimiterStats();

      expect(stats).toEqual({
        currentTokens: 100,
        maxTokens: 100,
        refillRatePerHour: 1000,
        requestsThisHour: 0,
        waitingRequests: 0,
      });
    });
  });

  describe('healthCheck', () => {
    it('returns true when API responds successfully', async () => {
      // healthCheck calls getBills(118, { limit: 1 }), so we need proper response
      const mockResponse = {
        bills: [],
        pagination: { count: 0, next: null },
      };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('returns false when API fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const client = new CongressApiClient({ apiKey: mockApiKey });
      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getCongressClient singleton', () => {
    it('creates singleton instance', () => {
      resetCongressClient();
      // Client doesn't require API key - it will use config fallback or undefined
      const client1 = getCongressClient();
      const client2 = getCongressClient();
      expect(client1).toBe(client2); // Same instance
      expect(client1).toBeInstanceOf(CongressApiClient);
    });
  });

  describe('CongressApiError', () => {
    it('includes status code and endpoint', () => {
      const error = new CongressApiError('Not found', 404, '/bill/118/hr/1');

      expect(error.name).toBe('CongressApiError');
      expect(error.statusCode).toBe(404);
      expect(error.endpoint).toBe('/bill/118/hr/1');
      expect(error.message).toBe('Not found');
    });
  });
});
