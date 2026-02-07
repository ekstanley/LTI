/**
 * Audit Logging Service
 *
 * Persists security-relevant events to the AuditLog table.
 *
 * CONTRACT:
 * - Fire-and-forget: logAuditEvent() never throws.
 * - On Prisma failure: falls back to console.error (not silent).
 * - Must never block authentication flows.
 */

import { Prisma, type AuditAction } from '@prisma/client';

import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';

export interface AuditEventParams {
  action: AuditAction;
  userId?: string | undefined;
  email?: string | undefined;
  ipAddress?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Log a security-relevant audit event to the database.
 *
 * Fire-and-forget: this function never throws. If the database write
 * fails, the error is logged to console.error as a fallback.
 *
 * @param params - Audit event details
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        email: params.email ?? null,
        ipAddress: params.ipAddress ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    // Fire-and-forget fallback: never throw, log to console
    logger.error(
      {
        error,
        auditAction: params.action,
        email: params.email,
      },
      'Audit logging failed - event not persisted'
    );
  }
}
