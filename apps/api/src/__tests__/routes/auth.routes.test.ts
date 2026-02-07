/**
 * Auth Routes Integration Tests
 *
 * Tests authentication endpoints including registration, login, token refresh,
 * logout, profile management, sessions, and OAuth flows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// =============================================================================
// Mocks - MUST be defined BEFORE imports
// =============================================================================

// Mock auth service
vi.mock('../../services/auth.service.js', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    getSessions: vi.fn(),
    revokeSession: vi.fn(),
  },
}));

// Mock OAuth service
vi.mock('../../services/oauth.service.js', () => ({
  oauthService: {
    getEnabledProviders: vi.fn(),
    getGoogleAuthUrl: vi.fn(),
    getGitHubAuthUrl: vi.fn(),
    handleGoogleCallback: vi.fn(),
    handleGitHubCallback: vi.fn(),
  },
}));

// Mock auth middleware - use X-Test-User header injection
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    // Inject user from test header
    if (req.headers['x-test-user']) {
      try {
        req.user = JSON.parse(req.headers['x-test-user'] as string);
      } catch {
        // Invalid JSON, leave req.user undefined
      }
    }
    next();
  },
}));

// Mock rate limiter as passthrough
vi.mock('../../middleware/authRateLimiter.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock account lockout as passthrough
vi.mock('../../middleware/accountLockout.js', () => ({
  accountLockout: (_req: any, _res: any, next: any) => next(),
  trackLoginAttempt: vi.fn().mockResolvedValue(undefined),
}));

// Mock validateRedirectUrl - default to allowing all
vi.mock('../../middleware/validateRedirectUrl.js', () => ({
  validateRedirectUrl: vi.fn().mockReturnValue(true),
}));

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    nodeEnv: 'test',
    corsOrigins: ['http://localhost:3000'],
  },
}));

// =============================================================================
// Imports - AFTER mocks
// =============================================================================

import { authRouter } from '../../routes/auth.js';
import { authService } from '../../services/auth.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { trackLoginAttempt } from '../../middleware/accountLockout.js';
import { validateRedirectUrl } from '../../middleware/validateRedirectUrl.js';
import { errorHandler } from '../../middleware/error.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create test Express app with auth router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRouter);
  app.use(errorHandler);
  return app;
}

/**
 * Helper for authenticated requests
 */
function asUser(
  req: request.Test,
  user = { id: 'user-1', email: 'test@example.com', name: 'Test User' }
) {
  return req.set('X-Test-User', JSON.stringify(user));
}

/**
 * Helper to extract cookie from response
 */
