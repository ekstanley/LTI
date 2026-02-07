/**
 * Role Mapping Utility Tests
 *
 * Verifies that mapPrismaRole correctly maps Prisma UserRole enum values
 * to lowercase API role strings, and throws on unknown roles.
 */

import { describe, it, expect } from 'vitest';

import { mapPrismaRole, type ApiRole } from '../../utils/roles.js';

describe('mapPrismaRole', () => {
  it('should map USER to "user"', () => {
    const result: ApiRole = mapPrismaRole('USER');
    expect(result).toBe('user');
  });

  it('should map ADMIN to "admin"', () => {
    const result: ApiRole = mapPrismaRole('ADMIN');
    expect(result).toBe('admin');
  });

  it('should throw on unknown role', () => {
    // Force an invalid value past TypeScript for runtime safety test
    expect(() => mapPrismaRole('SUPERADMIN' as any)).toThrow('Unhandled Prisma UserRole: SUPERADMIN');
  });
});
