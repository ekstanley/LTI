/**
 * JWT Service Unit Tests
 *
 * Comprehensive test suite for JWT token generation, verification, rotation,
 * and management. Tests security features including theft detection and
 * token family revocation.
 */

import { createHash } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { jwtService } from '../../services/jwt.service.js';
import type { RefreshTokenPayload } from '../../services/jwt.service.js';

// Mock dependencies
vi.mock('../../db/client.js', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../config.js', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-for-unit-tests-only-32chars!',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      issuer: 'ltip-api',
      audience: 'ltip-web',
      algorithm: 'HS256' as const,
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import { prisma } from '../../db/client.js';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';

// Helper to compute SHA-256 hash
function computeHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Helper to create a real JWT token for testing
function createTestToken(
  payload: Record<string, unknown>,
  options?: { expiresIn?: string | number; issuer?: string; audience?: string }
): string {
  return jwt.sign(
    payload,
    config.jwt.secret,
    {
      algorithm: config.jwt.algorithm,
      expiresIn: (options?.expiresIn ?? '15m') as number,
      issuer: options?.issuer ?? config.jwt.issuer,
      audience: options?.audience ?? config.jwt.audience,
    }
  );
}

describe('jwtService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTokenPair', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const mockTokenRecord = { id: 'token-record-id' };

    beforeEach(() => {
      vi.mocked(prisma.refreshToken.create).mockResolvedValue(mockTokenRecord as any);
      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        ...mockTokenRecord,
        tokenHash: 'mocked-hash',
      } as any);
    });

    it('should return token pair with all required fields', async () => {
      const result = await jwtService.generateTokenPair(userId, email);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('accessTokenExpiresAt');
      expect(result).toHaveProperty('refreshTokenExpiresAt');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
    });

    it('should generate access token with correct payload', async () => {
      const result = await jwtService.generateTokenPair(userId, email);

      const decoded = jwt.verify(result.accessToken, config.jwt.secret, {
        algorithms: ['HS256'],
      }) as any;

      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe('access');
      expect(decoded.iss).toBe(config.jwt.issuer);
      expect(decoded.aud).toBe(config.jwt.audience);
    });

    it('should generate refresh token with correct payload', async () => {
      const result = await jwtService.generateTokenPair(userId, email);

      const decoded = jwt.verify(result.refreshToken, config.jwt.secret, {
        algorithms: ['HS256'],
      }) as any;

      expect(decoded.sub).toBe(userId);
      expect(decoded.jti).toBe('token-record-id');
      expect(decoded.familyId).toBeDefined();
      expect(decoded.type).toBe('refresh');
      expect(decoded.iss).toBe(config.jwt.issuer);
      expect(decoded.aud).toBe(config.jwt.audience);
    });

    it('should create database record via prisma.refreshToken.create', async () => {
      await jwtService.generateTokenPair(userId, email, {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          tokenHash: '',
          familyId: expect.any(String),
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should update database record with token hash', async () => {
      const result = await jwtService.generateTokenPair(userId, email);

      const expectedHash = computeHash(result.refreshToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-record-id' },
        data: { tokenHash: expectedHash },
      });
    });

    it('should store SHA-256 hash of refresh token', async () => {
      const result = await jwtService.generateTokenPair(userId, email);

      const updateCall = vi.mocked(prisma.refreshToken.update).mock.calls[0];
      const storedHash = updateCall?.[0]?.data?.tokenHash;
      const expectedHash = computeHash(result.refreshToken);

      expect(storedHash).toBe(expectedHash);
    });

    it('should reuse existingFamilyId when provided (rotation flow)', async () => {
      const existingFamilyId = 'existing-family-123';

      await jwtService.generateTokenPair(userId, email, { existingFamilyId });

      const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0];
      expect(createCall?.[0]?.data?.familyId).toBe(existingFamilyId);
    });

    it('should generate new familyId when not provided (new login)', async () => {
      await jwtService.generateTokenPair(userId, email);

      const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0];
      const familyId = createCall?.[0]?.data?.familyId;

      expect(familyId).toBeDefined();
      expect(typeof familyId).toBe('string');
      expect(familyId?.length).toBeGreaterThan(20); // Base64url encoded 32 bytes
    });
  });

  describe('verifyAccessToken', () => {
    const userId = 'user-123';
    const email = 'test@example.com';

    it('should return valid=true with correct payload for valid token', () => {
      const token = createTestToken({
        sub: userId,
        email,
        type: 'access',
      });

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.sub).toBe(userId);
        expect(result.payload.email).toBe(email);
        expect(result.payload.type).toBe('access');
      }
    });

    it('should return valid=false, error=expired for expired token', () => {
      // Create token that expires immediately
      const token = createTestToken(
        { sub: userId, email, type: 'access' },
        { expiresIn: '0s' }
      );

      // Wait a moment to ensure expiration
      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('expired');
      }
    });

    it('should return valid=false, error=malformed for garbage token', () => {
      const result = jwtService.verifyAccessToken('not-a-valid-jwt-token');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
      }
    });

    it('should return valid=false, error=malformed for token signed with wrong secret', () => {
      const token = jwt.sign(
        { sub: userId, email, type: 'access' },
        'wrong-secret',
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
      }
    });

    it('should return valid=false, error=invalid for refresh token presented as access token', () => {
      const token = createTestToken({
        sub: userId,
        jti: 'token-id',
        familyId: 'family-123',
        type: 'refresh', // Wrong type
      });

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should return valid=false, error=malformed for wrong issuer', () => {
      const token = createTestToken(
        { sub: userId, email, type: 'access' },
        { issuer: 'wrong-issuer' }
      );

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
      }
    });

    it('should return valid=false, error=malformed for wrong audience', () => {
      const token = createTestToken(
        { sub: userId, email, type: 'access' },
        { audience: 'wrong-audience' }
      );

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
      }
    });

    it('should return valid=false, error=invalid for token without required fields', () => {
      const token = createTestToken({ sub: userId }); // Missing email and type

      const result = jwtService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });
  });

  describe('verifyRefreshToken', () => {
    const userId = 'user-123';
    const jti = 'token-record-id';
    const familyId = 'family-123';

    beforeEach(() => {
      // Default: return valid token record
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash: 'placeholder-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        user: { id: userId, isActive: true },
      } as any);
    });

    it('should return valid=true with payload including userId for valid token', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(token);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.sub).toBe(userId);
        expect(result.payload.jti).toBe(jti);
        expect(result.payload.familyId).toBe(familyId);
        expect(result.payload.type).toBe('refresh');
        expect(result.payload.userId).toBe(userId);
      }
    });

    it('should return valid=false, error=expired for expired JWT', async () => {
      const token = createTestToken(
        { sub: userId, jti, familyId, type: 'refresh' },
        { expiresIn: '0s' }
      );

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('expired');
      }
    });

    it('should return valid=false, error=malformed for invalid JWT', async () => {
      const result = await jwtService.verifyRefreshToken('invalid-token');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
      }
    });

    it('should return valid=false, error=invalid for type !== refresh', async () => {
      const token = createTestToken({
        sub: userId,
        email: 'test@example.com',
        type: 'access', // Wrong type
      });

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should return valid=false, error=invalid when token record not found in DB', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
      expect(logger.warn).toHaveBeenCalledWith(
        { jti },
        'Refresh token not found in database'
      );
    });

    it('should return valid=false, error=revoked when revokedAt is set and call revokeTokenFamily (SECURITY)', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash: computeHash(token),
        revokedAt: new Date(), // Token has been revoked
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 5 } as any);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('revoked');
      }

      // Verify that revokeTokenFamily was called (via updateMany)
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          familyId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });

      expect(logger.error).toHaveBeenCalledWith(
        { jti, familyId },
        expect.stringContaining('SECURITY: Reuse of revoked refresh token detected')
      );
    });

    it('should return valid=false, error=invalid for hash mismatch', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash: 'wrong-hash', // Mismatch
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
      expect(logger.warn).toHaveBeenCalledWith(
        { jti },
        'Refresh token hash mismatch'
      );
    });

    it('should return valid=false, error=revoked for inactive user', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(token);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: false }, // User is inactive
      } as any);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('revoked');
      }
      expect(logger.info).toHaveBeenCalledWith(
        { userId },
        'User account is inactive'
      );
    });

    it('should return valid=false, error=expired when DB record expiresAt is in past', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(token);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: { id: userId, isActive: true },
      } as any);

      const result = await jwtService.verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('expired');
      }
    });

    it('should verify token hash by calling prisma.refreshToken.findUnique with correct jti', async () => {
      const token = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(token);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      await jwtService.verifyRefreshToken(token);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: jti },
        include: { user: { select: { id: true, isActive: true } } },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const jti = 'old-token-id';
    const familyId = 'family-123';

    beforeEach(() => {
      // Mock valid token verification
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash: 'placeholder-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      // Mock user lookup
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);

      // Mock token creation
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({
        id: 'new-token-id',
      } as any);

      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        id: 'new-token-id',
        tokenHash: 'new-hash',
      } as any);
    });

    it('should return new token pair with same familyId', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      const result = await jwtService.rotateRefreshToken(oldToken);

      expect(result).not.toBeNull();
      if (result) {
        const newRefreshPayload = jwt.decode(result.refreshToken) as RefreshTokenPayload;
        expect(newRefreshPayload.familyId).toBe(familyId);
      }
    });

    it('should mark old token as revoked with revokedAt set', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      await jwtService.rotateRefreshToken(oldToken);

      // Find the update call that marks the old token as revoked
      const updateCalls = vi.mocked(prisma.refreshToken.update).mock.calls;
      const revokeCall = updateCalls.find((call) => call[0].where?.id === jti);

      expect(revokeCall).toBeDefined();
      expect(revokeCall?.[0].data?.revokedAt).toBeInstanceOf(Date);
    });

    it('should link old token to new via replacedBy field', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      await jwtService.rotateRefreshToken(oldToken);

      const updateCalls = vi.mocked(prisma.refreshToken.update).mock.calls;
      const revokeCall = updateCalls.find((call) => call[0].where?.id === jti);

      expect(revokeCall?.[0].data?.replacedBy).toBe('new-token-id');
    });

    it('should return null when old token is invalid', async () => {
      const result = await jwtService.rotateRefreshToken('invalid-token');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'malformed' }),
        'Cannot rotate invalid refresh token'
      );
    });

    it('should return null when user not found', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await jwtService.rotateRefreshToken(oldToken);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        { userId },
        'User not found during token rotation'
      );
    });

    it('should create new tokens with correct userId and email', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      const result = await jwtService.rotateRefreshToken(oldToken);

      expect(result).not.toBeNull();
      if (result) {
        const accessPayload = jwt.decode(result.accessToken) as any;
        expect(accessPayload.sub).toBe(userId);
        expect(accessPayload.email).toBe(email);

        const refreshPayload = jwt.decode(result.refreshToken) as any;
        expect(refreshPayload.sub).toBe(userId);
      }
    });

    it('should pass through options (userAgent, ipAddress)', async () => {
      const oldToken = createTestToken({
        sub: userId,
        jti,
        familyId,
        type: 'refresh',
      });

      const tokenHash = computeHash(oldToken);
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: jti,
        userId,
        familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: userId, isActive: true },
      } as any);

      await jwtService.rotateRefreshToken(oldToken, {
        userAgent: 'Chrome/96.0',
        ipAddress: '10.0.0.1',
      });

      const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0];
      expect(createCall?.[0].data?.userAgent).toBe('Chrome/96.0');
      expect(createCall?.[0].data?.ipAddress).toBe('10.0.0.1');
    });
  });

  describe('revokeToken', () => {
    it('should update record with revokedAt', async () => {
      const tokenId = 'token-123';

      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        id: tokenId,
        revokedAt: new Date(),
      } as any);

      await jwtService.revokeToken(tokenId);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should log the revocation', async () => {
      const tokenId = 'token-123';

      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        id: tokenId,
        revokedAt: new Date(),
      } as any);

      await jwtService.revokeToken(tokenId);

      expect(logger.debug).toHaveBeenCalledWith(
        { tokenId },
        'Revoked refresh token'
      );
    });
  });

  describe('revokeTokenFamily', () => {
    it('should update all non-revoked tokens in family with revokedAt', async () => {
      const familyId = 'family-123';

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 3 } as any);

      await jwtService.revokeTokenFamily(familyId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          familyId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should return count of revoked tokens', async () => {
      const familyId = 'family-123';

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 5 } as any);

      const count = await jwtService.revokeTokenFamily(familyId);

      expect(count).toBe(5);
      expect(logger.info).toHaveBeenCalledWith(
        { familyId, count: 5 },
        'Revoked token family'
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should update all non-revoked user tokens', async () => {
      const userId = 'user-123';

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 4 } as any);

      await jwtService.revokeAllUserTokens(userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should return count of revoked tokens', async () => {
      const userId = 'user-123';

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 7 } as any);

      const count = await jwtService.revokeAllUserTokens(userId);

      expect(count).toBe(7);
      expect(logger.info).toHaveBeenCalledWith(
        { userId, count: 7 },
        'Revoked all user tokens'
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 10 } as any);

      await jwtService.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            {
              revokedAt: {
                lt: expect.any(Date),
              },
            },
          ],
        },
      });
    });

    it('should delete revoked tokens older than 30 days', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 5 } as any);

      await jwtService.cleanupExpiredTokens();

      const deleteCall = vi.mocked(prisma.refreshToken.deleteMany).mock.calls[0];
      const orConditions = deleteCall?.[0]?.where?.OR as any[];
      const revokedCondition = orConditions?.find((cond) => cond.revokedAt);

      expect(revokedCondition).toBeDefined();

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const revokedBefore = revokedCondition.revokedAt.lt;

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(revokedBefore.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
    });

    it('should return count of deleted tokens', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 15 } as any);

      const count = await jwtService.cleanupExpiredTokens();

      expect(count).toBe(15);
      expect(logger.info).toHaveBeenCalledWith(
        { count: 15 },
        'Cleaned up expired/revoked tokens'
      );
    });
  });

  describe('getUserSessions', () => {
    const userId = 'user-123';

    it('should return active non-revoked sessions ordered by createdAt desc', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome/96.0',
          ipAddress: '192.168.1.1',
          createdAt: new Date('2024-01-15'),
          expiresAt: new Date('2024-01-22'),
        },
        {
          id: 'session-2',
          userAgent: 'Firefox/95.0',
          ipAddress: '192.168.1.2',
          createdAt: new Date('2024-01-14'),
          expiresAt: new Date('2024-01-21'),
        },
      ];

      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue(mockSessions as any);

      const sessions = await jwtService.getUserSessions(userId);

      expect(sessions).toEqual(mockSessions);
      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array for user with no sessions', async () => {
      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue([]);

      const sessions = await jwtService.getUserSessions(userId);

      expect(sessions).toEqual([]);
    });

    it('should filter out expired and revoked sessions via query', async () => {
      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue([]);

      await jwtService.getUserSessions(userId);

      const findManyCall = vi.mocked(prisma.refreshToken.findMany).mock.calls[0];
      const whereClause = findManyCall?.[0]?.where;

      expect(whereClause).toEqual({
        userId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      });
    });
  });
});
