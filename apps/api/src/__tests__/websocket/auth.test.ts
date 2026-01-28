/**
 * WebSocket Authentication Tests
 *
 * Tests for JWT token extraction and validation in WebSocket upgrade requests.
 * MVP implementation validates token format without signature verification.
 */

import { describe, it, expect, vi } from 'vitest';
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

// Helper to create a valid JWT token structure (for format validation only)
function createMockJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'fake_signature_for_testing';
  return `${header}.${payloadPart}.${signature}`;
}

describe('WebSocket Authentication', () => {
  describe('authenticateWebSocketRequest', () => {
    describe('anonymous connections', () => {
      it('allows connection without token', () => {
        const req = createMockRequest({ url: '/ws' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBeUndefined();
        expect(result.error).toBeUndefined();
      });

      it('allows connection with empty query string', () => {
        const req = createMockRequest({ url: '/ws?' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
      });
    });

    describe('token extraction from query string', () => {
      it('extracts token from query string', () => {
        const token = createMockJwt({ sub: 'user-123' });
        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-123');
      });

      it('handles URL-encoded token', () => {
        const token = createMockJwt({ sub: 'user-456' });
        const encodedToken = encodeURIComponent(token);
        const req = createMockRequest({ url: `/ws?token=${encodedToken}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-456');
      });
    });

    describe('token extraction from Sec-WebSocket-Protocol header', () => {
      it('extracts token from protocol header', () => {
        const token = createMockJwt({ sub: 'user-789' });
        const req = createMockRequest({
          url: '/ws',
          protocol: `token.${token}`,
        });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-789');
      });

      it('extracts token from multiple protocols', () => {
        const token = createMockJwt({ sub: 'user-abc' });
        const req = createMockRequest({
          url: '/ws',
          protocol: `graphql-ws, token.${token}`,
        });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-abc');
      });

      it('prioritizes query string over protocol header', () => {
        const queryToken = createMockJwt({ sub: 'query-user' });
        const headerToken = createMockJwt({ sub: 'header-user' });
        const req = createMockRequest({
          url: `/ws?token=${queryToken}`,
          protocol: `token.${headerToken}`,
        });

        const result = authenticateWebSocketRequest(req);

        expect(result.userId).toBe('query-user');
      });
    });

    describe('token format validation', () => {
      it('rejects token with less than 3 parts', () => {
        const req = createMockRequest({ url: '/ws?token=invalid.token' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });

      it('rejects token with more than 3 parts', () => {
        const req = createMockRequest({ url: '/ws?token=a.b.c.d' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });

      it('rejects token with empty parts', () => {
        const req = createMockRequest({ url: '/ws?token=header..signature' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });

      it('rejects token with invalid base64url characters', () => {
        const req = createMockRequest({ url: '/ws?token=header!.payload@.signature#' });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });
    });

    describe('user ID extraction', () => {
      it('extracts userId from sub claim', () => {
        const token = createMockJwt({ sub: 'user-from-sub' });
        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.userId).toBe('user-from-sub');
      });

      it('extracts userId from userId claim', () => {
        const token = createMockJwt({ userId: 'user-from-claim' });
        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.userId).toBe('user-from-claim');
      });

      it('prefers sub over userId when both present', () => {
        const token = createMockJwt({ sub: 'from-sub', userId: 'from-userId' });
        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.userId).toBe('from-sub');
      });

      it('rejects token with no user identifier', () => {
        const token = createMockJwt({ name: 'Test User', email: 'test@example.com' });
        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token payload');
      });

      it('handles malformed JSON payload gracefully', () => {
        // Create token with valid base64url but invalid JSON
        const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
        const invalidPayload = Buffer.from('not-json').toString('base64url');
        const signature = 'signature';
        const token = `${header}.${invalidPayload}.${signature}`;

        const req = createMockRequest({ url: `/ws?token=${token}` });

        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token payload');
      });
    });
  });

  describe('requiresAuthentication', () => {
    it('returns false for all rooms in MVP', () => {
      expect(requiresAuthentication('bill:hr-1234')).toBe(false);
      expect(requiresAuthentication('vote:abc123')).toBe(false);
      expect(requiresAuthentication('user:private-room')).toBe(false);
    });
  });
});
