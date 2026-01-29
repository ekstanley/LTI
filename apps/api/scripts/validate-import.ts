/**
 * Validate Import
 *
 * Post-import validation phase that verifies data integrity and quality.
 * Runs comprehensive checks to ensure the import completed successfully.
 *
 * Validation Checks:
 * 1. Record count thresholds - ensure minimum expected records exist
 * 2. Referential integrity - verify foreign keys are satisfied
 * 3. Data quality - spot-check for null required fields, invalid dates
 * 4. Cross-entity consistency - bills have sponsors, votes have legislators
 *
 * @module scripts/validate-import
 */

import { prisma } from '../src/db/client.js';
import { getCheckpointManager } from './checkpoint-manager.js';
import {
  ESTIMATED_COUNTS,
  TARGET_CONGRESSES,
  LOG_CONFIG,
  type ImportOptions,
} from './import-config.js';

// =============================================================================
// TYPES
// =============================================================================

interface ValidationResult {
  check: string;
  passed: boolean;
  expected?: number | string;
  actual?: number | string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationStats {
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  results: ValidationResult[];
}

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_CONFIG.level]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [validate]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// =============================================================================
// VALIDATION CHECKS
// =============================================================================

/**
 * Get minimum expected count threshold (80% of estimate)
 */
function getMinThreshold(estimated: number): number {
  return Math.floor(estimated * 0.8);
}

/**
 * Validate legislator count
 */
async function validateLegislatorCount(): Promise<ValidationResult> {
  const count = await prisma.legislator.count();
  const minExpected = getMinThreshold(ESTIMATED_COUNTS.legislators);

  return {
    check: 'Legislator Count',
    passed: count >= minExpected,
    expected: `>= ${minExpected}`,
    actual: count,
    message: count >= minExpected
      ? `${count} legislators imported (meets threshold)`
      : `Only ${count} legislators imported (expected >= ${minExpected})`,
    severity: count >= minExpected ? 'info' : 'error',
  };
}

/**
 * Validate committee count
 */
async function validateCommitteeCount(): Promise<ValidationResult> {
  const count = await prisma.committee.count();
  const minExpected = getMinThreshold(ESTIMATED_COUNTS.committees);

  return {
    check: 'Committee Count',
    passed: count >= minExpected,
    expected: `>= ${minExpected}`,
    actual: count,
    message: count >= minExpected
      ? `${count} committees imported (meets threshold)`
      : `Only ${count} committees imported (expected >= ${minExpected})`,
    severity: count >= minExpected ? 'info' : 'error',
  };
}

/**
 * Validate bill count per congress
 */
async function validateBillCounts(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const congress of TARGET_CONGRESSES) {
    const count = await prisma.bill.count({
      where: { congressNumber: congress },
    });

    const estimated = ESTIMATED_COUNTS.bills[congress] ?? 0;
    const minExpected = getMinThreshold(estimated);

    results.push({
      check: `Bill Count (Congress ${congress})`,
      passed: count >= minExpected,
      expected: `>= ${minExpected}`,
      actual: count,
      message: count >= minExpected
        ? `${count} bills for Congress ${congress} (meets threshold)`
        : `Only ${count} bills for Congress ${congress} (expected >= ${minExpected})`,
      severity: count >= minExpected ? 'info' : 'error',
    });
  }

  // Total bill count
  const totalCount = await prisma.bill.count();
  let totalExpected = 0;
  for (const congress of TARGET_CONGRESSES) {
    totalExpected += ESTIMATED_COUNTS.bills[congress] ?? 0;
  }
  const totalMinExpected = getMinThreshold(totalExpected);

  results.push({
    check: 'Total Bill Count',
    passed: totalCount >= totalMinExpected,
    expected: `>= ${totalMinExpected}`,
    actual: totalCount,
    message: totalCount >= totalMinExpected
      ? `${totalCount} total bills (meets threshold)`
      : `Only ${totalCount} total bills (expected >= ${totalMinExpected})`,
    severity: totalCount >= totalMinExpected ? 'info' : 'error',
  });

  return results;
}

/**
 * Validate vote count per congress
 */
