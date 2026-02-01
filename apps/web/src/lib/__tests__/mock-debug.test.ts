/**
 * Diagnostic test to debug fetch mocking issue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getBill, ApiError } from '../api';

describe('Mock Debugging', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.restoreAllMocks();
  });

  it('should verify global.fetch mock works', async () => {
    // Mock fetch with a simple response (handles retries)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
      json: async () => ({
        code: 'DATABASE_ERROR',
        message: 'Original backend message with secrets',
      }),
    });

    global.fetch = mockFetch;

    try {
      await getBill('test-id');
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      // Verify the mock was called
      expect(mockFetch).toHaveBeenCalled();
      console.log('Mock called with:', mockFetch.mock.calls[0]);

      // Verify error is ApiError
      expect(error).toBeInstanceOf(ApiError);

      // Verify error message is sanitized
      expect(error.message).toBe('A database error occurred. Please try again.');
    }
  }, 10000); // 10 second timeout for debugging
});
