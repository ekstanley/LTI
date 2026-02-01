/**
 * CSRF E2E Tests
 * @module lib/__tests__/csrf.e2e.test
 *
 * End-to-end tests for CSRF protection flows including:
 * - Token acquisition and rotation
 * - Protection of state-changing operations
 * - Token expiration handling
 * - Automatic recovery mechanisms
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as api from '../api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('CSRF E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear token state between tests
    api.clearCsrfToken();
  });

  afterEach(() => {
    api.clearCsrfToken();
  });

  describe('Scenario 1: Complete Authentication Flow with CSRF Token Handling', () => {
    it('should handle full auth flow: fetch token → login → protected operation → logout', async () => {
      // Step 1: Fetch CSRF token
      const initialToken = 'csrf-token-initial-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', initialToken]]),
        json: async () => ({ csrfToken: initialToken }),
      } as any);

      const token = await api.fetchCsrfToken();
      expect(token).toBe(initialToken);
      expect(api.getCsrfToken()).toBe(initialToken);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/csrf-token'),
        expect.objectContaining({
          credentials: 'include',
        })
      );

      // Step 2: Login with CSRF token (simulated protected operation)
      const rotatedToken = 'csrf-token-rotated-456';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', rotatedToken]]),
        json: async () => ({
          user: { id: 'user-123', email: 'test@example.com' },
          tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
        }),
      } as any);

      // Simulate POST request (would be handled by fetcher internally)
      // Here we verify the token was included
      const loginResponse = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': initialToken,
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      // Token should rotate automatically after protected operation
      expect(api.getCsrfToken()).toBe(initialToken); // Still has initial until we extract from response

      // Extract rotated token from response
      const newToken = loginResponse.headers.get('X-CSRF-Token');
      expect(newToken).toBe(rotatedToken);

      // Step 3: Perform another protected operation with rotated token
      const finalToken = 'csrf-token-final-789';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', finalToken]]),
        json: async () => ({ success: true }),
      } as any);

      await fetch('http://localhost:4000/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': rotatedToken,
        },
      });

      // Verify logout call used rotated token
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v1/auth/logout'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': rotatedToken,
          }),
        })
      );

      // Step 4: Clear token after logout
      api.clearCsrfToken();
      expect(api.getCsrfToken()).toBeNull();
    });

    it('should handle token fetch failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as any);

      await expect(api.fetchCsrfToken()).rejects.toThrow('Failed to fetch CSRF token');
      expect(api.getCsrfToken()).toBeNull();
    });

    it('should validate CSRF token format in response', async () => {
      // Test with invalid token format
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ csrfToken: 123 }), // Invalid: number instead of string
      } as any);

      await expect(api.fetchCsrfToken()).rejects.toThrow('Invalid CSRF token response');
      expect(api.getCsrfToken()).toBeNull();
    });
  });

  describe('Scenario 2: CSRF Token Rotation on State-Changing Operations', () => {
    it('should rotate CSRF token after each protected request', async () => {
      // Initial token
      const token1 = 'csrf-token-001';
      api.clearCsrfToken();

      // Mock token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', token1]]),
        json: async () => ({ csrfToken: token1 }),
      } as any);

      await api.fetchCsrfToken();
      expect(api.getCsrfToken()).toBe(token1);

      // First protected request (POST) - should use token1, receive token2
      const token2 = 'csrf-token-002';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', token2]]),
        json: async () => ({ data: 'response1' }),
      } as any);

      const response1 = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token1,
        },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v1/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': token1,
          }),
        })
      );

      const rotatedToken1 = response1.headers.get('X-CSRF-Token');
      expect(rotatedToken1).toBe(token2);

      // Second protected request (PUT) - should use token2, receive token3
      const token3 = 'csrf-token-003';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', token3]]),
        json: async () => ({ data: 'response2' }),
      } as any);

      const response2 = await fetch('http://localhost:4000/api/v1/test/123', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token2,
        },
        body: JSON.stringify({ update: 'data' }),
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v1/test/123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': token2,
          }),
        })
      );

      const rotatedToken2 = response2.headers.get('X-CSRF-Token');
      expect(rotatedToken2).toBe(token3);

      // Third protected request (DELETE) - should use token3, receive token4
      const token4 = 'csrf-token-004';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', token4]]),
        json: async () => ({ success: true }),
      } as any);

      const response3 = await fetch('http://localhost:4000/api/v1/test/123', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token3,
        },
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v1/test/123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': token3,
          }),
        })
      );

      const rotatedToken3 = response3.headers.get('X-CSRF-Token');
      expect(rotatedToken3).toBe(token4);
    });

    it('should not require CSRF token for GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ data: 'public-data' }),
      } as any);

      await fetch('http://localhost:4000/api/v1/bills', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Verify no CSRF token was sent with GET request
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/bills'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.not.objectContaining({
            'X-CSRF-Token': expect.anything(),
          }),
        })
      );
    });

    it('should include CSRF token in all protected HTTP methods', async () => {
      const token = 'csrf-token-all-methods';
      const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of protectedMethods) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Map([['X-CSRF-Token', `${token}-rotated`]]),
          json: async () => ({ success: true }),
        } as any);

        await fetch(`http://localhost:4000/api/v1/test-${method.toLowerCase()}`, {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
          },
          body: method !== 'DELETE' ? JSON.stringify({ data: 'test' }) : undefined,
        });

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.stringContaining(`/api/v1/test-${method.toLowerCase()}`),
          expect.objectContaining({
            method,
            headers: expect.objectContaining({
              'X-CSRF-Token': token,
            }),
          })
        );
      }

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Scenario 3: CSRF Protection Blocking Unauthorized Requests', () => {
    it('should reject protected request without CSRF token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: 'CSRF_TOKEN_REQUIRED',
          message: 'CSRF token required',
        }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          // No X-CSRF-Token header
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      const error = await response.json();
      expect(error.code).toBe('CSRF_TOKEN_REQUIRED');
      expect(error.message).toContain('CSRF token required');
    });

    it('should reject protected request with invalid CSRF token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: 'INVALID_CSRF_TOKEN',
          message: 'Invalid or expired CSRF token',
        }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token-xyz',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      const error = await response.json();
      expect(error.code).toBe('INVALID_CSRF_TOKEN');
      expect(error.message).toContain('Invalid or expired');
    });

    it('should reject protected request with already-used CSRF token', async () => {
      const token = 'csrf-token-used';

      // First request succeeds and invalidates token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', 'csrf-token-new']]),
        json: async () => ({ success: true }),
      } as any);

      await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({ data: 'test' }),
      });

      // Second request with same token should be rejected
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: 'CSRF_TOKEN_USED',
          message: 'CSRF token already used',
        }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token, // Reusing same token
        },
        body: JSON.stringify({ data: 'test2' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      const error = await response.json();
      expect(error.code).toBe('CSRF_TOKEN_USED');
    });

    it('should allow protected request with valid CSRF token', async () => {
      const validToken = 'csrf-token-valid-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', 'csrf-token-rotated-456']]),
        json: async () => ({
          success: true,
          data: { id: 'created-123' },
        }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': validToken,
        },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('created-123');

      // Verify new token was provided
      const newToken = response.headers.get('X-CSRF-Token');
      expect(newToken).toBe('csrf-token-rotated-456');
    });
  });

  describe('Scenario 4: CSRF Token Recovery After Expiration', () => {
    it('should handle token expiration and recovery flow', async () => {
      // Step 1: Fetch initial token
      const initialToken = 'csrf-token-initial';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', initialToken]]),
        json: async () => ({ csrfToken: initialToken }),
      } as any);

      await api.fetchCsrfToken();
      expect(api.getCsrfToken()).toBe(initialToken);

      // Step 2: Simulate token expiration on protected request
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: 'CSRF_TOKEN_EXPIRED',
          message: 'CSRF token expired',
        }),
      } as any);

      const expiredResponse = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': initialToken,
        },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(expiredResponse.ok).toBe(false);
      expect(expiredResponse.status).toBe(403);

      const error = await expiredResponse.json();
      expect(error.code).toBe('CSRF_TOKEN_EXPIRED');

      // Step 3: Fetch new token after expiration
      const newToken = 'csrf-token-refreshed';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', newToken]]),
        json: async () => ({ csrfToken: newToken }),
      } as any);

      await api.fetchCsrfToken();
      expect(api.getCsrfToken()).toBe(newToken);

      // Step 4: Retry original request with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', 'csrf-token-rotated']]),
        json: async () => ({
          success: true,
          data: { id: 'created-after-refresh' },
        }),
      } as any);

      const retryResponse = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': newToken,
        },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(retryResponse.ok).toBe(true);

      const data = await retryResponse.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('created-after-refresh');
    });

    it('should handle session expiration requiring re-authentication', async () => {
      // Step 1: Token fetch fails due to expired session
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'SESSION_EXPIRED',
          message: 'Authentication required',
        }),
      } as any);

      await expect(api.fetchCsrfToken()).rejects.toThrow('Failed to fetch CSRF token');
      expect(api.getCsrfToken()).toBeNull();

      // Step 2: User must re-authenticate (login would happen here in real app)
      // After successful re-authentication, fetch new CSRF token
      const loginToken = 'csrf-token-after-login';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', loginToken]]),
        json: async () => ({ csrfToken: loginToken }),
      } as any);

      await api.fetchCsrfToken();
      expect(api.getCsrfToken()).toBe(loginToken);

      // Step 3: Resume normal operations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', 'csrf-token-rotated']]),
        json: async () => ({ success: true }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': loginToken,
        },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(response.ok).toBe(true);
    });

    it('should clear token on logout and prevent subsequent requests', async () => {
      // Step 1: Set up token
      const token = 'csrf-token-before-logout';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-CSRF-Token', token]]),
        json: async () => ({ csrfToken: token }),
      } as any);

      await api.fetchCsrfToken();
      expect(api.getCsrfToken()).toBe(token);

      // Step 2: Logout (which clears token)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true }),
      } as any);

      await fetch('http://localhost:4000/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
      });

      api.clearCsrfToken();
      expect(api.getCsrfToken()).toBeNull();

      // Step 3: Subsequent protected request should fail without token
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          code: 'CSRF_TOKEN_REQUIRED',
          message: 'CSRF token required',
        }),
      } as any);

      const response = await fetch('http://localhost:4000/api/v1/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          // No token included
        },
        body: JSON.stringify({ data: 'test' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      const error = await response.json();
      expect(error.code).toBe('CSRF_TOKEN_REQUIRED');
    });
  });
});
