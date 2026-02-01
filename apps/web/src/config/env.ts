/**
 * Centralized environment configuration for the web application
 *
 * All configuration values are loaded from environment variables with sensible defaults.
 * Use NEXT_PUBLIC_ prefix for client-side accessible variables.
 *
 * @module config/env
 */

/**
 * Parse integer from environment variable with fallback
 */
function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * API Configuration
 */
export const apiConfig = {
  /** Base URL for API requests */
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',

  /** Maximum number of retry attempts for transient failures */
  maxRetries: parseEnvInt(process.env.NEXT_PUBLIC_API_MAX_RETRIES, 3),

  /** Initial backoff delay in milliseconds for exponential retry */
  initialBackoffMs: parseEnvInt(process.env.NEXT_PUBLIC_API_INITIAL_BACKOFF_MS, 1000),

  /** Maximum backoff delay in milliseconds (caps exponential growth) */
  maxBackoffMs: parseEnvInt(process.env.NEXT_PUBLIC_API_MAX_BACKOFF_MS, 30000),

  /** Maximum CSRF token refresh attempts to prevent infinite loops */
  maxCsrfRefreshAttempts: parseEnvInt(process.env.NEXT_PUBLIC_API_MAX_CSRF_REFRESH_ATTEMPTS, 2),
} as const;

/**
 * SWR Configuration
 */
export const swrConfig = {
  /**
   * Deduplication interval in milliseconds
   * SWR will deduplicate requests with the same key within this interval
   */
  dedupingInterval: parseEnvInt(process.env.NEXT_PUBLIC_SWR_DEDUPING_INTERVAL, 5000),

  /** Whether to revalidate data when window regains focus */
  revalidateOnFocus: process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS === 'true',
} as const;

/**
 * Combined application configuration
 */
export const config = {
  api: apiConfig,
  swr: swrConfig,
} as const;

// Type exports for convenience
export type ApiConfig = typeof apiConfig;
export type SwrConfig = typeof swrConfig;
export type Config = typeof config;
