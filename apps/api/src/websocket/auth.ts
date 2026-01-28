/**
 * WebSocket Authentication
 *
 * MVP: Token format validation and user extraction stub.
 * Full JWT verification will be implemented in Phase 2.
 *
 * Token can be provided via:
 * - Query string: ws://host/ws?token=xxx
 * - Sec-WebSocket-Protocol header
 */

import type { IncomingMessage } from 'http';
import { logger } from '../lib/logger.js';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Extract and validate token from WebSocket upgrade request
 *
 * Phase 2 TODO: Implement actual JWT verification with jsonwebtoken
 */
export function authenticateWebSocketRequest(req: IncomingMessage): AuthResult {
  const token = extractToken(req);

  // No token = anonymous connection (allowed for MVP)
  if (!token) {
    logger.debug('WebSocket connection without token (anonymous)');
    return { authenticated: true };
  }

  // Validate token format (JWT: header.payload.signature)
  if (!isValidTokenFormat(token)) {
    logger.warn('Invalid WebSocket token format');
    return {
      authenticated: false,
      error: 'Invalid token format',
    };
  }

  // MVP: Extract user ID from token payload without verification
  // Phase 2: Add actual JWT verification here
  const userId = extractUserIdFromToken(token);

  if (userId) {
    logger.debug({ userId }, 'WebSocket authenticated');
    return {
      authenticated: true,
      userId,
    };
  }

  return {
    authenticated: false,
    error: 'Invalid token payload',
  };
}

/**
 * Extract token from request
 * Priority: 1) Query string, 2) Sec-WebSocket-Protocol
 */
function extractToken(req: IncomingMessage): string | null {
  // Try query string first
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // Try Sec-WebSocket-Protocol header (custom subprotocol pattern)
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
 * Check if token has valid JWT format (3 base64url segments)
 */
function isValidTokenFormat(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Each part should be valid base64url
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every((part) => part.length > 0 && base64urlRegex.test(part));
}

/**
 * Extract user ID from JWT payload (without verification)
 *
 * WARNING: This does NOT verify the signature!
 * Phase 2: Replace with proper JWT verification
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as {
      sub?: string;
      userId?: string;
    };

    return payload.sub ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a connection requires authentication
 * MVP: All connections allowed (anonymous or authenticated)
 * Phase 2: Configure required auth for certain rooms
 */
export function requiresAuthentication(_room: string): boolean {
  // MVP: No rooms require authentication
  // Phase 2: Implement room-based auth requirements
  return false;
}
