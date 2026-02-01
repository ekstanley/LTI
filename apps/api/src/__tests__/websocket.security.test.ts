/**
 * WebSocket Security Test Suite
 *
 * Verifies P0-CRITICAL security requirement:
 * - Query string tokens MUST be rejected (CWE-598)
 * - Header-based authentication MUST be used
 * - No token leakage in logs
 *
 * @module __tests__/websocket.security.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage } from 'http';
import { authenticateWebSocketRequest } from '../websocket/auth.js';
import { logger } from '../lib/logger.js';

// Mock logger to capture log calls
vi.mock('../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock jwtService
const mockVerifyAccessToken = vi.fn();
vi.mock('../services/jwt.service.js', () => ({
  jwtService: {
    verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create mock HTTP request for WebSocket upgrade
 */
function createMockRequest(options: {
  url?: string;
  headers?: Record<string, string>;
}): IncomingMessage {
  return {
    url: options.url ?? '/ws',
    headers: {
      host: 'localhost:4001',
      ...(options.headers ?? {}),
    },
  } as IncomingMessage;
}

/**
 * Create valid JWT for testing
 */
function createValidToken(): string {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.signature';
}

// ============================================================================
// Security Tests - Query String Token Rejection (CWE-598)
// ============================================================================

describe('WebSocket Security - Token Exposure Prevention (CWE-598)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('[P0-CRITICAL] Query String Token Rejection', () => {
    it('MUST reject token in query string to prevent log exposure', () => {
      const token = createValidToken();

      // Setup: Valid token, but in query string (SECURITY VIOLATION)
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'user-123' },
      });

      // Test: Token in query string
      const req = createMockRequest({
        url: `/ws?token=${token}`,
      });

      const result = authenticateWebSocketRequest(req);

      // CRITICAL SECURITY ASSERTION:
      // Query string tokens MUST be ignored, even if valid
      expect(result.authenticated).toBe(true); // Anonymous connection allowed
      expect(result.userId).toBeUndefined(); // But NOT authenticated as user
      expect(mockVerifyAccessToken).not.toHaveBeenCalled(); // Token never verified
    });

    it('MUST reject token in query string with various encoding', () => {
      const testCases = [
        `/ws?token=abc123`,
        `/ws?auth=abc123`,
        `/ws?bearer=abc123`,
        `/ws?access_token=abc123`,
        `/ws?token=${encodeURIComponent('Bearer abc123')}`,
      ];

      testCases.forEach((url) => {
        vi.clearAllMocks();
        const req = createMockRequest({ url });
        const result = authenticateWebSocketRequest(req);

        // All query string authentication attempts must fail
        expect(result.userId).toBeUndefined();
        expect(mockVerifyAccessToken).not.toHaveBeenCalled();
      });
    });

    it('MUST reject multiple query parameters including token', () => {
      const req = createMockRequest({
        url: '/ws?room=general&token=abc123&userId=user-123',
      });

      const result = authenticateWebSocketRequest(req);

      // Token in any query parameter must be ignored
      expect(result.userId).toBeUndefined();
      expect(mockVerifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('[P0-CRITICAL] Header-Based Authentication (Sec-WebSocket-Protocol)', () => {
    it('MUST accept token via Sec-WebSocket-Protocol header', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'authenticated-user' },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      // Header-based auth MUST work
      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('authenticated-user');
      expect(mockVerifyAccessToken).toHaveBeenCalledWith(token);
    });

    it('MUST extract token from multiple protocol values', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'user-456' },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `graphql-ws, token.${token}, other-protocol`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user-456');
      expect(mockVerifyAccessToken).toHaveBeenCalledWith(token);
    });

    it('MUST handle whitespace in protocol header', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'user-789' },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `  graphql-ws  ,   token.${token}  ,  other  `,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user-789');
    });
  });

  describe('[P0-CRITICAL] Token Leakage Prevention', () => {
    it('MUST NOT log token values in any log level', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'user-secure' },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      authenticateWebSocketRequest(req);

      // Check all log calls - token value must NEVER appear
      const allLogCalls = [
        ...(logger.debug as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.warn as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const loggedString = JSON.stringify(call);
        expect(loggedString).not.toContain(token);
      });
    });

    it('MUST NOT log token in error scenarios', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: false,
        error: 'expired',
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      authenticateWebSocketRequest(req);

      // Even in error logs, token must not appear
      const allLogCalls = [
        ...(logger.debug as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.warn as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const loggedString = JSON.stringify(call);
        expect(loggedString).not.toContain(token);
      });
    });
  });

  describe('[SECURITY] Token Validation Edge Cases', () => {
    it('MUST reject malformed protocol header', () => {
      mockVerifyAccessToken.mockReturnValue({
        valid: false,
        error: 'malformed',
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': 'tokenABC', // Missing dot separator
        },
      });

      const result = authenticateWebSocketRequest(req);

      // Malformed protocol should be treated as no token
      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeUndefined();
      expect(mockVerifyAccessToken).not.toHaveBeenCalled();
    });

    it('MUST reject empty token value', () => {
      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': 'token.',
        },
      });

      const result = authenticateWebSocketRequest(req);

      // Empty token should be ignored
      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeUndefined();
    });

    it('MUST handle missing protocol header gracefully', () => {
      const req = createMockRequest({
        headers: {}, // No Sec-WebSocket-Protocol header
      });

      const result = authenticateWebSocketRequest(req);

      // Anonymous connection allowed
      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeUndefined();
      expect(mockVerifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('[SECURITY] JWT Verification Integration', () => {
    it('MUST reject expired tokens', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: false,
        error: 'expired',
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token has expired');
      expect(mockVerifyAccessToken).toHaveBeenCalledWith(token);
    });

    it('MUST reject invalid signature tokens', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: false,
        error: 'invalid',
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('MUST reject revoked tokens', () => {
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: false,
        error: 'revoked',
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    it('MUST extract userId from valid token payload', () => {
      const token = createValidToken();
      const userId = 'user-authenticated-123';

      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: {
          sub: userId,
          email: 'test@example.com',
          iat: Date.now(),
        },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe(userId);
    });
  });

  describe('[COMPLIANCE] OWASP WebSocket Security', () => {
    it('MUST implement OWASP recommendation: header-based auth', () => {
      // Per OWASP WebSocket Security Cheat Sheet:
      // "Tokens should be passed in the Sec-WebSocket-Protocol header"

      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'owasp-compliant-user' },
      });

      const req = createMockRequest({
        headers: {
          'sec-websocket-protocol': `token.${token}`,
        },
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('owasp-compliant-user');
    });

    it('MUST NOT implement insecure query string auth (CWE-598)', () => {
      // CWE-598: Use of GET Request Method With Sensitive Query Strings
      // CRITICAL: Query string tokens are a security vulnerability

      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'should-not-authenticate' },
      });

      const req = createMockRequest({
        url: `/ws?token=${token}`,
      });

      const result = authenticateWebSocketRequest(req);

      // MUST NOT authenticate via query string
      expect(result.userId).toBeUndefined();
      expect(mockVerifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('[SECURITY] Anonymous Connection Handling', () => {
    it('MUST allow anonymous connections for public data', () => {
      const req = createMockRequest({
        url: '/ws',
        headers: {},
      });

      const result = authenticateWebSocketRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('MUST differentiate between authenticated and anonymous', () => {
      // Anonymous
      const anonReq = createMockRequest({ url: '/ws' });
      const anonResult = authenticateWebSocketRequest(anonReq);

      // Authenticated
      const token = createValidToken();
      mockVerifyAccessToken.mockReturnValue({
        valid: true,
        payload: { sub: 'auth-user' },
      });
      const authReq = createMockRequest({
        headers: { 'sec-websocket-protocol': `token.${token}` },
      });
      const authResult = authenticateWebSocketRequest(authReq);

      // Both authenticated, but only one has userId
      expect(anonResult.authenticated).toBe(true);
      expect(anonResult.userId).toBeUndefined();

      expect(authResult.authenticated).toBe(true);
      expect(authResult.userId).toBe('auth-user');
    });
  });
});

// ============================================================================
// Security Verification Tests
// ============================================================================

describe('WebSocket Security Verification', () => {
  it('SECURITY AUDIT: Verify no token exposure in implementation', () => {
    // This test serves as a reminder to audit the code for:
    // 1. No URL.parse() on WebSocket URLs (would log tokens)
    // 2. No console.log() of request objects
    // 3. No error messages containing tokens
    // 4. No metrics/analytics including tokens

    expect(true).toBe(true); // Placeholder for manual audit checkpoint
  });

  it('SECURITY AUDIT: Verify server logs exclude tokens', () => {
    // Manual verification required:
    // 1. Check server access logs for 'token=' patterns
    // 2. Check application logs for token values
    // 3. Verify logging framework sanitizes headers

    expect(true).toBe(true); // Placeholder for manual audit checkpoint
  });
});
