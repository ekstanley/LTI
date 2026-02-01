/**
 * Authentication Rate Limiter Tests
 *
 * Tests for authRateLimiter middleware to prevent brute force attacks on auth endpoints (CWE-307).
 * Ensures IP-based rate limiting works correctly to protect login and registration endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authRateLimiter } from '../../middleware/authRateLimiter.js';

// Mock logger to avoid noise in tests
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('authRateLimiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/test/auth',
      headers: {},
      ip: '127.0.0.1',
    };
    mockRes = {
      setHeader: vi.fn(),
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rate limit enforcement', () => {
    it('allows requests under the limit (5 requests per 15 minutes)', async () => {
      const clientIp = '192.168.1.100';

      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: { 'x-forwarded-for': clientIp },
          ip: clientIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalledWith(429);
      }
    });

    it('blocks requests over the limit (6th request)', async () => {
      const clientIp = '192.168.1.101';

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: { 'x-forwarded-for': clientIp },
          ip: clientIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
        expect(next).toHaveBeenCalledWith();
      }

      // 6th request should be rate limited
      const req = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp, 'user-agent': 'test-agent' },
        ip: clientIp,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        code: 'TOO_MANY_AUTH_ATTEMPTS',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('includes rate limit headers in responses', async () => {
      const clientIp = '192.168.1.102';

      const req = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(String));
      expect(next).toHaveBeenCalledWith();
    });

    it('decrements remaining count with each request', async () => {
      const clientIp = '192.168.1.103';

      // First request - should have 4 remaining
      const req1 = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
      } as Request;
      const res1 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next1 = vi.fn();

      await authRateLimiter(req1, res1, next1);

      expect(next1).toHaveBeenCalledWith();
      expect(res1.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '5');
      expect(res1.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '4');

      // Second request - should have 3 remaining
      const req2 = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
      } as Request;
      const res2 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next2 = vi.fn();

      await authRateLimiter(req2, res2, next2);

      expect(next2).toHaveBeenCalledWith();
      expect(res2.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '3');

      // Third request - should have 2 remaining
      const req3 = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
      } as Request;
      const res3 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next3 = vi.fn();

      await authRateLimiter(req3, res3, next3);

      expect(next3).toHaveBeenCalledWith();
      expect(res3.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '2');
    });
  });

  describe('IP-based isolation', () => {
    it('tracks rate limits independently per IP address', async () => {
      const clientIp1 = '192.168.1.104';
      const clientIp2 = '192.168.1.105';

      // Exhaust rate limit for first IP
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: { 'x-forwarded-for': clientIp1 },
          ip: clientIp1,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
        expect(next).toHaveBeenCalledWith();
      }

      // 6th request from first IP should be blocked
      const req1 = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp1, 'user-agent': 'test' },
        ip: clientIp1,
      } as Request;
      const res1 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next1 = vi.fn();

      await authRateLimiter(req1, res1, next1);
      expect(res1.status).toHaveBeenCalledWith(429);

      // First request from second IP should succeed (independent limit)
      const req2 = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp2 },
        ip: clientIp2,
      } as Request;
      const res2 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next2 = vi.fn();

      await authRateLimiter(req2, res2, next2);

      expect(next2).toHaveBeenCalledWith();
      expect(res2.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '4');
    });

    it('handles X-Forwarded-For header with multiple IPs (takes first)', async () => {
      // X-Forwarded-For: client, proxy1, proxy2
      const forwardedFor = '192.168.1.106, 10.0.0.1, 10.0.0.2';
      const expectedClientIp = '192.168.1.106';

      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: { 'x-forwarded-for': forwardedFor },
          ip: expectedClientIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
        expect(next).toHaveBeenCalledWith();
      }

      // 6th request should be blocked (same client IP)
      const req = {
        ...mockReq,
        headers: { 'x-forwarded-for': forwardedFor, 'user-agent': 'test' },
        ip: expectedClientIp,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('falls back to req.ip when X-Forwarded-For is not present', async () => {
      const defaultIp = '::ffff:127.0.0.1';

      // Make 5 requests without X-Forwarded-For header
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: {},
          ip: defaultIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
        expect(next).toHaveBeenCalledWith();
      }

      // 6th request should be blocked
      const req = {
        ...mockReq,
        headers: { 'user-agent': 'test' },
        ip: defaultIp,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('edge cases', () => {
    it('handles missing IP address gracefully (uses "unknown")', async () => {
      // Request with undefined IP - should use "unknown" as key
      const req = {
        ...mockReq,
        headers: {},
        ip: undefined,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '5');
    });

    it('skips rate limiting for health check endpoint', async () => {
      const clientIp = '192.168.1.107';

      // Exhaust rate limit on non-health endpoint
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          path: '/test/auth',
          headers: { 'x-forwarded-for': clientIp },
          ip: clientIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
        expect(next).toHaveBeenCalledWith();
      }

      // Auth endpoint should be blocked
      const req1 = {
        ...mockReq,
        path: '/test/auth',
        headers: { 'x-forwarded-for': clientIp, 'user-agent': 'test' },
        ip: clientIp,
      } as Request;
      const res1 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next1 = vi.fn();

      await authRateLimiter(req1, res1, next1);
      expect(res1.status).toHaveBeenCalledWith(429);

      // Health check should NOT be rate limited (skip rule)
      const req2 = {
        ...mockReq,
        method: 'GET',
        path: '/api/health',
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
      } as Request;
      const res2 = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next2 = vi.fn();

      await authRateLimiter(req2, res2, next2);

      expect(next2).toHaveBeenCalledWith();
      expect(res2.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('security logging', () => {
    it('logs rate limit violations for security monitoring', async () => {
      const { logger } = await import('../../lib/logger.js');
      const clientIp = '192.168.1.108';

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        const req = {
          ...mockReq,
          headers: { 'x-forwarded-for': clientIp },
          ip: clientIp,
        } as Request;
        const res = {
          setHeader: vi.fn(),
          json: vi.fn(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        await authRateLimiter(req, res, next);
      }

      // Clear previous calls
      vi.clearAllMocks();

      // Trigger rate limit violation
      const req = {
        ...mockReq,
        headers: { 'x-forwarded-for': clientIp, 'user-agent': 'test-agent' },
        ip: clientIp,
      } as Request;
      const res = {
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      await authRateLimiter(req, res, next);

      // Verify security logging
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: clientIp,
          path: '/test/auth',
        }),
        'SECURITY: Auth rate limit exceeded'
      );
    });
  });
});
