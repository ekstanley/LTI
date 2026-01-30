/**
 * useCsrf Hook Tests
 * @module hooks/__tests__/useCsrf.test
 *
 * Tests the useCsrf React hook for CSRF token management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCsrf } from '../useCsrf';
import * as api from '../../lib/api';

// Mock the API module
vi.mock('../../lib/api', () => ({
  fetchCsrfToken: vi.fn(),
  getCsrfToken: vi.fn(),
  clearCsrfToken: vi.fn(),
}));

describe('useCsrf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with token from getCsrfToken', () => {
      const existingToken = 'existing-token-123';
      vi.mocked(api.getCsrfToken).mockReturnValue(existingToken);

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBe(existingToken);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(api.getCsrfToken).toHaveBeenCalledTimes(1);
    });

    it('should initialize with null token if none exists', () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should fetch and set new CSRF token', async () => {
      const newToken = 'new-token-456';
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockResolvedValue(newToken);

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBeNull();

      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.token).toBe(newToken);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(api.fetchCsrfToken).toHaveBeenCalledTimes(1);
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('token'), 100))
      );

      const { result } = renderHook(() => useCsrf());

      const refreshPromise = result.current.refresh();

      // Check loading state immediately after calling refresh
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await refreshPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch errors and set error state', async () => {
      const errorMessage = 'Failed to fetch CSRF token';
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCsrf());

      await expect(result.current.refresh()).rejects.toThrow(errorMessage);

      await waitFor(() => {
        expect(result.current.token).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe(errorMessage);
      });
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockRejectedValue('string error');

      const { result } = renderHook(() => useCsrf());

      await expect(result.current.refresh()).rejects.toThrow('Failed to fetch CSRF token');

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Failed to fetch CSRF token');
      });
    });

    it('should clear previous error on successful refresh', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success-token');

      const { result } = renderHook(() => useCsrf());

      // First call fails
      await expect(result.current.refresh()).rejects.toThrow('First error');

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Second call succeeds and clears error
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.token).toBe('success-token');
        expect(result.current.error).toBeNull();
      });
    });

    it('should set isLoading to false even if fetch fails', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCsrf());

      await expect(result.current.refresh()).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('clear()', () => {
    it('should clear token and call clearCsrfToken', () => {
      const existingToken = 'existing-token-789';
      vi.mocked(api.getCsrfToken).mockReturnValue(existingToken);

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBe(existingToken);

      act(() => {
        result.current.clear();
      });

      expect(result.current.token).toBeNull();
      expect(api.clearCsrfToken).toHaveBeenCalledTimes(1);
    });

    it('should clear error state', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockRejectedValue(new Error('Fetch error'));

      const { result } = renderHook(() => useCsrf());

      // Create an error state
      await expect(result.current.refresh()).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Clear should remove error
      act(() => {
        result.current.clear();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.token).toBeNull();
    });

    it('should handle clearing when token is already null', () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBeNull();

      act(() => {
        result.current.clear();
      });

      expect(result.current.token).toBeNull();
      expect(api.clearCsrfToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hook Stability', () => {
    it('should maintain stable refresh function reference', () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);

      const { result, rerender } = renderHook(() => useCsrf());

      const firstRefresh = result.current.refresh;

      rerender();

      const secondRefresh = result.current.refresh;

      expect(firstRefresh).toBe(secondRefresh);
    });

    it('should maintain stable clear function reference', () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);

      const { result, rerender } = renderHook(() => useCsrf());

      const firstClear = result.current.clear;

      rerender();

      const secondClear = result.current.clear;

      expect(firstClear).toBe(secondClear);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical authentication flow', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue(null);
      vi.mocked(api.fetchCsrfToken).mockResolvedValue('auth-token-123');

      const { result } = renderHook(() => useCsrf());

      // Initial state: no token
      expect(result.current.token).toBeNull();

      // User logs in, fetch token
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.token).toBe('auth-token-123');
      });

      // User logs out, clear token
      act(() => {
        result.current.clear();
      });

      expect(result.current.token).toBeNull();
      expect(api.clearCsrfToken).toHaveBeenCalled();
    });

    it('should handle token refresh after initial fetch', async () => {
      vi.mocked(api.getCsrfToken).mockReturnValue('initial-token');
      vi.mocked(api.fetchCsrfToken).mockResolvedValue('refreshed-token');

      const { result } = renderHook(() => useCsrf());

      expect(result.current.token).toBe('initial-token');

      // Refresh to get new token
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.token).toBe('refreshed-token');
      });
    });
  });
});
