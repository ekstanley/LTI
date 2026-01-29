/**
 * Import Configuration
 *
 * Configuration constants for the bulk import scripts.
 * These values control batch sizes, rate limits, and targeting
 * for the historical data load process.
 *
 * @module scripts/import-config
 */

import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// TARGET CONFIGURATION
// =============================================================================

/**
 * Congress sessions to import.
 * 118th: 2023-2024 (most recent completed)
 * 119th: 2025-2026 (current session)
 */
export const TARGET_CONGRESSES = [118, 119] as const;
export type TargetCongress = (typeof TARGET_CONGRESSES)[number];

/**
 * Bill types to import for each congress.
 * HR = House Resolution, S = Senate Bill, etc.
 */
export const BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'] as const;
export type BillType = (typeof BILL_TYPES)[number];

// =============================================================================
// BATCH SIZE CONFIGURATION
// =============================================================================

/**
 * Batch sizes for different entity types.
 * Tuned for Congress.gov API limits and database performance.
 *
 * - Smaller batches = more API calls but safer recovery
 * - Larger batches = fewer API calls but riskier on failure
 */
export const BATCH_SIZES = {
  /** Legislators per batch (small dataset ~540 total) */
  legislators: 100,

  /** Committees per batch (small dataset ~250 total) */
  committees: 50,

  /** Bills per batch (large dataset ~20,000 total) */
  bills: 100,

  /** Roll call votes per batch */
  votes: 50,

  /** Individual vote positions per batch (very large ~850,000) */
  votePositions: 500,
} as const;

/**
 * Database upsert batch sizes.
 * These may differ from API fetch sizes for optimal DB performance.
 */
export const DB_BATCH_SIZES = {
  legislators: 50,
  committees: 25,
  bills: 50,
  votes: 25,
  votePositions: 200,
} as const;

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

/**
 * Congress.gov API rate limits.
 * Official limit: 1000 requests per hour.
 * We use conservative values to avoid hitting limits.
 */
export const RATE_LIMITS = {
  /** Maximum requests per hour (official limit: 1000) */
  maxRequestsPerHour: 900,

  /** Burst capacity for token bucket */
  burstCapacity: 100,

  /** Minimum delay between requests in ms */
  minDelayMs: 100,

  /** Delay after rate limit warning */
  cooldownDelayMs: 5000,
} as const;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/**
 * Retry settings for failed API requests.
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts */
  maxRetries: 3,

  /** Base delay for exponential backoff (ms) */
  baseDelayMs: 1000,

  /** Maximum delay between retries (ms) */
  maxDelayMs: 30000,

  /** Backoff multiplier */
  backoffMultiplier: 2,

  /** Jitter factor (0-1) */
  jitterFactor: 0.3,
} as const;

// =============================================================================
// ERROR HANDLING LIMITS (QC-001 FIX)
// =============================================================================

/**
 * Error handling limits to prevent infinite loops.
 * Added for QC-001: Infinite Loop Risk in Error Handling.
 */
export const ERROR_LIMITS = {
  /**
   * Maximum total errors allowed across entire import process.
   * Prevents infinite loops regardless of error pattern.
   */
  maxTotalErrors: 100,

  /**
   * Maximum duration for import operations in milliseconds.
   * 3600000ms = 1 hour timeout.
   */
  maxDurationMs: 3600000,
} as const;

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

/**
 * Timeout settings for various operations.
 */
export const TIMEOUTS = {
  /** Single API request timeout (ms) */
  requestTimeoutMs: 30000,

  /** Database transaction timeout (ms) */
  dbTransactionTimeoutMs: 60000,

  /** Overall import phase timeout (ms) - 4 hours */
  phaseTimeoutMs: 4 * 60 * 60 * 1000,

  /** Rate limiter acquire timeout (ms) */
  rateLimitTimeoutMs: 60000,
} as const;

// =============================================================================
// CHECKPOINT CONFIGURATION
// =============================================================================

/**
 * Checkpoint file paths for resumable imports.
 */
export const CHECKPOINT_CONFIG = {
  /** Directory for checkpoint files */
  directory: path.resolve(__dirname, '../.import-checkpoints'),

  /** Main checkpoint file */
  mainCheckpoint: 'import-checkpoint.json',

  /** Backup checkpoint (rotated) */
  backupCheckpoint: 'import-checkpoint.backup.json',

  /** Checkpoint save interval (after N records) */
  saveIntervalRecords: 100,

  /** Checkpoint save interval (ms) */
  saveIntervalMs: 30000,
} as const;

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

/**
 * Logging settings for import process.
 */
