/**
 * Role Mapping Utility
 *
 * Single source of truth for mapping Prisma UserRole enum (uppercase DB values)
 * to API role strings (lowercase). Uses exhaustive switch to guarantee
 * compile-time completeness when new roles are added.
 */

import type { UserRole as PrismaUserRole } from '@prisma/client';

const ROLE_MAP = {
  USER: 'user',
  ADMIN: 'admin',
} as const satisfies Record<PrismaUserRole, string>;

export type ApiRole = (typeof ROLE_MAP)[keyof typeof ROLE_MAP];

/**
 * Map a Prisma UserRole enum value to its lowercase API representation.
 *
 * @param prismaRole - Database-level role (e.g. 'USER', 'ADMIN')
 * @returns Lowercase API role string (e.g. 'user', 'admin')
 * @throws Error if an unhandled role variant is passed (compile-time exhaustive)
 */
export function mapPrismaRole(prismaRole: PrismaUserRole): ApiRole {
  switch (prismaRole) {
    case 'USER':
      return ROLE_MAP.USER;
    case 'ADMIN':
      return ROLE_MAP.ADMIN;
    default: {
      const _exhaustive: never = prismaRole;
      throw new Error(`Unhandled Prisma UserRole: ${String(_exhaustive)}`);
    }
  }
}
