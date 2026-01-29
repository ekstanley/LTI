/**
 * Import Bills
 *
 * Fetches all bills from Congress.gov for targeted congresses (118, 119) and
 * upserts them into the database. This is the largest dataset (~20,000 bills)
 * and requires careful checkpoint tracking for resumability.
 *
 * Import Strategy:
 * 1. Iterate over each target congress (118, 119)
 * 2. For each congress, iterate over bill types (hr, s, hjres, etc.)
 * 3. Fetch bills in batches using async generator
 * 4. Upsert to database in batches
 * 5. Track progress in checkpoint with congress/billType/offset
 *
 * @module scripts/import-bills
 */

import {
  getCongressClient,
  transformBillListItem,
} from '../src/ingestion/index.js';
import { prisma } from '../src/db/client.js';
import { getCheckpointManager } from './checkpoint-manager.js';
import {
  TARGET_CONGRESSES,
  BILL_TYPES,
  BATCH_SIZES,
  DB_BATCH_SIZES,
  ESTIMATED_COUNTS,
  DRY_RUN_CONFIG,
  LOG_CONFIG,
  type ImportOptions,
  type BillType,
  type TargetCongress,
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
  byCongressType: Map<string, { processed: number; created: number; updated: number }>;
}

type BillCreateInput = ReturnType<typeof transformBillListItem>;

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_CONFIG.level]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [bills]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

function logProgress(
  current: number,
  total: number,
  congress?: number,
  billType?: string
): void {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  const context = congress && billType ? ` [C${congress}/${billType}]` : '';
  log('info', `[${progressBar}] ${percent}% (${current}/${total})${context}`);
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
 * Upsert a batch of bills to the database.
 * Uses individual upserts within a transaction for reliability.
 */
async function upsertBillBatch(
  bills: BillCreateInput[],
  dryRun: boolean
): Promise<{ created: number; updated: number; skipped: number }> {
  if (dryRun) {
    log('debug', `[DRY RUN] Would upsert ${bills.length} bills`);
    return { created: bills.length, updated: 0, skipped: 0 };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Process bills individually to handle errors gracefully
  // Note: Sponsor info is not available in the bill list API response.
  // Sponsor relationships must be created via a separate import-cosponsors phase
  // that fetches bill details with sponsor data.
  for (const bill of bills) {
    try {
      // Check if bill exists
      const existing = await prisma.bill.findUnique({
        where: { id: bill.id },
        select: { id: true },
      });

      if (existing) {
        // Update existing bill with fields from list API
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            title: bill.title,
            status: bill.status,
            introducedDate: bill.introducedDate,
            lastActionDate: bill.lastActionDate,
            dataSource: bill.dataSource,
            lastSyncedAt: bill.lastSyncedAt,
          },
        });
        updated++;
      } else {
        // Create new bill
        await prisma.bill.create({
          data: bill,
        });
        created++;
      }
    } catch (error) {
      log('debug', `Failed to upsert bill ${bill.id}: ${error}`);
      skipped++;
    }
  }

  return { created, updated, skipped };
}

// =============================================================================
// IMPORT HELPERS
// =============================================================================

/**
 * Get the estimated total bill count for all target congresses.
 */
function getEstimatedTotal(): number {
  let total = 0;
  for (const congress of TARGET_CONGRESSES) {
    total += ESTIMATED_COUNTS.bills[congress] ?? 0;
  }
  return total;
}

/**
 * Determine the starting point for import based on checkpoint.
 */
function getStartPoint(checkpoint: {
  congress: number | null;
  billType: string | null;
  offset: number;
} | null): {
  startCongress: TargetCongress;
  startBillType: BillType;
  startOffset: number;
} {
  if (!checkpoint || checkpoint.congress === null || checkpoint.billType === null) {
    return {
      startCongress: TARGET_CONGRESSES[0],
      startBillType: BILL_TYPES[0],
      startOffset: 0,
    };
  }

  return {
    startCongress: checkpoint.congress as TargetCongress,
    startBillType: checkpoint.billType as BillType,
    startOffset: checkpoint.offset,
  };
}

/**
 * Check if we should skip this congress/billType combination based on checkpoint.
 */