async function validateVoteCounts(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const congress of TARGET_CONGRESSES) {
    const rollCallCount = await prisma.rollCallVote.count({
      where: { congressNumber: congress },
    });

    const estimated = ESTIMATED_COUNTS.votes[congress] ?? 0;
    // Use 50% threshold for votes (more variable)
    const minExpected = Math.floor(estimated * 0.5);

    results.push({
      check: `Roll Call Vote Count (Congress ${congress})`,
      passed: rollCallCount >= minExpected,
      expected: `>= ${minExpected}`,
      actual: rollCallCount,
      message: rollCallCount >= minExpected
        ? `${rollCallCount} roll calls for Congress ${congress} (meets threshold)`
        : `Only ${rollCallCount} roll calls for Congress ${congress} (expected >= ${minExpected})`,
      severity: rollCallCount >= minExpected ? 'info' : 'warning',
    });
  }

  // Total vote position count
  const positionCount = await prisma.vote.count();

  results.push({
    check: 'Total Vote Position Count',
    passed: positionCount > 0,
    expected: '> 0',
    actual: positionCount,
    message: positionCount > 0
      ? `${positionCount} individual vote positions recorded`
      : 'No vote positions found',
    severity: positionCount > 0 ? 'info' : 'warning',
  });

  return results;
}

/**
 * Validate referential integrity: bill sponsors
 */
async function validateBillSponsors(): Promise<ValidationResult> {
  // Count bills with sponsors that reference valid legislators
  const billsWithValidSponsors = await prisma.billSponsor.count({
    where: {
      isPrimary: true,
      legislator: { isNot: null },
    },
  });

  const totalBills = await prisma.bill.count();

  // At least 90% of bills should have a valid sponsor
  const threshold = Math.floor(totalBills * 0.9);
  const passed = billsWithValidSponsors >= threshold;

  return {
    check: 'Bill Sponsor Integrity',
    passed,
    expected: `>= ${threshold} (90% of bills)`,
    actual: billsWithValidSponsors,
    message: passed
      ? `${billsWithValidSponsors}/${totalBills} bills have valid sponsors`
      : `Only ${billsWithValidSponsors}/${totalBills} bills have valid sponsors`,
    severity: passed ? 'info' : 'warning',
  };
}

/**
 * Validate referential integrity: committee hierarchy
 */
async function validateCommitteeHierarchy(): Promise<ValidationResult> {
  // Count subcommittees with invalid parent references
  const orphanedSubcommittees = await prisma.committee.count({
    where: {
      parentId: { not: null },
      parent: null,
    },
  });

  return {
    check: 'Committee Hierarchy Integrity',
    passed: orphanedSubcommittees === 0,
    expected: '0 orphaned subcommittees',
    actual: orphanedSubcommittees,
    message: orphanedSubcommittees === 0
      ? 'All subcommittees have valid parent committees'
      : `${orphanedSubcommittees} subcommittees have invalid parent references`,
    severity: orphanedSubcommittees === 0 ? 'info' : 'warning',
  };
}

/**
 * Validate referential integrity: votes reference valid legislators
 */
async function validateVoteLegislators(): Promise<ValidationResult> {
  // Count vote positions with invalid legislator references
  const orphanedVotes = await prisma.vote.count({
    where: {
      legislator: null,
    },
  });

  const totalVotes = await prisma.vote.count();

  // Allow up to 5% orphaned (historical legislators may not be in database)
  const threshold = Math.floor(totalVotes * 0.95);
  const validVotes = totalVotes - orphanedVotes;
  const passed = validVotes >= threshold;

  return {
    check: 'Vote Legislator Integrity',
    passed,
    expected: `>= ${threshold} valid votes (95%)`,
    actual: validVotes,
    message: passed
      ? `${validVotes}/${totalVotes} votes reference valid legislators`
      : `Only ${validVotes}/${totalVotes} votes reference valid legislators`,
    severity: passed ? 'info' : 'warning',
  };
}

/**
 * Validate referential integrity: votes reference valid roll calls
 */
async function validateVoteRollCalls(): Promise<ValidationResult> {
  const orphanedVotes = await prisma.vote.count({
    where: {
      rollCall: null,
    },
  });

  return {
    check: 'Vote Roll Call Integrity',
    passed: orphanedVotes === 0,
    expected: '0 orphaned votes',
    actual: orphanedVotes,
    message: orphanedVotes === 0
      ? 'All votes reference valid roll calls'
      : `${orphanedVotes} votes have invalid roll call references`,
    severity: orphanedVotes === 0 ? 'info' : 'error',
  };
}

/**
 * Validate data quality: bills have required fields
 */