export const LOG_CONFIG = {
  /** Log directory */
  directory: path.resolve(__dirname, '../logs'),

  /** Log file for import operations */
  importLogFile: 'import.log',

  /** Log level: debug | info | warn | error */
  level: (process.env.IMPORT_LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  /** Log progress every N records */
  progressIntervalRecords: 100,

  /** Log progress every N ms */
  progressIntervalMs: 10000,
} as const;

// =============================================================================
// VALIDATION CONFIGURATION
// =============================================================================

/**
 * Validation settings for post-import checks.
 */
export const VALIDATION_CONFIG = {
  /** Expected minimum bill count for 118th Congress */
  minBills118: 12000,

  /** Expected minimum bill count for 119th Congress */
  minBills119: 3000,

  /** Expected minimum legislator count */
  minLegislators: 535,

  /** Expected minimum committee count */
  minCommittees: 200,

  /** Sample size for data accuracy checks */
  sampleSize: 50,

  /** Acceptable data mismatch rate (0-1) */
  maxMismatchRate: 0.01,
} as const;

// =============================================================================
// IMPORT PHASES
// =============================================================================

/**
 * Import phases in execution order.
 * Dependencies flow downward - each phase depends on previous.
 */
export const IMPORT_PHASES = [
  'legislators',
  'committees',
  'bills',
  'votes',
  'validate',
] as const;
export type ImportPhase = (typeof IMPORT_PHASES)[number];

/**
 * Type guard to validate if a string is a valid ImportPhase.
 * Use this instead of type assertions for runtime safety.
 * @param value - The string to validate
 * @returns true if value is a valid ImportPhase, with type narrowing
 */
export function isValidImportPhase(value: string): value is ImportPhase {
  return (IMPORT_PHASES as readonly string[]).includes(value);
}

/**
 * Phase dependencies map.
 * Each phase lists its required predecessor phases.
 */
export const PHASE_DEPENDENCIES: Record<ImportPhase, ImportPhase[]> = {
  legislators: [],
  committees: ['legislators'],
  bills: ['legislators', 'committees'],
  votes: ['legislators', 'bills'],
  validate: ['legislators', 'committees', 'bills', 'votes'],
} as const;

// =============================================================================
// DATA VOLUME ESTIMATES
// =============================================================================

/**
 * Estimated record counts for progress tracking.
 * These are approximations used for ETA calculations.
 */
export const ESTIMATED_COUNTS = {
  legislators: 550,
  committees: 280,
  bills: {
    118: 15000,
    119: 5000,
  },
  votes: {
    118: 1500,
    119: 300,
  },
  votePositions: {
    118: 750000,
    119: 150000,
  },
} as const;

// =============================================================================
// DRY RUN MODE
// =============================================================================

/**
 * Dry run configuration for testing without database writes.
 */
export const DRY_RUN_CONFIG = {
  /** Maximum records to process in dry run mode */
  maxRecords: 100,

  /** Log every N records in dry run */
  logInterval: 10,
} as const;

// =============================================================================
// HEALTH CHECK CONFIGURATION
// =============================================================================

/**
 * Health check settings during import.
 */
export const HEALTH_CHECK_CONFIG = {
  /** Check database connection every N records */
  dbCheckIntervalRecords: 500,

  /** Check API availability every N requests */
  apiCheckIntervalRequests: 100,

  /** Memory warning threshold (MB) */
  memoryWarningThresholdMb: 1024,

  /** Memory critical threshold (MB) - pause import */
  memoryCriticalThresholdMb: 2048,
} as const;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Import options passed to individual import scripts.
 */
export interface ImportOptions {
  /** Run in dry-run mode (no database writes) */
  dryRun?: boolean;

  /** Specific congress to import (default: all targets) */
  congress?: TargetCongress;

  /** Resume from checkpoint */
  resume?: boolean;

  /** Skip validation phase */
  skipValidation?: boolean;

  /** Verbose logging */
  verbose?: boolean;

  /** Force re-import (ignore existing data) */
  force?: boolean;
}

/**
 * Progress callback for tracking import status.
 */
export interface ProgressCallback {
  (phase: ImportPhase, current: number, total: number, message?: string): void;
}

/**
 * Import result summary.
 */
export interface ImportResult {
  phase: ImportPhase;
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  durationMs: number;
  startedAt: Date;
  completedAt: Date;
}

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

/**
 * Validate that required environment variables are set.
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.CONGRESS_API_KEY) {
    errors.push('CONGRESS_API_KEY environment variable is required');
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL environment variable is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get full configuration summary for logging.
 */
export function getConfigSummary(): Record<string, unknown> {
  return {
    targetCongresses: TARGET_CONGRESSES,
    batchSizes: BATCH_SIZES,
    rateLimits: RATE_LIMITS,
    timeouts: TIMEOUTS,
    checkpointDir: CHECKPOINT_CONFIG.directory,
    logLevel: LOG_CONFIG.level,
    estimatedTotalRecords: {
      legislators: ESTIMATED_COUNTS.legislators,
      committees: ESTIMATED_COUNTS.committees,
      bills: ESTIMATED_COUNTS.bills[118] + ESTIMATED_COUNTS.bills[119],
      votes: ESTIMATED_COUNTS.votes[118] + ESTIMATED_COUNTS.votes[119],
    },
  };
}
