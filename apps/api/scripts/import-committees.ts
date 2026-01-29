/**
 * Import Committees
 *
 * Fetches all committees from Congress.gov and upserts them into the database.
 * Handles parent-child hierarchy by sorting committees with parentId=null first.
 *
 * @module scripts/import-committees
 */

import { getCongressClient, transformCommittee } from '../src/ingestion/index.js';
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
  failedTransformIds: string[];
}

type CommitteeInput = ReturnType<typeof transformCommittee>;

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_CONFIG.level]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [committees]`;
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
// DATABASE OPERATIONS
// =============================================================================

/**
 * Sort committees so parent committees come before subcommittees.
 * This ensures foreign key constraints are satisfied.
 */
function sortCommitteesForInsert(committees: CommitteeInput[]): CommitteeInput[] {
  return [...committees].sort((a, b) => {
    // Null parentId (parent committees) should come first
    if (a.parentId === null && b.parentId !== null) return -1;
    if (a.parentId !== null && b.parentId === null) return 1;
    return 0;
  });
}

/**
 * Upsert a single committee to the database.
 */
async function upsertCommittee(
  committee: CommitteeInput,
  dryRun: boolean
): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
  if (dryRun) {
    log('debug', `[DRY RUN] Would upsert committee ${committee.id}: ${committee.name}`);
    return { created: true, updated: false, skipped: false };
  }

  try {
    // Check if exists
    const existing = await prisma.committee.findUnique({
      where: { id: committee.id },
      select: { id: true },
    });

    // Handle parentId - verify parent exists before referencing
    const createData = { ...committee };
    if (createData.parentId) {
      const parentExists = await prisma.committee.findUnique({
        where: { id: createData.parentId },
        select: { id: true },
      });
      if (!parentExists) {
        // Remove parentId if parent doesn't exist yet
        // It will be updated in a subsequent run
        log('debug', `Parent ${createData.parentId} not found for ${committee.id}, deferring link`);
        createData.parentId = null;
      }
    }

    if (existing) {
      // Update existing committee
      // Note: jurisdiction is not available in Congress.gov committee list API
      // It would need to be populated from a separate data source
      await prisma.committee.update({
        where: { id: committee.id },
        data: {
          name: createData.name,
          chamber: createData.chamber,
          type: createData.type,
          parentId: createData.parentId,
        },
      });
      return { created: false, updated: true, skipped: false };
    } else {
      // Create new committee
      await prisma.committee.create({ data: createData });
      return { created: true, updated: false, skipped: false };
    }
  } catch (error) {
    log('warn', `Failed to upsert committee ${committee.id}: ${error}`);
    return { created: false, updated: false, skipped: true };
  }
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

/**
 * Import all committees from Congress.gov.
 *
 * This function:
 * 1. Fetches all committees using the paginated API
 * 2. Sorts committees to ensure parents are created before subcommittees
 * 3. Transforms API responses to database format
 * 4. Upserts individually (to handle parent-child ordering)
 * 5. Updates checkpoint progress for resumability
 *
 * @param options - Import options (dryRun, verbose, etc.)
 */
export async function importCommittees(options: ImportOptions): Promise<void> {
  const { dryRun = false, verbose = false } = options;
  const startTime = Date.now();

  log('info', `Starting committees import${dryRun ? ' (DRY RUN)' : ''}`);

  const client = getCongressClient();
  const manager = getCheckpointManager();

  // Initialize stats
  const stats: ImportStats = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    failedTransformIds: [],
  };

  // Get checkpoint state for resume
  const checkpoint = manager.getState();
  const startOffset = checkpoint?.phase === 'committees' ? checkpoint.offset : 0;

  if (startOffset > 0) {
    log('info', `Resuming from offset ${startOffset}`);
    stats.processed = startOffset;
  }

  // Update checkpoint with estimated total
  manager.update({
    totalExpected: ESTIMATED_COUNTS.committees,
    recordsProcessed: stats.processed,
  });

  try {
    // First, fetch ALL committees into memory
    // This is necessary to properly sort for parent-child relationships
    // Committees dataset is small (~280) so this is acceptable
    log('info', 'Fetching all committees from API...');

    const allCommittees: CommitteeInput[] = [];
    let fetchCount = 0;

    for await (const committeeItem of client.listCommittees({ limit: BATCH_SIZES.committees })) {
      fetchCount++;

      // Dry run limit during fetch
      if (dryRun && fetchCount >= DRY_RUN_CONFIG.maxRecords) {
        log('info', `Dry run limit reached during fetch (${DRY_RUN_CONFIG.maxRecords} records)`);
        break;
      }

      try {
        const transformed = transformCommittee(committeeItem);
        allCommittees.push(transformed);
      } catch (error) {
        const msg = `Failed to transform committee ${committeeItem.systemCode}: ${error}`;
        log('warn', msg);
        stats.errors.push(msg);
        stats.failedTransformIds.push(committeeItem.systemCode);
      }

      // Progress during fetch
      if (fetchCount % 50 === 0) {
        log('debug', `Fetched ${fetchCount} committees...`);
      }
    }

    log('info', `Fetched ${allCommittees.length} committees total`);

    // Sort committees: parents first, then subcommittees
    const sortedCommittees = sortCommitteesForInsert(allCommittees);

    // Update total expected
    manager.update({
      totalExpected: sortedCommittees.length,
    });

    // Process committees in order
    log('info', 'Upserting committees to database...');

    for (let i = 0; i < sortedCommittees.length; i++) {
      const committee = sortedCommittees[i];
      // TypeScript requires explicit check even though index is within bounds
      if (!committee) continue;

      // Skip already processed (for resume)
      if (i < startOffset) {
        continue;
      }

      const result = await upsertCommittee(committee, dryRun);

      if (result.created) stats.created++;
      if (result.updated) stats.updated++;
      if (result.skipped) stats.skipped++;
      stats.processed++;

      // Update checkpoint periodically
      if (stats.processed % DB_BATCH_SIZES.committees === 0) {
        manager.update({
          offset: stats.processed,
          recordsProcessed: stats.processed,
        });
      }

      // Log progress
      if (stats.processed % LOG_CONFIG.progressIntervalRecords === 0 || verbose) {
        logProgress(stats.processed, sortedCommittees.length);
      }

      if (verbose) {
        log('debug', `Committee ${committee.id}: ${result.created ? 'created' : result.updated ? 'updated' : 'skipped'}`);
      }
    }

    // Second pass: update parent links that were deferred
    // This handles cases where subcommittee was sorted before parent
    log('info', 'Second pass: updating deferred parent links...');

    let updatedParentLinks = 0;
    for (const committee of sortedCommittees) {
      if (committee.parentId && !dryRun) {
        try {
          // Check if current parentId is null but should have a parent
          const current = await prisma.committee.findUnique({
            where: { id: committee.id },
            select: { parentId: true },
          });

          if (current && current.parentId === null) {
            // Verify parent exists now
            const parentExists = await prisma.committee.findUnique({
              where: { id: committee.parentId },
              select: { id: true },
            });

            if (parentExists) {
              await prisma.committee.update({
                where: { id: committee.id },
                data: { parentId: committee.parentId },
              });
              updatedParentLinks++;
            }
          }
        } catch (error) {
          log('error', `Could not update parent link for ${committee.id}: ${error}`);
        }
      }
    }

    if (updatedParentLinks > 0) {
      log('info', `Updated ${updatedParentLinks} deferred parent links`);
    }

    // Final summary
    const duration = Date.now() - startTime;
    const durationStr = `${Math.round(duration / 1000)}s`;

    log('info', '');
    log('info', '=== Committees Import Summary ===');
    log('info', `Total processed: ${stats.processed}`);
    log('info', `Created: ${stats.created}`);
    log('info', `Updated: ${stats.updated}`);
    log('info', `Skipped: ${stats.skipped}`);
    log('info', `Errors: ${stats.errors.length}`);
    log('info', `Failed transformations: ${stats.failedTransformIds.length}`);
    log('info', `Duration: ${durationStr}`);
    log('info', `Rate: ${Math.round(stats.processed / (duration / 1000))} records/sec`);

    if (stats.failedTransformIds.length > 0) {
      log('warn', `${stats.failedTransformIds.length} records failed transformation: [${stats.failedTransformIds.join(', ')}]`);
    }

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
        skipped: stats.skipped,
        errors: stats.errors.length,
        failedTransforms: stats.failedTransformIds.length,
        durationMs: duration,
        updatedParentLinks,
      },
    });

    // Validate minimum count
    if (!dryRun && stats.processed < 200) {
      throw new Error(
        `Committee count (${stats.processed}) is below minimum expected (200). ` +
        'This may indicate an API issue or incomplete data.'
      );
    }

  } catch (error) {
    log('error', `Committees import failed: ${error}`);
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}