async function validateBillDataQuality(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Bills without titles
  const billsWithoutTitle = await prisma.bill.count({
    where: {
      OR: [{ title: null }, { title: '' }],
    },
  });

  results.push({
    check: 'Bills with Title',
    passed: billsWithoutTitle === 0,
    expected: '0 bills without title',
    actual: billsWithoutTitle,
    message: billsWithoutTitle === 0
      ? 'All bills have titles'
      : `${billsWithoutTitle} bills are missing titles`,
    severity: billsWithoutTitle === 0 ? 'info' : 'warning',
  });

  // Bills without introduced date
  const billsWithoutDate = await prisma.bill.count({
    where: { introducedDate: null },
  });

  results.push({
    check: 'Bills with Introduced Date',
    passed: billsWithoutDate === 0,
    expected: '0 bills without introduced date',
    actual: billsWithoutDate,
    message: billsWithoutDate === 0
      ? 'All bills have introduced dates'
      : `${billsWithoutDate} bills are missing introduced dates`,
    severity: billsWithoutDate === 0 ? 'info' : 'warning',
  });

  return results;
}

/**
 * Validate data quality: legislators have required fields
 */
async function validateLegislatorDataQuality(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Legislators without names
  const legislatorsWithoutName = await prisma.legislator.count({
    where: {
      OR: [
        { lastName: null },
        { lastName: '' },
        { firstName: null },
        { firstName: '' },
      ],
    },
  });

  results.push({
    check: 'Legislators with Names',
    passed: legislatorsWithoutName === 0,
    expected: '0 legislators without names',
    actual: legislatorsWithoutName,
    message: legislatorsWithoutName === 0
      ? 'All legislators have names'
      : `${legislatorsWithoutName} legislators are missing names`,
    severity: legislatorsWithoutName === 0 ? 'info' : 'warning',
  });

  // Legislators without state
  const legislatorsWithoutState = await prisma.legislator.count({
    where: {
      OR: [{ state: null }, { state: '' }],
    },
  });

  results.push({
    check: 'Legislators with State',
    passed: legislatorsWithoutState === 0,
    expected: '0 legislators without state',
    actual: legislatorsWithoutState,
    message: legislatorsWithoutState === 0
      ? 'All legislators have states'
      : `${legislatorsWithoutState} legislators are missing states`,
    severity: legislatorsWithoutState === 0 ? 'info' : 'warning',
  });

  return results;
}

/**
 * Validate chamber distribution
 */
async function validateChamberDistribution(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Legislators by chamber
  const houseLegislators = await prisma.legislator.count({
    where: { chamber: 'HOUSE', inOffice: true },
  });

  const senateLegislators = await prisma.legislator.count({
    where: { chamber: 'SENATE', inOffice: true },
  });

  // House should have ~435 members
  results.push({
    check: 'House Member Count',
    passed: houseLegislators >= 400 && houseLegislators <= 450,
    expected: '400-450',
    actual: houseLegislators,
    message: houseLegislators >= 400 && houseLegislators <= 450
      ? `${houseLegislators} current House members (expected range)`
      : `${houseLegislators} current House members (outside expected range 400-450)`,
    severity: houseLegislators >= 400 && houseLegislators <= 450 ? 'info' : 'warning',
  });

  // Senate should have ~100 members
  results.push({
    check: 'Senate Member Count',
    passed: senateLegislators >= 95 && senateLegislators <= 105,
    expected: '95-105',
    actual: senateLegislators,
    message: senateLegislators >= 95 && senateLegislators <= 105
      ? `${senateLegislators} current Senate members (expected range)`
      : `${senateLegislators} current Senate members (outside expected range 95-105)`,
    severity: senateLegislators >= 95 && senateLegislators <= 105 ? 'info' : 'warning',
  });

  return results;
}

/**
 * Validate party distribution
 */
async function validatePartyDistribution(): Promise<ValidationResult> {
  const partyDistribution = await prisma.legislator.groupBy({
    by: ['party'],
    where: { inOffice: true },
    _count: true,
  });

  const parties = partyDistribution.map((p) => `${p.party}: ${p._count}`).join(', ');
  const majorParties = partyDistribution.filter(
    (p) => p.party === 'DEMOCRAT' || p.party === 'REPUBLICAN'
  );

  const hasMajorParties = majorParties.length === 2;
  const majorPartyCounts = majorParties.reduce((sum, p) => sum + p._count, 0);

  return {
    check: 'Party Distribution',
    passed: hasMajorParties && majorPartyCounts > 500,
    expected: 'Both major parties with >500 total members',
    actual: parties,
    message: hasMajorParties
      ? `Party distribution: ${parties}`
      : 'Missing expected major party representation',
    severity: hasMajorParties ? 'info' : 'warning',
  };
}

