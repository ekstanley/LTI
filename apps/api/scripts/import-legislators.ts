/**
 * Import Legislators
 *
 * Fetches all current and recent legislators from Congress.gov and upserts
 * them into the database. Uses the WP3-A ingestion infrastructure for
 * API access and data transformation.
 *
 * @module scripts/import-legislators
 */

import { getCongressClient, transformMemberListItem } from '../src/ingestion/index.js';
import { prisma } from '../src/db/client.js';
import { getCheckpointManager } from './checkpoint-manager.js';
import {
  BATCH_SIZES,
  DB_BATCH_SIZES,
  ESTIMATED_COUNTS,
  DRY_RUN_CONFIG,
  LOG_CONFIG,
  type ImportOptions,
} from './import-config.js';

// =============================================================================
// TYPES
// =============================================================================

interface ImportStats {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_CONFIG.level]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [legislators]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

function logProgress(current: number, total: number, message?: string): void {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  const msg = message ? ` - ${message}` : '';
  log('info', `[${progressBar}] ${percent}% (${current}/${total})${msg}`);
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Collect items from async generator into batches.
 */
async function* batchItems<T>(
  generator: AsyncGenerator<T, void, unknown>,
  batchSize: number
): AsyncGenerator<T[], void, unknown> {
  let batch: T[] = [];

  for await (const item of generator) {
    batch.push(item);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Upsert a batch of legislators to the database.
 * Uses individual upserts within a transaction for reliability.
 */
async function upsertLegislatorBatch(
  legislators: ReturnType<typeof transformMemberListItem>[],
  dryRun: boolean
): Promise<{ created: number; updated: number }> {
  if (dryRun) {
    log('debug', `[DRY RUN] Would upsert ${legislators.length} legislators`);
    return { created: legislators.length, updated: 0 };
  }

  let created = 0;
  let updated = 0;

  // Use transaction for batch atomicity
  await prisma.$transaction(async (tx) => {
    for (const legislator of legislators) {
      // Check if exists
      const existing = await tx.legislator.findUnique({
        where: { id: legislator.id },
        select: { id: true },
      });

      if (existing) {
        // Update existing
        await tx.legislator.update({
          where: { id: legislator.id },
          data: {
            firstName: legislator.firstName,
            lastName: legislator.lastName,
            middleName: legislator.middleName,
            fullName: legislator.fullName,
            party: legislator.party,
            chamber: legislator.chamber,
            state: legislator.state,
            district: legislator.district,
            inOffice: legislator.inOffice,
            dataSource: legislator.dataSource,
            lastSyncedAt: legislator.lastSyncedAt,
          },
        });
        updated++;
      } else {
        // Create new
        await tx.legislator.create({
          data: legislator,
        });
        created++;
      }
    }
  });

  return { created, updated };
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

/**
 * Import all legislators from Congress.gov.
 *
 * This function:
 * 1. Fetches all members using the paginated API
 * 2. Transforms API responses to database format
 * 3. Upserts in batches to PostgreSQL
 * 4. Updates checkpoint progress for resumability
 *
 * @param options - Import options (dryRun, verbose, etc.)
 */
export async function importLegislators(options: ImportOptions): Promise<void> {
  const { dryRun = false, verbose = false } = options;
  const startTime = Date.now();

  log('info', `Starting legislators import${dryRun ? ' (DRY RUN)' : ''}`);

  const client = getCongressClient();
  const manager = getCheckpointManager();

  // Initialize stats
  const stats: ImportStats = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get checkpoint state for resume
  const checkpoint = manager.getState();
  const startOffset = checkpoint?.phase === 'legislators' ? checkpoint.offset : 0;

  if (startOffset > 0) {
    log('info', `Resuming from offset ${startOffset}`);
    stats.processed = startOffset;
  }

  // Update checkpoint with estimated total
  manager.update({
    totalExpected: ESTIMATED_COUNTS.legislators,
    recordsProcessed: stats.processed,
  });

  try {
    // Fetch all members using async generator
    const membersGenerator = client.listMembers({
      limit: BATCH_SIZES.legislators,
      currentMember: true, // Start with current members
    });

    // Process in batches
    let batchNumber = 0;
    const dbBatchSize = DB_BATCH_SIZES.legislators;

    for await (const batch of batchItems(membersGenerator, dbBatchSize)) {
      batchNumber++;

      // Skip batches we've already processed (for resume)
      if (stats.processed < startOffset) {
        stats.processed += batch.length;
        continue;
      }

      // Transform batch
      const transformedBatch = batch.map((member) => {
        try {
          return transformMemberListItem(member);
        } catch (error) {
          const msg = `Failed to transform member ${member.bioguideId}: ${error}`;
          log('warn', msg);
          stats.errors.push(msg);
          return null;
        }
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      if (transformedBatch.length === 0) {
        continue;
      }

      // Upsert batch
      try {
        const result = await upsertLegislatorBatch(transformedBatch, dryRun);
        stats.created += result.created;
        stats.updated += result.updated;
        stats.processed += batch.length;

        // Update checkpoint
        manager.update({
          offset: stats.processed,
          recordsProcessed: stats.processed,
        });

        // Log progress
        if (stats.processed % LOG_CONFIG.progressIntervalRecords === 0 || verbose) {
          logProgress(stats.processed, ESTIMATED_COUNTS.legislators);
        }

        if (verbose) {
          log('debug', `Batch ${batchNumber}: +${result.created} created, +${result.updated} updated`);
        }
      } catch (error) {
        const msg = `Failed to upsert batch ${batchNumber}: ${error}`;
        log('error', msg);
        stats.errors.push(msg);
        // Continue with next batch rather than failing entirely
      }

      // Dry run limit
      if (dryRun && stats.processed >= DRY_RUN_CONFIG.maxRecords) {
        log('info', `Dry run limit reached (${DRY_RUN_CONFIG.maxRecords} records)`);
        break;
      }
    }

    // Also fetch non-current members for historical completeness
    if (!dryRun) {
      log('info', 'Fetching historical (non-current) members...');

      const historicalGenerator = client.listMembers({
        limit: BATCH_SIZES.legislators,
        currentMember: false,
      });

      for await (const batch of batchItems(historicalGenerator, dbBatchSize)) {
        const transformedBatch = batch.map((member) => {
          try {
            return transformMemberListItem(member);
          } catch (error) {
            stats.errors.push(`Failed to transform historical member ${member.bioguideId}: ${error}`);
            return null;
          }
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        if (transformedBatch.length > 0) {
          try {
            const result = await upsertLegislatorBatch(transformedBatch, dryRun);
            stats.created += result.created;
            stats.updated += result.updated;
            stats.processed += batch.length;

            manager.update({
              offset: stats.processed,
              recordsProcessed: stats.processed,
            });

            if (stats.processed % LOG_CONFIG.progressIntervalRecords === 0) {
              logProgress(stats.processed, ESTIMATED_COUNTS.legislators, 'historical');
            }
          } catch (error) {
            stats.errors.push(`Failed to upsert historical batch: ${error}`);
          }
        }
      }
    }

    // Final summary
    const duration = Date.now() - startTime;
    const durationStr = `${Math.round(duration / 1000)}s`;

    log('info', '');
    log('info', '=== Legislators Import Summary ===');
    log('info', `Total processed: ${stats.processed}`);
    log('info', `Created: ${stats.created}`);
    log('info', `Updated: ${stats.updated}`);
    log('info', `Skipped: ${stats.skipped}`);
    log('info', `Errors: ${stats.errors.length}`);
    log('info', `Duration: ${durationStr}`);
    log('info', `Rate: ${Math.round(stats.processed / (duration / 1000))} records/sec`);

    if (stats.errors.length > 0 && verbose) {
      log('warn', 'Errors encountered:');
      stats.errors.slice(0, 10).forEach((err) => log('warn', `  - ${err}`));
      if (stats.errors.length > 10) {
        log('warn', `  ... and ${stats.errors.length - 10} more`);
      }
    }

    // Update final checkpoint
    manager.update({
      recordsProcessed: stats.processed,
      totalExpected: stats.processed,
      metadata: {
        created: stats.created,
        updated: stats.updated,
        errors: stats.errors.length,
        durationMs: duration,
      },
    });

    // Validate minimum count
    if (!dryRun && stats.processed < 535) {
      throw new Error(
        `Legislator count (${stats.processed}) is below minimum expected (535). ` +
        'This may indicate an API issue or incomplete data.'
      );
    }

  } catch (error) {
    log('error', `Legislators import failed: ${error}`);
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}