function getCookieValue(response: request.Response, cookieName: string): string | null {
  const cookies = response.headers['set-cookie'];
  if (!cookies) return null;

  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const cookie = cookieArray.find((c) => c.startsWith(`${cookieName}=`));
  if (!cookie) return null;

  const match = cookie.match(/^[^=]+=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Helper to check if cookie has HttpOnly flag
 */
function isCookieHttpOnly(response: request.Response, cookieName: string): boolean {
  const cookies = response.headers['set-cookie'];
  if (!cookies) return false;

  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const cookie = cookieArray.find((c) => c.startsWith(`${cookieName}=`));
  return cookie ? cookie.includes('HttpOnly') : false;
}

// =============================================================================
// Tests
// =============================================================================

describe('Auth Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ===========================================================================
  // POST /register
  // ===========================================================================

  describe('POST /api/v1/auth/register', () => {
    it('returns 201 with user and accessToken on success', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user' as const,
      };
      const mockTokens = {
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-xyz',
        accessTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
        refreshTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
      };

      vi.mocked(authService.register).mockResolvedValue({
        success: true,
        user: mockUser,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user: mockUser,
        accessToken: 'access-token-xyz',
        expiresAt: '2024-12-31T23:59:59.000Z',
      });
    });

    it('sets refreshToken httpOnly cookie on success', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test', role: 'user' as const },
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh-token-secure',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(201);
      const cookieValue = getCookieValue(response, 'refreshToken');
      expect(cookieValue).toBe('refresh-token-secure');
      expect(isCookieHttpOnly(response, 'refreshToken')).toBe(true);
    });

    it('returns 409 for email_exists error', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        success: false,
        error: 'email_exists',
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: 'email_exists',
        message: 'Email already registered',
      });
    });

    it('returns 400 for password_weak error', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        success: false,
        error: 'password_weak',
        details: ['Password must contain uppercase, lowercase, and numbers'],
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weakpass', // 8 chars to pass validation, but weak
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'password_weak',
        message: 'Password does not meet requirements',
      });
    });

    it('returns 400 for password_common error', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        success: false,
        error: 'password_common',
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'password_common',
        message: 'Password is too common',
      });
    });

    it('returns 400 for invalid email (validation)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details?.errors).toBeDefined();
    });

    it('returns 400 for short password (validation)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details?.errors).toBeDefined();
    });

    it('returns 500 for internal error', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        success: false,
        error: 'internal',
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'internal',
        message: 'Registration failed',
      });
    });
  });

  // ===========================================================================
  // POST /login
  // ===========================================================================

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with user and accessToken on success', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user' as const,
      };
      const mockTokens = {
        accessToken: 'access-token-xyz',
        refreshToken: 'refresh-token-xyz',
        accessTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
        refreshTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
      };

      vi.mocked(authService.login).mockResolvedValue({
        success: true,
        user: mockUser,
        tokens: mockTokens,
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'CorrectPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockUser,
        accessToken: 'access-token-xyz',
        expiresAt: '2024-12-31T23:59:59.000Z',
      });
    });

    it('sets refreshToken httpOnly cookie on success', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test', role: 'user' as const },
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh-token-secure',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'CorrectPassword123!',
        });

      expect(response.status).toBe(200);
      const cookieValue = getCookieValue(response, 'refreshToken');
      expect(cookieValue).toBe('refresh-token-secure');
      expect(isCookieHttpOnly(response, 'refreshToken')).toBe(true);
    });

    it('calls trackLoginAttempt with success=true', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test', role: 'user' as const },
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      } as any);

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'CorrectPassword123!',
        });

      expect(vi.mocked(trackLoginAttempt)).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        true
      );
    });

    it('returns 401 for invalid_credentials and calls trackLoginAttempt(false)', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: false,
        error: 'invalid_credentials',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      });
      expect(vi.mocked(trackLoginAttempt)).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        false
      );
    });

    it('returns 403 for account_inactive', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: false,
        error: 'account_inactive',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'account_inactive',
        message: 'Account is inactive',
      });
    });

    it('returns 429 for account_locked', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: false,
        error: 'account_locked',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'locked@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: 'account_locked',
        message: 'Too many requests. Please try again later.',
      });
    });

    it('returns 400 for missing email (validation)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('returns 500 for internal error', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        success: false,
        error: 'internal',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'internal',
        message: 'Login failed',
      });
    });
  });

  // ===========================================================================
  // POST /refresh
  // ===========================================================================

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 200 with new accessToken when valid cookie', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        success: true,
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          accessTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
          refreshTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: 'new-access-token',
        expiresAt: '2024-12-31T23:59:59.000Z',
      });
    });

    it('sets new refreshToken cookie on rotation', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        success: true,
        tokens: {
          accessToken: 'new-access',
          refreshToken: 'rotated-refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=old-refresh-token');

      expect(response.status).toBe(200);
      const cookieValue = getCookieValue(response, 'refreshToken');
      expect(cookieValue).toBe('rotated-refresh-token');
    });

    it('returns 401 when no refreshToken cookie', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'no_refresh_token',
        message: 'No refresh token provided',
      });
      expect(vi.mocked(authService.refresh)).not.toHaveBeenCalled();
    });

    it('returns 401 for expired_token and clears cookie', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        success: false,
        error: 'expired_token',
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'expired_token',
        message: 'Refresh token expired',
      });

      // Check cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c) =>
        c.startsWith('refreshToken=')
      );
      expect(refreshCookie).toBeDefined();
      // Cookie should be cleared (empty value or Max-Age=0)
      expect(refreshCookie).toMatch(/refreshToken=;|Max-Age=0/);
    });

    it('returns 401 for revoked_token and clears cookie', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        success: false,
        error: 'revoked_token',
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=revoked-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'revoked_token',
        message: 'Refresh token has been revoked',
      });

      // Check cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('returns 500 for internal error', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        success: false,
        error: 'internal',
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'internal',
        message: 'Token refresh failed',
      });
    });
  });

  // ===========================================================================
  // POST /logout
  // ===========================================================================

  describe('POST /api/v1/auth/logout', () => {
    it('returns 200 with success=true and clears cookie when cookie present', async () => {
      vi.mocked(authService.logout).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Check cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('calls authService.logout with the token', async () => {
      vi.mocked(authService.logout).mockResolvedValue(true);

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=my-token-123');

      expect(vi.mocked(authService.logout)).toHaveBeenCalledWith('my-token-123');
    });

    it('returns 200 with success=true even without cookie (idempotent)', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(vi.mocked(authService.logout)).not.toHaveBeenCalled();
    });

    it('clears cookie on logout', async () => {
      vi.mocked(authService.logout).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=token-to-clear');

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c) =>
        c.startsWith('refreshToken=')
      );
      expect(refreshCookie).toBeDefined();
    });
  });

  // ===========================================================================
  // POST /logout-all
  // ===========================================================================

  describe('POST /api/v1/auth/logout-all', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app).post('/api/v1/auth/logout-all');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with success=true and sessionsRevoked count for authenticated user', async () => {
      vi.mocked(authService.logoutAll).mockResolvedValue(3);

      const response = await asUser(request(app).post('/api/v1/auth/logout-all'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        sessionsRevoked: 3,
      });
      expect(vi.mocked(authService.logoutAll)).toHaveBeenCalledWith('user-1');
    });

    it('clears current cookie', async () => {
      vi.mocked(authService.logoutAll).mockResolvedValue(2);

      const response = await asUser(
        request(app)
          .post('/api/v1/auth/logout-all')
          .set('Cookie', 'refreshToken=current-token')
      );

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });

  // ===========================================================================
  // GET /me
  // ===========================================================================

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with profile for authenticated user', async () => {
      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: true,
      };
      vi.mocked(authService.getProfile).mockResolvedValue(mockProfile as any);

      const response = await asUser(request(app).get('/api/v1/auth/me'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProfile);
    });

    it('returns 404 when profile not found (user deleted)', async () => {
      vi.mocked(authService.getProfile).mockResolvedValue(null);

      const response = await asUser(request(app).get('/api/v1/auth/me'));

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('calls authService.getProfile with user.id', async () => {
      vi.mocked(authService.getProfile).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: true,
      } as any);

      await asUser(request(app).get('/api/v1/auth/me'));

      expect(vi.mocked(authService.getProfile)).toHaveBeenCalledWith('user-1');
    });
  });

  // ===========================================================================
  // PATCH /me
  // ===========================================================================

  describe('PATCH /api/v1/auth/me', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/me')
        .send({ name: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with updated profile', async () => {
      const mockUpdatedProfile = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
      };
      vi.mocked(authService.updateProfile).mockResolvedValue(mockUpdatedProfile as any);

      const response = await asUser(
        request(app)
          .patch('/api/v1/auth/me')
          .send({
            name: 'Updated Name',
            avatarUrl: 'https://example.com/avatar.jpg',
          })
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUpdatedProfile);
    });

    it('returns 400 for invalid avatarUrl', async () => {
      const response = await asUser(
        request(app)
          .patch('/api/v1/auth/me')
          .send({
            avatarUrl: 'not-a-url',
          })
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('only sends provided fields to service', async () => {
      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'New Name',
        avatarUrl: null,
        emailVerified: true,
      };
      vi.mocked(authService.updateProfile).mockResolvedValue(mockProfile as any);

      await asUser(
        request(app)
          .patch('/api/v1/auth/me')
          .send({ name: 'New Name' })
      );

      expect(vi.mocked(authService.updateProfile)).toHaveBeenCalledWith('user-1', {
        name: 'New Name',
      });
    });
  });

  // ===========================================================================
  // POST /change-password
  // ===========================================================================

  describe('POST /api/v1/auth/change-password', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with success=true on success', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue({ success: true });

      const response = await asUser(
        request(app)
          .post('/api/v1/auth/change-password')
          .send({
            currentPassword: 'OldPass123!',
            newPassword: 'NewPass123!',
          })
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('returns 400 for password_change_failed', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue({
        success: false,
        error: 'Current password is incorrect',
      });

      const response = await asUser(
        request(app)
          .post('/api/v1/auth/change-password')
          .send({
            currentPassword: 'WrongPass',
            newPassword: 'NewPass123!',
          })
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'password_change_failed',
        message: 'Current password is incorrect',
      });
    });

    it('returns 400 for missing currentPassword (validation)', async () => {
      const response = await asUser(
        request(app)
          .post('/api/v1/auth/change-password')
          .send({
            newPassword: 'NewPass123!',
          })
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('returns 400 for short newPassword (validation)', async () => {
      const response = await asUser(
        request(app)
          .post('/api/v1/auth/change-password')
          .send({
            currentPassword: 'OldPass123!',
            newPassword: 'short',
          })
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // GET /sessions
  // ===========================================================================

  describe('GET /api/v1/auth/sessions', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app).get('/api/v1/auth/sessions');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with sessions array', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'session-2',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];
      vi.mocked(authService.getSessions).mockResolvedValue(mockSessions as any);

      const response = await asUser(request(app).get('/api/v1/auth/sessions'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ sessions: mockSessions });
      expect(vi.mocked(authService.getSessions)).toHaveBeenCalledWith('user-1');
    });
  });

  // ===========================================================================
  // DELETE /sessions/:sessionId
  // ===========================================================================

  describe('DELETE /api/v1/auth/sessions/:sessionId', () => {
    it('returns 401 without auth', async () => {
      const response = await request(app).delete('/api/v1/auth/sessions/session-123');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('returns 200 with success=true when session revoked', async () => {
      vi.mocked(authService.revokeSession).mockResolvedValue(true);

      const response = await asUser(
        request(app).delete('/api/v1/auth/sessions/session-123')
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(vi.mocked(authService.revokeSession)).toHaveBeenCalledWith(
        'user-1',
        'session-123'
      );
    });

    it('returns 404 when session not found or not owned', async () => {
      vi.mocked(authService.revokeSession).mockResolvedValue(false);

      const response = await asUser(
        request(app).delete('/api/v1/auth/sessions/session-999')
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  // ===========================================================================
  // GET /providers
  // ===========================================================================

  describe('GET /api/v1/auth/providers', () => {
    it('returns 200 with enabled providers', async () => {
      const mockProviders = { google: true, github: false };
      vi.mocked(oauthService.getEnabledProviders).mockReturnValue(mockProviders);

      const response = await request(app).get('/api/v1/auth/providers');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProviders);
    });
  });

  // ===========================================================================
  // GET /google
  // ===========================================================================

  describe('GET /api/v1/auth/google', () => {
    it('returns redirect when Google enabled', async () => {
      const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...';
      vi.mocked(oauthService.getGoogleAuthUrl).mockReturnValue(mockAuthUrl);
      vi.mocked(validateRedirectUrl).mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/auth/google')
        .query({ redirectUrl: 'http://localhost:3000/dashboard' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(mockAuthUrl);
    });

    it('returns 503 when Google disabled', async () => {
      vi.mocked(oauthService.getGoogleAuthUrl).mockReturnValue(null);
      vi.mocked(validateRedirectUrl).mockReturnValue(true);

      const response = await request(app).get('/api/v1/auth/google');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'provider_disabled',
        message: 'Google OAuth is not configured',
      });
    });

    it('returns 400 for invalid redirect URL', async () => {
      vi.mocked(validateRedirectUrl).mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/auth/google')
        .query({ redirectUrl: 'https://evil.com' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'invalid_redirect',
        message: 'Invalid redirect URL. Must be a trusted domain.',
      });
    });
  });

  // ===========================================================================
  // GET /google/callback
  // ===========================================================================

  describe('GET /api/v1/auth/google/callback', () => {
    it('returns 200 with user+accessToken on success and sets cookie', async () => {
      const mockResult = {
        success: true as const,
        user: { id: 'user-123', email: 'oauth@example.com', name: 'OAuth User', avatarUrl: null, emailVerified: true, role: 'user' as const },
        tokens: {
          accessToken: 'oauth-access-token',
          refreshToken: 'oauth-refresh-token',
          accessTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
          refreshTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
        },
      };
      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: 'auth-code-123', state: 'state-token-456' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockResult.user,
        accessToken: 'oauth-access-token',
        expiresAt: '2024-12-31T23:59:59.000Z',
      });

      const cookieValue = getCookieValue(response, 'refreshToken');
      expect(cookieValue).toBe('oauth-refresh-token');
    });

    it('returns 400 for oauth_error query param', async () => {
      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'oauth_error',
        message: 'OAuth error: access_denied',
      });
    });

    it('returns 400 for missing code/state', async () => {
      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: 'auth-code' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'invalid_request',
        message: 'Missing code or state parameter',
      });
    });

    it('returns appropriate error status for service failures', async () => {
      vi.mocked(oauthService.handleGoogleCallback).mockResolvedValue({
        success: false,
        error: 'email_not_verified',
        message: 'Email must be verified',
      });

      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: 'auth-code', state: 'state-token' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'email_not_verified',
        message: 'Email must be verified',
      });
    });
  });

  // ===========================================================================
  // GET /github
  // ===========================================================================

  describe('GET /api/v1/auth/github', () => {
    it('returns redirect when GitHub enabled', async () => {
      const mockAuthUrl = 'https://github.com/login/oauth/authorize?client_id=...';
      vi.mocked(oauthService.getGitHubAuthUrl).mockReturnValue(mockAuthUrl);
      vi.mocked(validateRedirectUrl).mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/auth/github')
        .query({ redirectUrl: 'http://localhost:3000/dashboard' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(mockAuthUrl);
    });

    it('returns 503 when GitHub disabled', async () => {
      vi.mocked(oauthService.getGitHubAuthUrl).mockReturnValue(null);
      vi.mocked(validateRedirectUrl).mockReturnValue(true);

      const response = await request(app).get('/api/v1/auth/github');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'provider_disabled',
        message: 'GitHub OAuth is not configured',
      });
    });

    it('returns 400 for invalid redirect URL', async () => {
      vi.mocked(validateRedirectUrl).mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/auth/github')
        .query({ redirectUrl: 'https://evil.com' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'invalid_redirect',
        message: 'Invalid redirect URL. Must be a trusted domain.',
      });
    });
  });

  // ===========================================================================
  // GET /github/callback
  // ===========================================================================

  describe('GET /api/v1/auth/github/callback', () => {
    it('returns 200 with user+accessToken on success and sets cookie', async () => {
      const mockResult = {
        success: true as const,
        user: { id: 'user-456', email: 'github@example.com', name: 'GitHub User', avatarUrl: null, emailVerified: true, role: 'user' as const },
        tokens: {
          accessToken: 'github-access-token',
          refreshToken: 'github-refresh-token',
          accessTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
          refreshTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
        },
      };
      vi.mocked(oauthService.handleGitHubCallback).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/v1/auth/github/callback')
        .query({ code: 'auth-code-789', state: 'state-token-abc' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockResult.user,
        accessToken: 'github-access-token',
        expiresAt: '2024-12-31T23:59:59.000Z',
      });

      const cookieValue = getCookieValue(response, 'refreshToken');
      expect(cookieValue).toBe('github-refresh-token');
    });

    it('returns 400 for oauth_error query param', async () => {
      const response = await request(app)
        .get('/api/v1/auth/github/callback')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'oauth_error',
        message: 'OAuth error: access_denied',
      });
    });

    it('returns 400 for missing code/state', async () => {
      const response = await request(app)
        .get('/api/v1/auth/github/callback')
        .query({ state: 'state-only' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'invalid_request',
        message: 'Missing code or state parameter',
      });
    });

    it('returns appropriate error status for service failures', async () => {
      vi.mocked(oauthService.handleGitHubCallback).mockResolvedValue({
        success: false,
        error: 'email_required',
        message: 'Email is required',
      });

      const response = await request(app)
        .get('/api/v1/auth/github/callback')
        .query({ code: 'auth-code', state: 'state-token' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'email_required',
        message: 'Email is required',
      });
    });
  });
});
