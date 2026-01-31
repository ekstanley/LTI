/**
 * WebSocket Authentication Tests
 *
 * Tests for JWT token extraction and validation in WebSocket upgrade requests.
 * Uses jwtService for proper signature verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage } from 'http';
import { authenticateWebSocketRequest, requiresAuthentication } from '../../websocket/auth.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock jwtService for controlled testing
const mockVerifyAccessToken = vi.fn();
vi.mock('../../services/jwt.service.js', () => ({
  jwtService: {
    verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
  },
}));

// Helper to create mock HTTP request
function createMockRequest(options: {
  url?: string;
  host?: string;
  protocol?: string;
}): IncomingMessage {
  return {
    url: options.url ?? '/',
    headers: {
      host: options.host ?? 'localhost:4001',
      ...(options.protocol && { 'sec-websocket-protocol': options.protocol }),
    },
  } as IncomingMessage;
}

describe('WebSocket Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateWebSocketRequest', () => {
    describe('anonymous connections', () => {
      it('allows connection without token', () => {
        const req = createMockRequest({ url: '/ws' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBeUndefined();
        expect(result.error).toBeUndefined();
        // jwtService should not be called for anonymous connections
        expect(mockVerifyAccessToken).not.toHaveBeenCalled();
      });

      it('allows connection with empty query string', () => {
        const req = createMockRequest({ url: '/ws?' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(mockVerifyAccessToken).not.toHaveBeenCalled();
      });
    });

    describe('security - query string rejection', () => {
      it('rejects query string tokens for security reasons', () => {
        const token = 'valid.jwt.token';
        // Even though token is valid, query string should be rejected
        mockVerifyAccessToken.mockReturnValue({
          valid: true,
          payload: { sub: 'user-123' },
        });

        const req = createMockRequest({ url: `/ws?token=${token}` });
        const result = authenticateWebSocketRequest(req);

        // Should be treated as anonymous (no token extracted from query string)
        expect(result.authenticated).toBe(true);
        expect(result.userId).toBeUndefined();
        // jwtService should NOT be called for query string tokens
        expect(mockVerifyAccessToken).not.toHaveBeenCalled();
      });
    });

    describe('token extraction from Sec-WebSocket-Protocol header', () => {
      it('extracts and verifies token from protocol header', () => {
        const token = 'header.jwt.token';
        mockVerifyAccessToken.mockReturnValue({
          valid: true,
          payload: { sub: 'user-789' },
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: `token.${token}`,
        });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-789');
        expect(mockVerifyAccessToken).toHaveBeenCalledWith(token);
      });

      it('extracts token from multiple protocols', () => {
        const token = 'multi.protocol.token';
        mockVerifyAccessToken.mockReturnValue({
          valid: true,
          payload: { sub: 'user-abc' },
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: `graphql-ws, token.${token}`,
        });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-abc');
      });
    });

    describe('token verification errors', () => {
      it('rejects expired token', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: false,
          error: 'expired',
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.expired.jwt.token',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Token has expired');
      });

      it('rejects invalid token', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: false,
          error: 'invalid',
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.invalid.jwt.token',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token');
      });

      it('rejects malformed token', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: false,
          error: 'malformed',
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.malformed',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Malformed token');
      });

      it('rejects revoked token', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: false,
          error: 'revoked',
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.revoked.jwt.token',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Token has been revoked');
      });

      it('handles unknown error gracefully', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: false,
          error: 'unknown_error',
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.some.jwt.token',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Authentication failed');
      });
    });

    describe('valid token verification', () => {
      it('extracts userId from verified payload', () => {
        mockVerifyAccessToken.mockReturnValue({
          valid: true,
          payload: { sub: 'verified-user-id', email: 'test@example.com' },
        });

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.valid.jwt.token',
        });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('verified-user-id');
      });
    });
  });

  describe('requiresAuthentication', () => {
    describe('public rooms', () => {
      it('returns false for bill rooms', () => {
        expect(requiresAuthentication('bill:hr-1234')).toBe(false);
        expect(requiresAuthentication('bill:s-5678')).toBe(false);
      });

      it('returns false for vote rooms', () => {
        expect(requiresAuthentication('vote:abc123')).toBe(false);
        expect(requiresAuthentication('vote:xyz789')).toBe(false);
      });

      it('returns false for legislator rooms', () => {
        expect(requiresAuthentication('legislator:L000123')).toBe(false);
      });
    });

    describe('protected rooms', () => {
      it('returns true for user rooms', () => {
        expect(requiresAuthentication('user:private-room')).toBe(true);
        expect(requiresAuthentication('user:user-123')).toBe(true);
      });

      it('returns true for saved items rooms', () => {
        expect(requiresAuthentication('saved:bills')).toBe(true);
        expect(requiresAuthentication('saved:votes')).toBe(true);
      });

      it('returns true for notifications rooms', () => {
        expect(requiresAuthentication('notifications:user-123')).toBe(true);
      });
    });
  });
});
