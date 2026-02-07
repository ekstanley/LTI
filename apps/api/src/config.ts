import { resolve } from 'path';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables from repository root (handles scripts running from different dirs)
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/ltip_dev'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().default(3),
  REDIS_RETRY_MAX_ATTEMPTS: z.coerce.number().default(10),
  REDIS_RETRY_MAX_DELAY_MS: z.coerce.number().default(3000),

  // Account lockout configuration (CWE-307 protection)
  LOCKOUT_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_WINDOW_SECONDS: z.coerce.number().default(900),
  LOCKOUT_DURATION_FIRST: z.coerce.number().default(900),
  LOCKOUT_DURATION_SECOND: z.coerce.number().default(3600),
  LOCKOUT_DURATION_THIRD: z.coerce.number().default(21600),
  LOCKOUT_DURATION_EXTENDED: z.coerce.number().default(86400),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Authentication configuration
  // SECURITY: JWT_SECRET must be set via environment variable - no default in production
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('ltip-api'),
  JWT_AUDIENCE: z.string().default('ltip-web'),

  // OAuth providers (optional - only needed if OAuth enabled)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('/api/v1/auth/google/callback'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().default('/api/v1/auth/github/callback'),

  // Session/cookie settings
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

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

// SECURITY: Validate JWT_SECRET is set in production
if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production. Generate with: openssl rand -base64 32');
}

// Validate JWT_SECRET is set in non-test environments or provide test default
const jwtSecret = env.JWT_SECRET ?? (env.NODE_ENV === 'test' ? 'test-jwt-secret-for-unit-tests-only-32chars!' : (() => {
  // Development mode: Allow startup but warn
  console.warn('⚠️  WARNING: JWT_SECRET not set. Using insecure default for development only.');
  return 'development-jwt-secret-change-in-production-32chars';
})());

export const config = {
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redis: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
    retryMaxAttempts: env.REDIS_RETRY_MAX_ATTEMPTS,
    retryMaxDelayMs: env.REDIS_RETRY_MAX_DELAY_MS,
  },
  lockout: {
    maxAttempts: env.LOCKOUT_MAX_ATTEMPTS,
    windowSeconds: env.LOCKOUT_WINDOW_SECONDS,
    durations: {
      first: env.LOCKOUT_DURATION_FIRST,
      second: env.LOCKOUT_DURATION_SECOND,
      third: env.LOCKOUT_DURATION_THIRD,
      extended: env.LOCKOUT_DURATION_EXTENDED,
    },
  },
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  logLevel: env.LOG_LEVEL,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // JWT configuration
  jwt: {
    secret: jwtSecret,
    accessTokenExpiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: env.JWT_REFRESH_TOKEN_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithm: 'HS256' as const,
  },

  // OAuth providers
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackUrl: env.GOOGLE_CALLBACK_URL,
      enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackUrl: env.GITHUB_CALLBACK_URL,
      enabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    },
  },

  // Cookie settings
  cookie: {
    domain: env.COOKIE_DOMAIN,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    refreshTokenName: 'refresh_token',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },

  // Argon2 password hashing (OWASP recommended settings)
  argon2: {
    memoryCost: 65536, // 64 MB
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 parallel threads
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
