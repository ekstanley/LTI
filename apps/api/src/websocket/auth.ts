/**
 * WebSocket Authentication
 *
 * Validates JWT tokens for WebSocket connections using the jwtService.
 * Provides proper signature verification and expiration checking.
 *
 * Token must be provided via Sec-WebSocket-Protocol header: token.<jwt>
 * Query string tokens are NOT supported for security reasons (logs, history).
 */

import type { IncomingMessage } from 'http';

import { logger } from '../lib/logger.js';
import { jwtService } from '../services/jwt.service.js';

/**
 * Authentication result - uses discriminated union to prevent illegal states
 *
 * Valid states:
 * - Authenticated user: { authenticated: true, userId: string }
 * - Anonymous connection: { authenticated: true } (no userId)
 * - Authentication failed: { authenticated: false, error: string }
 */
export type AuthResult =
  | { authenticated: true; userId: string; error?: never }
  | { authenticated: true; userId?: undefined; error?: never }
  | { authenticated: false; userId?: never; error: string };

/**
 * Extract and validate JWT from WebSocket upgrade request
 *
 * Uses jwtService for proper JWT signature verification.
 */
export function authenticateWebSocketRequest(req: IncomingMessage): AuthResult {
  const token = extractToken(req);

  // No token = anonymous connection (allowed for public data)
  if (!token) {
    logger.debug('WebSocket connection without token (anonymous)');
    return { authenticated: true };
  }

  // Verify token using jwtService (proper signature verification)
  const verification = jwtService.verifyAccessToken(token);

  if (!verification.valid) {
    const errorMessages: Record<string, string> = {
      expired: 'Token has expired',
      invalid: 'Invalid token',
      malformed: 'Malformed token',
      revoked: 'Token has been revoked',
    };

    const errorMessage = errorMessages[verification.error] ?? 'Authentication failed';
    logger.warn({ error: verification.error }, 'WebSocket authentication failed');

    return {
      authenticated: false,
      error: errorMessage,
    };
  }

  // Token is valid - extract userId from verified payload
  const userId = verification.payload.sub;

  logger.debug({ userId }, 'WebSocket authenticated');
  return {
    authenticated: true,
    userId,
  };
}

/**
 * Extract token from Sec-WebSocket-Protocol header
 *
 * SECURITY: Query string tokens are explicitly NOT supported because they:
 * - Appear in server access logs
 * - Are stored in browser history
 * - Are visible to proxies and CDNs
 * - Can leak via Referrer headers
 * - May be captured by analytics tools
 */
function extractToken(req: IncomingMessage): string | null {
  // Extract token from Sec-WebSocket-Protocol header (custom subprotocol pattern)
  const protocols = req.headers['sec-websocket-protocol'];
  if (protocols) {
    const protocolList = protocols.split(',').map((p) => p.trim());
    const tokenProtocol = protocolList.find((p) => p.startsWith('token.'));
    if (tokenProtocol) {
      return tokenProtocol.slice(6); // Remove 'token.' prefix
    }
  }

  return null;
}

/**
 * Check if a connection requires authentication for a specific room
 *
 * Returns true for rooms that contain user-specific or sensitive data.
 * Anonymous connections are denied for these rooms.
 */
export function requiresAuthentication(room: string): boolean {
  // Rooms requiring authentication (user-specific data)
  const authenticatedRooms = [
    /^user:/,           // User-specific rooms
    /^saved:/,          // Saved items/preferences
    /^notifications:/,  // User notifications
  ];

  return authenticatedRooms.some((pattern) => pattern.test(room));
}
