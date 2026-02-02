/**
 * JWT Service
 *
 * Handles JWT token generation, verification, and refresh token management.
 * Implements secure token rotation with theft detection via family-based invalidation.
 */

import { createHash, randomBytes } from 'crypto';

import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';

import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';

/**
 * Payload embedded in access tokens
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  type: 'access';
}

/**
 * Payload embedded in refresh tokens
 */
export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // Token ID (maps to RefreshToken.id)
  familyId: string; // Token family for rotation tracking
  type: 'refresh';
}

/**
 * Result of token generation
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Result of token verification
 */
export interface VerifiedToken<T> {
  valid: true;
  payload: T;
}

export interface InvalidToken {
  valid: false;
  error: 'expired' | 'invalid' | 'revoked' | 'malformed';
}

export type TokenVerificationResult<T> = VerifiedToken<T> | InvalidToken;

/**
 * Parse duration string to milliseconds
 * Supports: '15m', '1h', '7d', '30d'
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([mhd])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Hash a token using SHA-256 for secure storage
 * Never store plaintext refresh tokens
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random ID
 */
function generateSecureId(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * JWT Service singleton
 */
export const jwtService = {
  /**
   * Generate a new access/refresh token pair
   *
   * @param userId - User's database ID
   * @param email - User's email
   * @param options - Optional session metadata
   */
  async generateTokenPair(
    userId: string,
    email: string,
    options?: {
      userAgent?: string;
      ipAddress?: string;
      existingFamilyId?: string;
    }
  ): Promise<TokenPair> {
    const now = new Date();
    const accessTokenExpiresAt = new Date(
      now.getTime() + parseDuration(config.jwt.accessTokenExpiresIn)
    );
    const refreshTokenExpiresAt = new Date(
      now.getTime() + parseDuration(config.jwt.refreshTokenExpiresIn)
    );

    // Generate family ID for new login, or reuse for rotation
    const familyId = options?.existingFamilyId ?? generateSecureId();

    // Generate access token
    const accessTokenPayload: AccessTokenPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    // Calculate expiry in seconds for JWT (parseDuration returns ms)
    const accessExpiresInSec = Math.floor(parseDuration(config.jwt.accessTokenExpiresIn) / 1000);

    const accessTokenOptions: SignOptions = {
      algorithm: config.jwt.algorithm,
      expiresIn: accessExpiresInSec,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret, accessTokenOptions);

    // Create refresh token record in database first to get the ID
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: '', // Placeholder, will update after signing
        familyId,
        userAgent: options?.userAgent ?? null,
        ipAddress: options?.ipAddress ?? null,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    // Generate refresh token with the database record ID
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: userId,
      jti: refreshTokenRecord.id,
      familyId,
      type: 'refresh',
    };

    // Calculate expiry in seconds for JWT
    const refreshExpiresInSec = Math.floor(parseDuration(config.jwt.refreshTokenExpiresIn) / 1000);

    const refreshTokenOptions: SignOptions = {
      algorithm: config.jwt.algorithm,
      expiresIn: refreshExpiresInSec,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    const refreshToken = jwt.sign(refreshTokenPayload, config.jwt.secret, refreshTokenOptions);

    // Update the record with the token hash
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { tokenHash: hashToken(refreshToken) },
    });

    logger.debug({ userId, familyId }, 'Generated new token pair');

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  },

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): TokenVerificationResult<AccessTokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload & AccessTokenPayload;

      if (decoded.type !== 'access') {
        return { valid: false, error: 'invalid' };
      }

      return {
        valid: true,
        payload: {
          sub: decoded.sub,
          email: decoded.email,
          type: 'access',
        },
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'malformed' };
      }
      return { valid: false, error: 'invalid' };
    }
  },

  /**
   * Verify a refresh token and check database status
   * Returns the payload if valid, or an error indicator
   */
  async verifyRefreshToken(
    token: string
  ): Promise<TokenVerificationResult<RefreshTokenPayload & { userId: string }>> {
    // First, verify JWT signature and expiration
    let decoded: JwtPayload & RefreshTokenPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload & RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        return { valid: false, error: 'invalid' };
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'expired' };
      }
      return { valid: false, error: 'malformed' };
    }

    // Check database for token status
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { id: decoded.jti },
      include: { user: { select: { id: true, isActive: true } } },
    });

    // Token not found in database
    if (!tokenRecord) {
      logger.warn({ jti: decoded.jti }, 'Refresh token not found in database');
      return { valid: false, error: 'invalid' };
    }

    // Token has been revoked (potential theft detected)
    if (tokenRecord.revokedAt) {
      // This is a CRITICAL security event - someone tried to reuse a rotated token
      // Revoke the entire family to force re-authentication
      logger.error(
        { jti: decoded.jti, familyId: tokenRecord.familyId },
        'SECURITY: Reuse of revoked refresh token detected - revoking entire family'
      );

      await this.revokeTokenFamily(tokenRecord.familyId);
      return { valid: false, error: 'revoked' };
    }

    // Verify hash matches
    const expectedHash = hashToken(token);
    if (tokenRecord.tokenHash !== expectedHash) {
      logger.warn({ jti: decoded.jti }, 'Refresh token hash mismatch');
      return { valid: false, error: 'invalid' };
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      logger.info({ userId: tokenRecord.userId }, 'User account is inactive');
      return { valid: false, error: 'revoked' };
    }

    // Check expiration (database record might have different expiry than JWT)
    if (tokenRecord.expiresAt < new Date()) {
      return { valid: false, error: 'expired' };
    }

    return {
      valid: true,
      payload: {
        sub: decoded.sub,
        jti: decoded.jti,
        familyId: decoded.familyId,
        type: 'refresh',
        userId: tokenRecord.userId,
      },
    };
  },

  /**
   * Rotate a refresh token (used during refresh flow)
   *
   * The old token is marked as revoked and replaced by a new one.
   * This implements refresh token rotation for theft detection.
   */
  async rotateRefreshToken(
    oldToken: string,
    options?: {
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<TokenPair | null> {
    const verification = await this.verifyRefreshToken(oldToken);

    if (!verification.valid) {
      logger.warn({ error: verification.error }, 'Cannot rotate invalid refresh token');
      return null;
    }

    const { jti, familyId, userId } = verification.payload;

    // Get user email for new access token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      logger.error({ userId }, 'User not found during token rotation');
      return null;
    }

    // Create new token pair with same family
    const newTokenPair = await this.generateTokenPair(userId, user.email, {
      ...options,
      existingFamilyId: familyId,
    });

    // Extract the new token's JTI from the generated refresh token
    // SECURITY: Use decode (not verify) since we just generated this token
    const newTokenPayload = jwt.decode(newTokenPair.refreshToken) as RefreshTokenPayload | null;
    const newTokenJti = newTokenPayload?.jti;

    // Mark old token as revoked and link to replacement
    await prisma.refreshToken.update({
      where: { id: jti },
      data: {
        revokedAt: new Date(),
        replacedBy: newTokenJti ?? null, // Link to the NEW token's ID for audit trail
      },
    });

    logger.debug({ userId, familyId, oldJti: jti, newJti: newTokenJti }, 'Rotated refresh token');

    return newTokenPair;
  },

  /**
   * Revoke a single refresh token
   */
  async revokeToken(tokenId: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    logger.debug({ tokenId }, 'Revoked refresh token');
  },

  /**
   * Revoke all tokens in a family (for security incidents)
   */
  async revokeTokenFamily(familyId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    logger.info({ familyId, count: result.count }, 'Revoked token family');

    return result.count;
  },

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    logger.info({ userId, count: result.count }, 'Revoked all user tokens');

    return result.count;
  },

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          // Delete revoked tokens older than 30 days
          {
            revokedAt: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    });

    logger.info({ count: result.count }, 'Cleaned up expired/revoked tokens');

    return result.count;
  },

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
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
  },
};

export type JwtService = typeof jwtService;