/**
 * Validate sync metadata
 */
async function validateSyncMetadata(): Promise<ValidationResult> {
  // Check that records have lastSyncedAt timestamps
  const billsWithSync = await prisma.bill.count({
    where: { lastSyncedAt: { not: null } },
  });

  const totalBills = await prisma.bill.count();
  const percentage = totalBills > 0 ? Math.round((billsWithSync / totalBills) * 100) : 0;

  return {
    check: 'Sync Metadata Present',
    passed: percentage >= 95,
    expected: '>= 95% records with sync timestamp',
    actual: `${percentage}%`,
    message: percentage >= 95
      ? `${percentage}% of bills have sync timestamps`
      : `Only ${percentage}% of bills have sync timestamps`,
    severity: percentage >= 95 ? 'info' : 'warning',
  };
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Run all validation checks on imported data.
 *
 * @param options - Import options (dryRun, verbose, etc.)
 */
export async function validateImport(options: ImportOptions): Promise<void> {
  const { dryRun = false, verbose = false } = options;
  const startTime = Date.now();

  log('info', `Starting import validation${dryRun ? ' (DRY RUN)' : ''}`);

  const manager = getCheckpointManager();

  // Initialize stats
  const stats: ValidationStats = {
    total: 0,
    passed: 0,
    warnings: 0,
    errors: 0,
    results: [],
  };

  try {
    // Run all validation checks
    log('info', '\n--- Record Count Validation ---');
    stats.results.push(await validateLegislatorCount());
    stats.results.push(await validateCommitteeCount());
    stats.results.push(...await validateBillCounts());
    stats.results.push(...await validateVoteCounts());

    log('info', '\n--- Referential Integrity Validation ---');
    stats.results.push(await validateBillSponsors());
    stats.results.push(await validateCommitteeHierarchy());
    stats.results.push(await validateVoteLegislators());
    stats.results.push(await validateVoteRollCalls());

    log('info', '\n--- Data Quality Validation ---');
    stats.results.push(...await validateBillDataQuality());
    stats.results.push(...await validateLegislatorDataQuality());

    log('info', '\n--- Distribution Validation ---');
    stats.results.push(...await validateChamberDistribution());
    stats.results.push(await validatePartyDistribution());

    log('info', '\n--- Metadata Validation ---');
    stats.results.push(await validateSyncMetadata());

    // Calculate stats
    for (const result of stats.results) {
      stats.total++;
      if (result.passed) {
        stats.passed++;
      } else if (result.severity === 'error') {
        stats.errors++;
      } else if (result.severity === 'warning') {
        stats.warnings++;
      }

      // Log each result
      const icon = result.passed ? '✓' : result.severity === 'error' ? '✗' : '⚠';
      const level = result.passed ? 'info' : result.severity === 'warning' ? 'warn' : 'error';
      log(level, `  ${icon} ${result.check}: ${result.message}`);

      if (verbose && !result.passed) {
        log('debug', `    Expected: ${result.expected}, Actual: ${result.actual}`);
      }
    }

    // Final summary
    const duration = Date.now() - startTime;
    const durationStr = `${Math.round(duration / 1000)}s`;

    log('info', '');
    log('info', '=== Validation Summary ===');
    log('info', `Total Checks: ${stats.total}`);
    log('info', `Passed: ${stats.passed}`);
    log('info', `Warnings: ${stats.warnings}`);
    log('info', `Errors: ${stats.errors}`);
    log('info', `Duration: ${durationStr}`);

    // Update checkpoint
    manager.update({
      recordsProcessed: stats.total,
      totalExpected: stats.total,
      metadata: {
        passed: stats.passed,
        warnings: stats.warnings,
        errors: stats.errors,
        durationMs: duration,
      },
    });

    // Determine overall result
    if (stats.errors > 0) {
      log('error', '\n✗ Validation FAILED - critical errors found');
      if (!dryRun) {
        throw new Error(`Validation failed with ${stats.errors} critical errors`);
      }
    } else if (stats.warnings > 0) {
      log('warn', '\n⚠ Validation completed with warnings');
    } else {
      log('info', '\n✓ Validation PASSED - all checks successful');
    }

  } catch (error) {
    log('error', `Validation failed: ${error}`);
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}
