/**
 * Admin Routes Integration Tests
 *
 * Tests administrative endpoints including account lockout management
 * and system monitoring. Tests both authentication/authorization and
 * integration with the account lockout service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware to inject test users
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

// Mock account lockout service
vi.mock('../../services/accountLockout.service.js', () => ({
  accountLockoutService: {
    adminUnlock: vi.fn(),
    getStats: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { adminRouter } from '../../routes/admin.js';
import { accountLockoutService } from '../../services/accountLockout.service.js';
import { logger } from '../../lib/logger.js';
import { errorHandler } from '../../middleware/error.js';

/**
 * Create test Express app with admin router mounted
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRouter);
  app.use(errorHandler);
  return app;
}

/**
 * Helper to authenticate request as admin user
 */
function asAdmin(req: request.Test) {
  return req.set(
    'X-Test-User',
    JSON.stringify({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    })
  );
}

/**
 * Helper to authenticate request as regular user
 */
function asRegularUser(req: request.Test) {
  return req.set(
    'X-Test-User',
    JSON.stringify({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Regular User',
      role: 'user',
    })
  );
}

/**
 * Helper to authenticate request with custom email
 */
function asUserWithEmail(req: request.Test, email: string) {
  return req.set(
    'X-Test-User',
    JSON.stringify({
      id: 'user-test',
      email,
      name: 'Test User',
      role: 'user',
    })
  );
}

describe('Admin Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = 'admin@example.com,superadmin@example.com';
    app = createTestApp();
  });

  // ==========================================================================
  // requireAdmin Middleware Tests
  // ==========================================================================

  describe('requireAdmin middleware', () => {
    it('returns 401 when no user present', async () => {
      const response = await request(app)
        .post('/api/v1/admin/unlock-account')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Authentication required');
    });

    it('returns 403 when user role is not admin and email not in ADMIN_EMAILS', async () => {
      const response = await asRegularUser(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin access required');
    });

    // --- RBAC: Primary role-based access ---

    it('allows access when user has admin role (primary RBAC check)', async () => {
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('allows admin role access even when ADMIN_EMAILS is empty', async () => {
      process.env.ADMIN_EMAILS = '';
      app = createTestApp();

      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    // --- Legacy ADMIN_EMAILS fallback ---

    it('allows access via legacy ADMIN_EMAILS fallback (case-insensitive)', async () => {
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      // User has role='user' but email is in ADMIN_EMAILS
      const response = await asUserWithEmail(
        request(app).post('/api/v1/admin/unlock-account'),
        'ADMIN@EXAMPLE.COM'
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('allows access via legacy ADMIN_EMAILS with multiple emails', async () => {
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(false);

      const response = await asUserWithEmail(
        request(app).post('/api/v1/admin/unlock-account'),
        'superadmin@example.com'
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('logs deprecation notice for ADMIN_EMAILS fallback access', async () => {
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      await asUserWithEmail(
        request(app).post('/api/v1/admin/unlock-account'),
        'admin@example.com'
      ).send({ email: 'test@example.com' });

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-test',
          email: 'admin@example.com',
        }),
        expect.stringContaining('DEPRECATION: Admin access granted via ADMIN_EMAILS')
      );
    });

    it('returns 403 for non-admin role when ADMIN_EMAILS is empty', async () => {
      process.env.ADMIN_EMAILS = '';
      app = createTestApp();

      const response = await asRegularUser(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });

    it('logs security warning on unauthorized access attempt', async () => {
      await asRegularUser(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          email: 'user@example.com',
          path: expect.stringContaining('/unlock-account'),
        }),
        expect.stringContaining('SECURITY: Non-admin user attempted to access admin endpoint')
      );
    });
  });

  // ==========================================================================
  // POST /unlock-account Tests
  // ==========================================================================

  describe('POST /api/v1/admin/unlock-account', () => {
    it('returns 200 with correct response for valid request', async () => {
      const mockEmail = 'locked@example.com';
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: mockEmail });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        email: mockEmail,
        wasLocked: true,
      });
    });

    it('returns 400 for invalid email format', async () => {
      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message');
      expect(response.body.details?.errors).toBeDefined();
      expect(response.body.details.errors[0].message).toContain('Invalid email address');
    });

    it('returns 400 for missing email body', async () => {
      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message');
    });

    it('calls accountLockoutService.adminUnlock with correct args', async () => {
      const mockEmail = 'locked@example.com';
      const adminEmail = 'admin@example.com';
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(false);

      await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: mockEmail });

      expect(vi.mocked(accountLockoutService.adminUnlock)).toHaveBeenCalledWith(
        mockEmail,
        adminEmail
      );
      expect(vi.mocked(accountLockoutService.adminUnlock)).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when service throws', async () => {
      vi.mocked(accountLockoutService.adminUnlock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      const response = await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
      expect(response.body).toHaveProperty('message');
    });

    it('logs audit trail for unlock request', async () => {
      const mockEmail = 'locked@example.com';
      vi.mocked(accountLockoutService.adminUnlock).mockResolvedValue(true);

      await asAdmin(
        request(app).post('/api/v1/admin/unlock-account')
      ).send({ email: mockEmail });

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-1',
          adminEmail: 'admin@example.com',
          unlockedEmail: mockEmail,
          wasLocked: true,
        }),
        expect.stringContaining('AUDIT: Admin unlock account request')
      );
    });
  });

  // ==========================================================================
  // GET /lockout-stats Tests
  // ==========================================================================

  describe('GET /api/v1/admin/lockout-stats', () => {
    it('returns 200 with stats object', async () => {
      const mockStats = {
        totalLockedUsers: 5,
        isRedisAvailable: true,
        lockedUsers: ['user1@example.com', 'user2@example.com'],
      };
      vi.mocked(accountLockoutService.getStats).mockResolvedValue(mockStats);

      const response = await asAdmin(
        request(app).get('/api/v1/admin/lockout-stats')
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });

    it('returns 403 for non-admin user', async () => {
      const response = await asRegularUser(
        request(app).get('/api/v1/admin/lockout-stats')
      );

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin access required');
    });

    it('returns 500 when service throws', async () => {
      vi.mocked(accountLockoutService.getStats).mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await asAdmin(
        request(app).get('/api/v1/admin/lockout-stats')
      );

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
      expect(response.body).toHaveProperty('message');
    });

    it('returns stats even when Redis is unavailable', async () => {
      const mockStatsWithRedisDown = {
        totalLockedUsers: 0,
        isRedisAvailable: false,
        lockedUsers: [],
      };
      vi.mocked(accountLockoutService.getStats).mockResolvedValue(
        mockStatsWithRedisDown
      );

      const response = await asAdmin(
        request(app).get('/api/v1/admin/lockout-stats')
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatsWithRedisDown);
      expect(response.body.isRedisAvailable).toBe(false);
    });

    it('does not call service when not authenticated', async () => {
      await request(app).get('/api/v1/admin/lockout-stats');

      expect(vi.mocked(accountLockoutService.getStats)).not.toHaveBeenCalled();
    });

    it('does not call service when not admin', async () => {
      await asRegularUser(request(app).get('/api/v1/admin/lockout-stats'));

      expect(vi.mocked(accountLockoutService.getStats)).not.toHaveBeenCalled();
    });
  });
});
