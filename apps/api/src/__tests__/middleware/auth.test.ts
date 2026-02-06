/**
 * Authentication Middleware Tests
 *
 * Tests for requireAuth, optionalAuth, and requireEmailVerified middleware.
 * Ensures JWT-based authentication works correctly with proper fail-closed security.
 *
 * Security contracts:
 * - requireAuth: Guarantees req.user defined or responds 401
 * - optionalAuth: Never returns 401, but returns 500 on unexpected errors (fail closed)
 * - requireEmailVerified: Requires email verification after requireAuth
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { requireAuth, optionalAuth, requireEmailVerified } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/error.js';
import type { AuthenticatedUser } from '../../types/express.js';

// Mock dependencies
vi.mock('../../services/jwt.service.js', () => ({
  jwtService: {
    verifyAccessToken: vi.fn(),
  },
}));

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules for type-safe access
import { jwtService } from '../../services/jwt.service.js';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

// Helper to create test Express app
function createTestApp(middleware: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.get('/test', middleware, (req, res) => {
    res.json({ user: req.user });
  });
  app.use(errorHandler);
  return app;
}

// Mock data
const mockUser: AuthenticatedUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  emailVerified: true,
  isActive: true,
  rateLimit: 100,
};

const mockUnverifiedUser: AuthenticatedUser = {
  ...mockUser,
  emailVerified: false,
};

const mockInactiveUser = {
  ...mockUser,
  isActive: false,
};

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('calls next with user attached for valid Bearer token', async () => {
      // Mock successful token verification
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      // Mock user lookup
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ user: mockUser });
      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('valid-token-123');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          emailVerified: true,
          isActive: true,
          rateLimit: true,
        },
      });
    });

    it('returns 401 when no Authorization header', async () => {
      const app = createTestApp(requireAuth);

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(jwtService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('returns 401 for non-Bearer auth scheme', async () => {
      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(jwtService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('returns 401 for malformed Bearer header (empty token)', async () => {
      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      expect(jwtService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('returns 401 for expired token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'expired',
      });

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Token has expired',
      });
    });

    it('returns 401 for invalid token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'invalid',
      });

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    });

    it('returns 401 for malformed token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'malformed',
      });

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer malformed-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Malformed token',
      });
    });

    it('returns 401 for revoked token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'revoked',
      });

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer revoked-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Token has been revoked',
      });
    });

    it('returns 401 when user not found in database', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'nonexistent-user', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'User account not found or inactive',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        { userId: 'nonexistent-user' },
        'Token valid but user not found/inactive'
      );
    });

    it('returns 401 when user is inactive', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockInactiveUser as any);

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'User account not found or inactive',
      });
    });

    it('returns 401 on unexpected verification error (fail closed)', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Unexpected JWT verification error');
      });

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer token-causing-error');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Unexpected error in requireAuth middleware'
      );
    });

    it('attaches full user object to req.user', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = createTestApp(requireAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(mockUser);
      // Verify all expected fields are present
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('avatarUrl');
      expect(response.body.user).toHaveProperty('emailVerified');
      expect(response.body.user).toHaveProperty('isActive');
      expect(response.body.user).toHaveProperty('rateLimit');
    });
  });

  describe('optionalAuth', () => {
    it('attaches user for valid token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ user: mockUser });
    });

    it('calls next without user when no Authorization header', async () => {
      const app = createTestApp(optionalAuth);

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
      expect(jwtService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('calls next without user for invalid token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'invalid',
      });

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        { error: 'invalid' },
        'Optional auth: invalid token, continuing unauthenticated'
      );
    });

    it('calls next without user for expired token', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: false,
        error: 'expired',
      });

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        { error: 'expired' },
        'Optional auth: invalid token, continuing unauthenticated'
      );
    });

    it('calls next without user when user not found in DB', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'nonexistent-user', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        { userId: 'nonexistent-user' },
        'Optional auth: user not found, continuing unauthenticated'
      );
    });

    it('calls next without user when user is inactive', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockInactiveUser as any);

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        { userId: 'user-123' },
        'Optional auth: user not found, continuing unauthenticated'
      );
    });

    it('SECURITY: fails with 500 on unexpected errors (not silent downgrade)', async () => {
      // Simulate unexpected error in token verification
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Unexpected database connection error');
      });

      const app = createTestApp(optionalAuth);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer token-causing-error');

      // CRITICAL: Must return 500, not 200 with no user
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Authentication service temporarily unavailable',
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Unexpected error in optionalAuth middleware'
      );
    });
  });

  describe('requireEmailVerified', () => {
    it('calls next when email is verified', () => {
      const mockReq = {
        user: mockUser,
      } as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      requireEmailVerified(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('returns 403 when email not verified', () => {
      const mockReq = {
        user: mockUnverifiedUser,
      } as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      requireEmailVerified(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Email verification required',
        })
      );
    });

    it('returns 401 when no user (middleware used without requireAuth)', () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      requireEmailVerified(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      );
    });

    it('works correctly when chained after requireAuth', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = express();
      app.use(express.json());
      app.get('/test', requireAuth, requireEmailVerified, (req, res) => {
        res.json({ user: req.user });
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user.emailVerified).toBe(true);
    });

    it('blocks unverified email when chained after requireAuth', async () => {
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue({
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com', type: 'access' },
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUnverifiedUser as any);

      const app = express();
      app.use(express.json());
      app.get('/test', requireAuth, requireEmailVerified, (req, res) => {
        res.json({ user: req.user });
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Email verification required',
      });
    });
  });
});
