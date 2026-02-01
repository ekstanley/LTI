/**
 * CSRF Middleware Tests
 * @module middleware/__tests__/csrf.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection, csrfProtectionOptional, getCsrfToken } from '../csrf.js';
import * as csrfService from '../../services/csrf.service.js';

// Mock dependencies
vi.mock('../../services/csrf.service.js');
vi.mock('../../config.js', () => ({
  config: { nodeEnv: 'production' },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface RequestWithSession extends Request {
  session?: { id: string };
}

describe('CSRF Middleware', () => {
  let mockReq: Partial<RequestWithSession>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/api/test',
      headers: {},
      session: { id: 'test-session-123' },
    };
    mockRes = {
      setHeader: vi.fn(),
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('csrfProtection()', () => {
    it('should allow GET requests without CSRF token', async () => {
      mockReq.method = 'GET';

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(csrfService.validateCsrfToken).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', async () => {
      mockReq.method = 'HEAD';

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow OPTIONS requests without CSRF token', async () => {
      mockReq.method = 'OPTIONS';

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject POST without session', async () => {
      delete mockReq.session;

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: expect.stringContaining('Authentication required'),
      }));
    });

    it('should reject POST without CSRF token', async () => {
      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'CSRF token required',
      }));
    });

    it('should reject POST with invalid CSRF token', async () => {
      mockReq.headers = { 'x-csrf-token': 'invalid-token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(false);

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalledWith('test-session-123', 'invalid-token');
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('Invalid or expired'),
      }));
    });

    it('should validate and rotate CSRF token on POST', async () => {
      const validToken = 'valid-token-123';
      const newToken = 'new-token-456';
      mockReq.headers = { 'x-csrf-token': validToken };

      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue(newToken);

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalledWith('test-session-123', validToken);
      expect(csrfService.invalidateCsrfToken).toHaveBeenCalledWith('test-session-123', validToken);
      expect(csrfService.generateCsrfToken).toHaveBeenCalledWith('test-session-123');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', newToken);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should protect PUT requests', async () => {
      mockReq.method = 'PUT';
      mockReq.headers = { 'x-csrf-token': 'valid-token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue('new-token');

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should protect PATCH requests', async () => {
      mockReq.method = 'PATCH';
      mockReq.headers = { 'x-csrf-token': 'valid-token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue('new-token');

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalled();
    });

    it('should protect DELETE requests', async () => {
      mockReq.method = 'DELETE';
      mockReq.headers = { 'x-csrf-token': 'valid-token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue('new-token');

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalled();
    });

    it('should handle validation errors gracefully', async () => {
      mockReq.headers = { 'x-csrf-token': 'token' };
      vi.mocked(csrfService.validateCsrfToken).mockRejectedValue(new Error('Redis error'));

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 500,
      }));
    });

    it('should handle token rotation errors', async () => {
      mockReq.headers = { 'x-csrf-token': 'token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockRejectedValue(new Error('Generation failed'));

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate token after successful validation', async () => {
      mockReq.headers = { 'x-csrf-token': 'token-123' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue('new-token');

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.invalidateCsrfToken).toHaveBeenCalledWith('test-session-123', 'token-123');
    });

    it('should reject array header values', async () => {
      mockReq.headers = { 'x-csrf-token': ['token1', 'token2'] };

      await csrfProtection(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'CSRF token required',
      }));
    });
  });

  describe('csrfProtectionOptional()', () => {
    it('should allow requests without session', async () => {
      delete mockReq.session;

      await csrfProtectionOptional(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(csrfService.validateCsrfToken).not.toHaveBeenCalled();
    });

    it('should allow requests with session but no token', async () => {
      await csrfProtectionOptional(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(csrfService.validateCsrfToken).not.toHaveBeenCalled();
    });

    it('should validate token if provided', async () => {
      mockReq.headers = { 'x-csrf-token': 'token-123' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(true);
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue('new-token');

      await csrfProtectionOptional(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(csrfService.validateCsrfToken).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid token if provided', async () => {
      mockReq.headers = { 'x-csrf-token': 'bad-token' };
      vi.mocked(csrfService.validateCsrfToken).mockResolvedValue(false);

      await csrfProtectionOptional(mockReq as RequestWithSession, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
      }));
    });
  });

  describe('getCsrfToken()', () => {
    it('should generate token for authenticated request', async () => {
      const newToken = 'generated-token-789';
      vi.mocked(csrfService.generateCsrfToken).mockResolvedValue(newToken);

      await getCsrfToken(mockReq as RequestWithSession, mockRes as Response);

      expect(csrfService.generateCsrfToken).toHaveBeenCalledWith('test-session-123');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-CSRF-Token', newToken);
      expect(mockRes.json).toHaveBeenCalledWith({ csrfToken: newToken });
    });

    it('should require authentication', async () => {
      delete mockReq.session;

      await expect(
        getCsrfToken(mockReq as RequestWithSession, mockRes as Response)
      ).rejects.toThrow();
    });

    it('should handle generation errors', async () => {
      vi.mocked(csrfService.generateCsrfToken).mockRejectedValue(new Error('Failed'));

      await expect(
        getCsrfToken(mockReq as RequestWithSession, mockRes as Response)
      ).rejects.toThrow();
    });
  });
});
