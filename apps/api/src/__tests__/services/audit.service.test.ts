/**
 * Audit Service Unit Tests
 *
 * Verifies the fire-and-forget contract: logAuditEvent() persists events
 * to the database and never throws, even on Prisma failures.
 */

import { Prisma } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/client.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { logAuditEvent } from '../../services/audit.service.js';

describe('audit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAuditEvent', () => {
    it('creates an audit log record with all fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 1,
        action: 'LOGIN_SUCCESS',
        userId: 'user-123',
        email: 'test@example.com',
        ipAddress: '192.168.1.1',
        metadata: { role: 'user' },
        createdAt: new Date(),
      });

      await logAuditEvent({
        action: 'LOGIN_SUCCESS',
        userId: 'user-123',
        email: 'test@example.com',
        ipAddress: '192.168.1.1',
        metadata: { role: 'user' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'LOGIN_SUCCESS',
          userId: 'user-123',
          email: 'test@example.com',
          ipAddress: '192.168.1.1',
          metadata: { role: 'user' },
        },
      });
    });

    it('creates an audit log record with minimal fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 2,
        action: 'LOGIN_FAILURE',
        userId: null,
        email: 'test@example.com',
        ipAddress: null,
        metadata: null,
        createdAt: new Date(),
      });

      await logAuditEvent({
        action: 'LOGIN_FAILURE',
        email: 'test@example.com',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'LOGIN_FAILURE',
          userId: null,
          email: 'test@example.com',
          ipAddress: null,
          metadata: Prisma.JsonNull,
        },
      });
    });

    it('does not throw on Prisma error (fire-and-forget contract)', async () => {
      vi.mocked(prisma.auditLog.create).mockRejectedValue(
        new Error('Database connection lost')
      );

      // Must not throw
      await expect(
        logAuditEvent({
          action: 'LOGIN_SUCCESS',
          email: 'test@example.com',
        })
      ).resolves.toBeUndefined();
    });

    it('logs error to logger on Prisma failure (fallback, not silent)', async () => {
      const dbError = new Error('Connection refused');
      vi.mocked(prisma.auditLog.create).mockRejectedValue(dbError);

      await logAuditEvent({
        action: 'ACCOUNT_LOCKED',
        email: 'locked@example.com',
        ipAddress: '10.0.0.1',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: dbError,
          auditAction: 'ACCOUNT_LOCKED',
          email: 'locked@example.com',
        }),
        'Audit logging failed - event not persisted'
      );
    });

    it('handles TOKEN_REFRESH action', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 3,
        action: 'TOKEN_REFRESH',
        userId: null,
        email: null,
        ipAddress: '172.16.0.1',
        metadata: null,
        createdAt: new Date(),
      });

      await logAuditEvent({
        action: 'TOKEN_REFRESH',
        ipAddress: '172.16.0.1',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'TOKEN_REFRESH',
          userId: null,
          email: null,
          ipAddress: '172.16.0.1',
          metadata: Prisma.JsonNull,
        },
      });
    });

    it('handles ACCOUNT_UNLOCKED action with admin metadata', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 4,
        action: 'ACCOUNT_UNLOCKED',
        userId: 'admin-1',
        email: 'admin@example.com',
        ipAddress: '10.0.0.2',
        metadata: { unlockedEmail: 'user@example.com', wasLocked: true },
        createdAt: new Date(),
      });

      await logAuditEvent({
        action: 'ACCOUNT_UNLOCKED',
        userId: 'admin-1',
        email: 'admin@example.com',
        ipAddress: '10.0.0.2',
        metadata: { unlockedEmail: 'user@example.com', wasLocked: true },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'ACCOUNT_UNLOCKED',
          userId: 'admin-1',
          email: 'admin@example.com',
          ipAddress: '10.0.0.2',
          metadata: { unlockedEmail: 'user@example.com', wasLocked: true },
        },
      });
    });

    it('handles ADMIN_ACTION with arbitrary metadata', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 5,
        action: 'ADMIN_ACTION',
        userId: 'admin-1',
        email: 'admin@example.com',
        ipAddress: null,
        metadata: { action: 'custom-admin-op' },
        createdAt: new Date(),
      });

      await logAuditEvent({
        action: 'ADMIN_ACTION',
        userId: 'admin-1',
        email: 'admin@example.com',
        metadata: { action: 'custom-admin-op' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });
  });
});
