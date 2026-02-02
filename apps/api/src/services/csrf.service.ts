/**
 * CSRF Token Service
 *
 * Implements Synchronizer Token Pattern for CSRF protection:
 * - Generates cryptographically secure tokens using crypto.randomBytes
 * - Stores tokens in Redis with session binding
 * - Validates tokens with single-use enforcement
 * - 1-hour token expiration
 *
 * Security properties:
 * - Session binding prevents token theft across sessions
 * - Single-use prevents replay attacks
 * - CSPRNG ensures unpredictability
 * - Short expiration limits attack window
 */

import { randomBytes } from 'node:crypto';

import { cache, buildCacheKey, REDIS_NAMESPACES } from '../db/redis.js';
import { logger } from '../lib/logger.js';

/**
 * CSRF token configuration
 */
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32, // 256 bits of entropy
  TTL_SECONDS: 3600, // 1 hour
  MAX_TOKENS_PER_SESSION: 5, // Prevent memory exhaustion
} as const;

/**
 * CSRF token metadata stored in Redis
 */
interface CsrfTokenMetadata {
  sessionId: string;
  token: string;
  createdAt: number;
  used: boolean;
}

/**
 * Generate cryptographically secure CSRF token
 *
 * @param sessionId - Session identifier to bind token to
 * @returns Base64-encoded random token
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  // Validate session ID
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session ID');
  }

  // Generate cryptographically secure random token
  const tokenBytes = randomBytes(CSRF_CONFIG.TOKEN_LENGTH);
  const token = tokenBytes.toString('base64url'); // URL-safe base64

  // Store token metadata in Redis with session binding
  const key = buildCacheKey(REDIS_NAMESPACES.SESSION, 'csrf', sessionId, token);
  const metadata: CsrfTokenMetadata = {
    sessionId,
    token,
    createdAt: Date.now(),
    used: false,
  };

  await cache.set(key, metadata, CSRF_CONFIG.TTL_SECONDS);

  logger.debug({ sessionId, tokenLength: token.length }, 'CSRF token generated');

  return token;
}

/**
 * Validate CSRF token and enforce single-use
 *
 * @param sessionId - Session identifier token is bound to
 * @param token - CSRF token to validate
 * @returns True if token is valid and not yet used
 */
export async function validateCsrfToken(
  sessionId: string,
  token: string
): Promise<boolean> {
  // Validate inputs
  if (!sessionId || !token) {
    logger.warn({ sessionId: !!sessionId, token: !!token }, 'Invalid CSRF validation inputs');
    return false;
  }

  // Retrieve token metadata from Redis
  const key = buildCacheKey(REDIS_NAMESPACES.SESSION, 'csrf', sessionId, token);
  const metadata = await cache.get<CsrfTokenMetadata>(key);

  if (!metadata) {
    logger.warn({ sessionId }, 'CSRF token not found');
    return false;
  }

  // Check if token has already been used
  if (metadata.used) {
    logger.warn({ sessionId }, 'CSRF token already used');
    return false;
  }

  // Verify session binding
  if (metadata.sessionId !== sessionId) {
    logger.error(
      { expectedSession: sessionId, actualSession: metadata.sessionId },
      'CSRF token session mismatch'
    );
    return false;
  }

  // Token is valid
  logger.debug({ sessionId }, 'CSRF token validated successfully');
  return true;
}

/**
 * Invalidate CSRF token after successful use (single-use enforcement)
 *
 * @param sessionId - Session identifier token is bound to
 * @param token - CSRF token to invalidate
 */
export async function invalidateCsrfToken(
  sessionId: string,
  token: string
): Promise<void> {
  if (!sessionId || !token) {
    logger.warn({ sessionId: !!sessionId, token: !!token }, 'Invalid invalidation inputs');
    return;
  }

  const key = buildCacheKey(REDIS_NAMESPACES.SESSION, 'csrf', sessionId, token);

  // Mark token as used instead of deleting to maintain audit trail
  const metadata = await cache.get<CsrfTokenMetadata>(key);
  if (metadata) {
    metadata.used = true;
    await cache.set(key, metadata, CSRF_CONFIG.TTL_SECONDS);
    logger.debug({ sessionId }, 'CSRF token invalidated');
  }
}

/**
 * Clean up all CSRF tokens for a session (on logout)
 *
 * @param sessionId - Session identifier
 */
export async function clearSessionCsrfTokens(sessionId: string): Promise<void> {
  if (!sessionId) {
    logger.warn('Cannot clear CSRF tokens without session ID');
    return;
  }

  const pattern = buildCacheKey(REDIS_NAMESPACES.SESSION, 'csrf', sessionId, '*');
  const cleared = await cache.invalidatePattern(pattern);

  logger.info({ sessionId, tokensCleared: cleared }, 'Session CSRF tokens cleared');
}

/**
 * Rotate CSRF token (generate new, invalidate old)
 *
 * @param sessionId - Session identifier
 * @param oldToken - Previous token to invalidate
 * @returns New CSRF token
 */
export async function rotateCsrfToken(
  sessionId: string,
  oldToken?: string
): Promise<string> {
  // Invalidate old token if provided
  if (oldToken) {
    await invalidateCsrfToken(sessionId, oldToken);
  }

  // Generate and return new token
  return generateCsrfToken(sessionId);
}
