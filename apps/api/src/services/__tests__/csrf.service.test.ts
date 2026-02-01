/**
 * CSRF Service Tests
 * @module services/__tests__/csrf.service.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as csrfService from '../csrf.service.js';
import * as redis from '../../db/redis.js';

// Mock dependencies
vi.mock('node:crypto');
vi.mock('../../db/redis.js');
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('CSRF Service', () => {
  const mockSessionId = 'test-session-123';
  const mockToken = 'mock-csrf-token-base64url';
  const mockCacheKey = 'session:csrf:test-session-123:mock-csrf-token-base64url';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock crypto.randomBytes to return predictable value
    vi.mocked(crypto.randomBytes).mockReturnValue(
      Buffer.from('a'.repeat(32)) as never
    );

    // Mock buildCacheKey
    vi.mocked(redis.buildCacheKey).mockReturnValue(mockCacheKey);
  });

  describe('generateCsrfToken()', () => {
    it('should generate a valid CSRF token for a session', async () => {
      vi.mocked(redis.cache.set).mockResolvedValue(undefined);

      const token = await csrfService.generateCsrfToken(mockSessionId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Verify crypto.randomBytes was called with correct length
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);

      // Verify token was stored in Redis with metadata
      expect(redis.cache.set).toHaveBeenCalledWith(
        mockCacheKey,
        expect.objectContaining({
          sessionId: mockSessionId,
          token: expect.any(String),
          createdAt: expect.any(Number),
          used: false,
        }),
        3600 // TTL
      );
    });

    it('should throw error for invalid session ID (empty string)', async () => {
      await expect(csrfService.generateCsrfToken('')).rejects.toThrow('Invalid session ID');
    });

    it('should throw error for invalid session ID (non-string)', async () => {
      // @ts-expect-error - Testing invalid input types
      await expect(csrfService.generateCsrfToken(null)).rejects.toThrow('Invalid session ID');

      // @ts-expect-error - Testing invalid input types
      await expect(csrfService.generateCsrfToken(undefined)).rejects.toThrow('Invalid session ID');

      // @ts-expect-error - Testing invalid input types
      await expect(csrfService.generateCsrfToken(123)).rejects.toThrow('Invalid session ID');
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.cache.set).mockRejectedValue(new Error('Redis connection failed'));

      await expect(csrfService.generateCsrfToken(mockSessionId)).rejects.toThrow(
        'Redis connection failed'
      );
    });

    it('should generate unique tokens on each call', async () => {
      vi.mocked(redis.cache.set).mockResolvedValue(undefined);

      // Reset mock to return different values
      let callCount = 0;
      vi.mocked(crypto.randomBytes).mockImplementation(() => {
        callCount++;
        return Buffer.from(callCount.toString().repeat(32));
      });

      const token1 = await csrfService.generateCsrfToken(mockSessionId);
      const token2 = await csrfService.generateCsrfToken(mockSessionId);

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateCsrfToken()', () => {
    const validMetadata = {
      sessionId: mockSessionId,
      token: mockToken,
      createdAt: Date.now(),
      used: false,
    };

    it('should return true for valid unused token', async () => {
      vi.mocked(redis.cache.get).mockResolvedValue(validMetadata);

      const result = await csrfService.validateCsrfToken(mockSessionId, mockToken);

      expect(result).toBe(true);
      expect(redis.buildCacheKey).toHaveBeenCalledWith(
        redis.REDIS_NAMESPACES.SESSION,
        'csrf',
        mockSessionId,
        mockToken
      );
    });

    it('should return false for missing token (not in Redis)', async () => {
      vi.mocked(redis.cache.get).mockResolvedValue(null);

      const result = await csrfService.validateCsrfToken(mockSessionId, mockToken);

      expect(result).toBe(false);
    });

    it('should return false for already used token', async () => {
      const usedMetadata = { ...validMetadata, used: true };
      vi.mocked(redis.cache.get).mockResolvedValue(usedMetadata);

      const result = await csrfService.validateCsrfToken(mockSessionId, mockToken);

      expect(result).toBe(false);
    });

    it('should return false for session mismatch', async () => {
      const mismatchedMetadata = { ...validMetadata, sessionId: 'different-session' };
      vi.mocked(redis.cache.get).mockResolvedValue(mismatchedMetadata);

      const result = await csrfService.validateCsrfToken(mockSessionId, mockToken);

      expect(result).toBe(false);
    });

    it('should return false for empty session ID', async () => {
      const result = await csrfService.validateCsrfToken('', mockToken);

      expect(result).toBe(false);
      expect(redis.cache.get).not.toHaveBeenCalled();
    });

    it('should return false for empty token', async () => {
      const result = await csrfService.validateCsrfToken(mockSessionId, '');

      expect(result).toBe(false);
      expect(redis.cache.get).not.toHaveBeenCalled();
    });

    it('should return false for null/undefined inputs', async () => {
      // @ts-expect-error - Testing invalid input types
      expect(await csrfService.validateCsrfToken(null, mockToken)).toBe(false);
      // @ts-expect-error - Testing invalid input types
      expect(await csrfService.validateCsrfToken(mockSessionId, null)).toBe(false);
      // @ts-expect-error - Testing invalid input types
      expect(await csrfService.validateCsrfToken(undefined, mockToken)).toBe(false);
      // @ts-expect-error - Testing invalid input types
      expect(await csrfService.validateCsrfToken(mockSessionId, undefined)).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.cache.get).mockRejectedValue(new Error('Redis read error'));

      await expect(
        csrfService.validateCsrfToken(mockSessionId, mockToken)
      ).rejects.toThrow('Redis read error');
    });
  });

  describe('invalidateCsrfToken()', () => {
    const validMetadata = {
      sessionId: mockSessionId,
      token: mockToken,
      createdAt: Date.now(),
      used: false,
    };

    it('should mark token as used', async () => {
      vi.mocked(redis.cache.get).mockResolvedValue(validMetadata);
      vi.mocked(redis.cache.set).mockResolvedValue(undefined);

      await csrfService.invalidateCsrfToken(mockSessionId, mockToken);

      expect(redis.cache.get).toHaveBeenCalledWith(mockCacheKey);
      expect(redis.cache.set).toHaveBeenCalledWith(
        mockCacheKey,
        { ...validMetadata, used: true },
        3600
      );
    });

    it('should handle missing token gracefully', async () => {
      vi.mocked(redis.cache.get).mockResolvedValue(null);

      await csrfService.invalidateCsrfToken(mockSessionId, mockToken);

      expect(redis.cache.get).toHaveBeenCalled();
      expect(redis.cache.set).not.toHaveBeenCalled();
    });

    it('should handle empty session ID gracefully', async () => {
      await csrfService.invalidateCsrfToken('', mockToken);

      expect(redis.cache.get).not.toHaveBeenCalled();
      expect(redis.cache.set).not.toHaveBeenCalled();
    });

    it('should handle empty token gracefully', async () => {
      await csrfService.invalidateCsrfToken(mockSessionId, '');

      expect(redis.cache.get).not.toHaveBeenCalled();
      expect(redis.cache.set).not.toHaveBeenCalled();
    });

    it('should handle null/undefined inputs gracefully', async () => {
      // @ts-expect-error - Testing invalid input types
      await csrfService.invalidateCsrfToken(null, mockToken);
      // @ts-expect-error - Testing invalid input types
      await csrfService.invalidateCsrfToken(mockSessionId, null);
      // @ts-expect-error - Testing invalid input types
      await csrfService.invalidateCsrfToken(undefined, mockToken);
      // @ts-expect-error - Testing invalid input types
      await csrfService.invalidateCsrfToken(mockSessionId, undefined);

      expect(redis.cache.get).not.toHaveBeenCalled();
    });
  });

  describe('clearSessionCsrfTokens()', () => {
    it('should clear all tokens for a session', async () => {
      vi.mocked(redis.cache.invalidatePattern).mockResolvedValue(3);

      await csrfService.clearSessionCsrfTokens(mockSessionId);

      expect(redis.buildCacheKey).toHaveBeenCalledWith(
        redis.REDIS_NAMESPACES.SESSION,
        'csrf',
        mockSessionId,
        '*'
      );
      expect(redis.cache.invalidatePattern).toHaveBeenCalledWith(mockCacheKey);
    });

    it('should handle empty session ID gracefully', async () => {
      await csrfService.clearSessionCsrfTokens('');

      expect(redis.cache.invalidatePattern).not.toHaveBeenCalled();
    });

    it('should handle null/undefined session ID gracefully', async () => {
      // @ts-expect-error - Testing invalid input types
      await csrfService.clearSessionCsrfTokens(null);
      // @ts-expect-error - Testing invalid input types
      await csrfService.clearSessionCsrfTokens(undefined);

      expect(redis.cache.invalidatePattern).not.toHaveBeenCalled();
    });

    it('should return number of tokens cleared', async () => {
      vi.mocked(redis.cache.invalidatePattern).mockResolvedValue(5);

      await csrfService.clearSessionCsrfTokens(mockSessionId);

      expect(redis.cache.invalidatePattern).toHaveBeenCalledWith(mockCacheKey);
    });
  });

  describe('rotateCsrfToken()', () => {
    const oldToken = 'old-token-123';
    const oldTokenKey = 'session:csrf:test-session-123:old-token-123';

    beforeEach(() => {
      // Mock Redis cache operations
      vi.mocked(redis.cache.get).mockResolvedValue({
        sessionId: mockSessionId,
        token: oldToken,
        createdAt: Date.now(),
        used: false,
      });
      vi.mocked(redis.cache.set).mockResolvedValue(undefined);

      // Mock buildCacheKey to return appropriate keys
      vi.mocked(redis.buildCacheKey)
        .mockImplementation((namespace, type, sessionId, token) => {
          if (token === oldToken) {
            return oldTokenKey;
          }
          return `${namespace}:${type}:${sessionId}:${token}`;
        });
    });

    it('should generate new token and invalidate old token', async () => {
      const result = await csrfService.rotateCsrfToken(mockSessionId, oldToken);

      // Verify a new token was generated
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify old token was marked as used (invalidated)
      expect(redis.cache.set).toHaveBeenCalledWith(
        oldTokenKey,
        expect.objectContaining({
          sessionId: mockSessionId,
          token: oldToken,
          used: true, // Key check: old token marked as used
        }),
        3600
      );

      // Verify new token was stored
      expect(redis.cache.set).toHaveBeenCalledWith(
        expect.stringContaining('session:csrf:test-session-123:'),
        expect.objectContaining({
          sessionId: mockSessionId,
          used: false, // New token not yet used
        }),
        3600
      );
    });

    it('should generate new token without invalidating when no old token provided', async () => {
      const result = await csrfService.rotateCsrfToken(mockSessionId);

      // Verify a new token was generated
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify old token was NOT retrieved (no invalidation attempt)
      expect(redis.cache.get).not.toHaveBeenCalled();

      // Verify new token was stored
      expect(redis.cache.set).toHaveBeenCalledWith(
        expect.stringContaining('session:csrf:test-session-123:'),
        expect.objectContaining({
          sessionId: mockSessionId,
          used: false,
        }),
        3600
      );
    });

    it('should handle undefined old token', async () => {
      const result = await csrfService.rotateCsrfToken(mockSessionId, undefined);

      // Verify a new token was generated
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Verify old token was NOT retrieved
      expect(redis.cache.get).not.toHaveBeenCalled();
    });

    it('should propagate errors from Redis operations', async () => {
      vi.mocked(redis.cache.set).mockRejectedValue(new Error('Redis connection failed'));

      await expect(csrfService.rotateCsrfToken(mockSessionId, oldToken)).rejects.toThrow(
        'Redis connection failed'
      );
    });
  });
});
