/**
 * Prisma Client Singleton
 *
 * Provides a single Prisma client instance for the entire application.
 * Prevents connection pool exhaustion during development hot reloading.
 */

import { PrismaClient } from '@prisma/client';

import { config } from '../config.js';
import { logger } from '../lib/logger.js';

// Extend global to store Prisma client in development
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-redundant-type-constituents
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const client = new PrismaClient({
    log: config.isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
    datasourceUrl: config.databaseUrl,
  });

  // Log queries in development
  if (config.isDev) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    client.$on('query', (e) => {
      logger.debug({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        query: e.query,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        params: e.params,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        duration: e.duration,
      }, 'Database query');
    });
  }

  // Log errors
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  client.$on('error', (e) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    logger.error({ message: e.message }, 'Prisma error');
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  client.$on('warn', (e) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    logger.warn({ message: e.message }, 'Prisma warning');
  });

  return client;
}

// Use global singleton in development to prevent connection pool issues
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (config.isDev) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  globalThis.__prisma = prisma;
}

/**
 * Connect to database with retry logic
 */
export async function connectDatabase(maxRetries = 5): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await prisma.$connect();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      retries++;
      logger.warn(
        { error, retries, maxRetries },
        'Database connection failed, retrying...'
      );

      if (retries >= maxRetries) {
        logger.error({ error }, 'Database connection failed after max retries');
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retries) * 1000)
      );
    }
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
