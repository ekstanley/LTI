import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load environment variables from repository root (handles scripts running from different dirs)
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/ltip_dev'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  // Congress.gov API configuration
  CONGRESS_API_KEY: z.string().optional(),
  CONGRESS_API_BASE_URL: z.string().default('https://api.congress.gov/v3'),
  CONGRESS_API_RATE_LIMIT: z.coerce.number().default(1000), // requests per hour
  CONGRESS_SYNC_INTERVAL_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  // GovInfo API configuration (bill text in XML/PDF/HTML)
  GOVINFO_API_KEY: z.string().optional(),
  GOVINFO_API_BASE_URL: z.string().default('https://api.govinfo.gov'),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  logLevel: env.LOG_LEVEL,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  congress: {
    apiKey: env.CONGRESS_API_KEY,
    baseUrl: env.CONGRESS_API_BASE_URL,
    rateLimit: env.CONGRESS_API_RATE_LIMIT,
    syncIntervalMs: env.CONGRESS_SYNC_INTERVAL_MS,
  },
  govinfo: {
    apiKey: env.GOVINFO_API_KEY,
    baseUrl: env.GOVINFO_API_BASE_URL,
  },
} as const;