function shouldSkip(
  congress: TargetCongress,
  billType: BillType,
  startCongress: TargetCongress,
  startBillType: BillType
): boolean {
  const congressIndex = TARGET_CONGRESSES.indexOf(congress);
  const startCongressIndex = TARGET_CONGRESSES.indexOf(startCongress);

  if (congressIndex < startCongressIndex) {
    return true;
  }

  if (congressIndex === startCongressIndex) {
    const billTypeIndex = BILL_TYPES.indexOf(billType);
    const startBillTypeIndex = BILL_TYPES.indexOf(startBillType);
    if (billTypeIndex < startBillTypeIndex) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

/**
 * Import all bills from Congress.gov for target congresses.
 *
 * This function:
 * 1. Iterates over each target congress (118, 119)
 * 2. For each congress, iterates over bill types (hr, s, hjres, etc.)
 * 3. Fetches bills in batches using async generator
 * 4. Transforms and upserts to database in batches
 * 5. Updates checkpoint with congress/billType/offset for resumability
 *
 * @param options - Import options (dryRun, verbose, etc.)
 */
export async function importBills(options: ImportOptions): Promise<void> {
  const { dryRun = false, verbose = false, congress: targetCongress } = options;
  const startTime = Date.now();

  log('info', `Starting bills import${dryRun ? ' (DRY RUN)' : ''}`);

  const client = getCongressClient();
  const manager = getCheckpointManager();

  // Initialize stats
  const stats: ImportStats = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    byCongressType: new Map(),
  };

  // Get checkpoint state for resume
  const checkpoint = manager.getState();
  const { startCongress, startBillType, startOffset } = getStartPoint(
    checkpoint?.phase === 'bills' ? checkpoint : null
  );

  log('info', `Resume point: Congress ${startCongress}, Type ${startBillType}, Offset ${startOffset}`);

  // Update checkpoint with estimated total
  manager.update({
    totalExpected: getEstimatedTotal(),
    recordsProcessed: stats.processed,
  });

  // Determine which congresses to process
  const congressesToProcess = targetCongress
    ? [targetCongress]
    : TARGET_CONGRESSES;

  try {
    // Iterate over target congresses
    for (const congress of congressesToProcess) {
      log('info', `\n--- Congress ${congress} ---`);

      // Iterate over bill types
      for (const billType of BILL_TYPES) {
        const key = `${congress}-${billType}`;

        // Skip if we haven't reached the resume point yet
        if (shouldSkip(congress, billType, startCongress, startBillType)) {
          log('debug', `Skipping ${key} (before resume point)`);
          continue;
        }

        log('info', `Processing Congress ${congress}, type: ${billType.toUpperCase()}`);

        // Initialize stats for this congress/type
        const typeStats = { processed: 0, created: 0, updated: 0 };
        stats.byCongressType.set(key, typeStats);

        // Determine starting offset for this type
        const offset =
          congress === startCongress && billType === startBillType
            ? startOffset
            : 0;

        if (offset > 0) {
          log('info', `Resuming from offset ${offset}`);
          typeStats.processed = offset;
        }

        // Update checkpoint for current position
        manager.update({
          congress,
          billType,
          offset: typeStats.processed,
        });

        // Fetch bills using async generator
        const billsGenerator = client.listBills(congress, {
          limit: BATCH_SIZES.bills,
          type: billType,
        });

        let batchNumber = 0;

        for await (const batch of batchItems(billsGenerator, DB_BATCH_SIZES.bills)) {
          batchNumber++;

          // Skip batches we've already processed (for resume)
          const batchEndOffset = typeStats.processed + batch.length;
          if (batchEndOffset <= offset) {
            typeStats.processed += batch.length;
            continue;
          }

          // Transform batch
          const transformedBatch: BillCreateInput[] = [];
          for (const bill of batch) {
            try {
              transformedBatch.push(transformBillListItem(bill));
            } catch (error) {
              const msg = `Failed to transform bill ${bill.type}-${bill.number}-${bill.congress}: ${error}`;
              log('warn', msg);
              stats.errors.push(msg);
            }
          }

          if (transformedBatch.length === 0) {
            continue;
          }

          // Upsert batch
          try {
            const result = await upsertBillBatch(transformedBatch, dryRun);
            typeStats.created += result.created;
            typeStats.updated += result.updated;
            typeStats.processed += batch.length;
            stats.created += result.created;
            stats.updated += result.updated;
            stats.skipped += result.skipped;
            stats.processed += batch.length;

            // Update checkpoint
            manager.update({
              offset: typeStats.processed,
              recordsProcessed: stats.processed,
            });

            // Log progress
            if (
              stats.processed % LOG_CONFIG.progressIntervalRecords === 0 ||
              verbose
            ) {
              logProgress(stats.processed, getEstimatedTotal(), congress, billType);
            }

            if (verbose) {
              log(
                'debug',
                `Batch ${batchNumber}: +${result.created} created, +${result.updated} updated`
              );
            }
          } catch (error) {
            const msg = `Failed to upsert batch ${batchNumber} for ${key}: ${error}`;
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

        // Log type completion
        log(
          'info',
          `Completed ${billType.toUpperCase()}: ${typeStats.processed} processed, ` +
            `${typeStats.created} created, ${typeStats.updated} updated`
        );

        // Early exit for dry run
        if (dryRun && stats.processed >= DRY_RUN_CONFIG.maxRecords) {
          break;
        }
      }

      // Early exit for dry run
      if (dryRun && stats.processed >= DRY_RUN_CONFIG.maxRecords) {
        break;
      }
    }

    // Final summary
    const duration = Date.now() - startTime;
    const durationStr = formatDuration(duration);

    log('info', '');
    log('info', '=== Bills Import Summary ===');
    log('info', `Total processed: ${stats.processed}`);
    log('info', `Created: ${stats.created}`);
    log('info', `Updated: ${stats.updated}`);
    log('info', `Skipped: ${stats.skipped}`);
    log('info', `Errors: ${stats.errors.length}`);
    log('info', `Duration: ${durationStr}`);
    log('info', `Rate: ${Math.round(stats.processed / (duration / 1000))} records/sec`);

    // Breakdown by congress/type
    if (verbose) {
      log('info', '');
      log('info', 'Breakdown by Congress/Type:');
      for (const [key, typeStats] of stats.byCongressType) {
        log(
          'info',
          `  ${key}: ${typeStats.processed} processed, ${typeStats.created} created, ${typeStats.updated} updated`
        );
      }
    }

    if (stats.errors.length > 0 && verbose) {
      log('warn', '');
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
        skipped: stats.skipped,
        errors: stats.errors.length,
        durationMs: duration,
      },
    });

    // Validate minimum count
    if (!dryRun) {
      const expectedMin = getEstimatedTotal() * 0.8; // 80% of estimate
      if (stats.processed < expectedMin) {
        log(
          'warn',
          `Bill count (${stats.processed}) is below 80% of expected (${expectedMin}). ` +
            'This may indicate an API issue or incomplete data.'
        );
      }
    }
  } catch (error) {
    log('error', `Bills import failed: ${error}`);
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
