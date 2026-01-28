/**
 * Database Layer Exports
 *
 * Provides unified exports for database access including:
 * - Prisma client for PostgreSQL
 * - Redis/Cache client for caching
 * - Connection management utilities
 */

export {
  prisma,
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
} from './client.js';

export {
  cache,
  getCache,
  buildCacheKey,
  disconnectCache,
  checkCacheHealth,
  REDIS_NAMESPACES,
  DEFAULT_TTL,
  type RedisNamespace,
} from './redis.js';
