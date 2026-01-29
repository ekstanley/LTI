#!/usr/bin/env node
/**
 * Bulk Import CLI
 *
 * Main orchestrator for the historical data import process.
 * Coordinates execution of import phases with checkpoint-based resumability.
 *
 * @example
 * ```bash
 * # Full import (or resume from checkpoint)
 * pnpm --filter @ltip/api run import:run
 *
 * # Dry run mode
 * pnpm --filter @ltip/api run import:dry-run
 *
 * # Show current status
 * pnpm --filter @ltip/api run import:status
 *
 * # Reset and start fresh
 * pnpm --filter @ltip/api run import:reset
 * ```
 *
 * @module scripts/bulk-import
 */

// Load environment variables from repository root
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

import { parseArgs } from 'util';
import {
  IMPORT_PHASES,
  PHASE_DEPENDENCIES,
  validateEnvironment,
  getConfigSummary,
  type ImportPhase,
  type ImportOptions,
} from './import-config.js';
import { getCheckpointManager } from './checkpoint-manager.js';

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

interface CliArgs {
  help: boolean;
  dryRun: boolean;
  resume: boolean;
  status: boolean;
  reset: boolean;
  force: boolean;
  verbose: boolean;
  phase?: string;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'dry-run': { type: 'boolean', short: 'd', default: false },
      resume: { type: 'boolean', short: 'r', default: false },
      status: { type: 'boolean', short: 's', default: false },
      reset: { type: 'boolean', default: false },
      force: { type: 'boolean', short: 'f', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      phase: { type: 'string', short: 'p' },
    },
    strict: true,
  });

  // With exactOptionalPropertyTypes, only include phase when defined
  const args: CliArgs = {
    help: values.help ?? false,
    dryRun: values['dry-run'] ?? false,
    resume: values.resume ?? false,
    status: values.status ?? false,
    reset: values.reset ?? false,
    force: values.force ?? false,
    verbose: values.verbose ?? false,
  };
  if (values.phase !== undefined) {
    args.phase = values.phase;
  }
  return args;
}

function printHelp(): void {
  console.log(`
Bulk Import CLI - Historical Data Load for LTIP

Usage: bulk-import [options]

Options:
  -h, --help      Show this help message
  -d, --dry-run   Run without making database changes
  -r, --resume    Resume from last checkpoint (default behavior)
  -s, --status    Show current import status
  --reset         Delete checkpoint and start fresh
  -f, --force     Force re-import (ignore existing data)
  -v, --verbose   Enable verbose logging
  -p, --phase     Run specific phase only (legislators|committees|bills|votes|validate)

Examples:
  bulk-import                    # Run full import (or resume)
  bulk-import --dry-run          # Test run without database changes
  bulk-import --status           # Check current progress
  bulk-import --reset            # Start fresh
  bulk-import --phase legislators # Run only legislators phase

Phases (in order):
  1. legislators  - Import all legislators from Congress.gov
  2. committees   - Import committee structure
  3. bills        - Import bills for Congress 118-119
  4. votes        - Import roll call votes
  5. validate     - Validate imported data
`);
}

// =============================================================================
// STATUS DISPLAY
// =============================================================================

function showStatus(): void {
  const manager = getCheckpointManager();
  const state = manager.load();

  console.log('\n=== Import Status ===\n');

  if (!state) {
    console.log('No import in progress.');
    console.log('\nRun `bulk-import` to start a new import.');
    return;
  }

  const summary = manager.getProgressSummary()!;

  console.log(`Run ID:        ${summary.runId}`);
  console.log(`Current Phase: ${summary.phase}`);
  console.log(`Progress:      ${summary.progress}%`);
  console.log(`Elapsed:       ${summary.elapsed}`);
  console.log(`Phases:        ${summary.completedPhases}/${summary.totalPhases} complete`);
  console.log('');

  // Phase breakdown
  console.log('Phase Status:');
  for (const phase of IMPORT_PHASES) {
    const isComplete = state.completedPhases.includes(phase);
    const isCurrent = state.phase === phase && !isComplete;
    const icon = isComplete ? '✓' : isCurrent ? '→' : ' ';
    const status = isComplete ? 'COMPLETE' : isCurrent ? 'IN PROGRESS' : 'PENDING';
    console.log(`  ${icon} ${phase.padEnd(12)} ${status}`);
  }

  // Current progress details
  if (state.recordsProcessed > 0) {
    console.log('');
    console.log('Current Phase Details:');
    console.log(`  Records: ${state.recordsProcessed}/${state.totalExpected || '?'}`);
    if (state.congress) console.log(`  Congress: ${state.congress}`);
    if (state.billType) console.log(`  Bill Type: ${state.billType}`);
    if (state.offset > 0) console.log(`  Offset: ${state.offset}`);
  }

  // Error status
  if (state.lastError) {
    console.log('');
    console.log('⚠️  Last Error:', state.lastError);
  }

  console.log('');
}

// =============================================================================
// PHASE EXECUTION
// =============================================================================

/**
 * Import function type for each phase.
 */
type PhaseImporter = (options: ImportOptions) => Promise<void>;

/**
 * Get the import function for a phase.
 * These will be implemented in separate files.
 */
async function getPhaseImporter(phase: ImportPhase): Promise<PhaseImporter> {
  switch (phase) {
    case 'legislators':
      return (await import('./import-legislators.js')).importLegislators;
    case 'committees':
      return (await import('./import-committees.js')).importCommittees;
    case 'bills':
      return (await import('./import-bills.js')).importBills;
    case 'votes':
      return (await import('./import-votes.js')).importVotes;
    case 'validate':
      return (await import('./validate-import.js')).validateImport;
  }
}

/**
 * Check if all dependencies for a phase are satisfied.
 */
function areDependenciesMet(phase: ImportPhase, completedPhases: ImportPhase[]): boolean {
  const deps = PHASE_DEPENDENCIES[phase];
  return deps.every((dep) => completedPhases.includes(dep));
}

/**
 * Execute a single import phase.
 */
async function executePhase(phase: ImportPhase, options: ImportOptions): Promise<void> {
  const manager = getCheckpointManager();
  const state = manager.getState()!;

  // Check dependencies
  if (!areDependenciesMet(phase, state.completedPhases)) {
    const deps = PHASE_DEPENDENCIES[phase];
    throw new Error(
      `Phase '${phase}' requires phases [${deps.join(', ')}] to be completed first`
    );
  }

  console.log(`\n--- Phase: ${phase} ---\n`);

  // Check if we're resuming the same phase or starting a new one
  // WP7-A-001 FIX: Reset offset when transitioning to a new phase
  const isResumingSamePhase = state.phase === phase && state.recordsProcessed > 0;

  if (isResumingSamePhase) {
    // Resuming same phase - keep offset/recordsProcessed, just clear error
    manager.update({ lastError: null });
  } else {
    // Starting a new phase - reset all progress counters to avoid offset leakage
    manager.update({
      phase,
      lastError: null,
      offset: 0,
      recordsProcessed: 0,
      congress: null,
      billType: null,
      totalExpected: 0,
    });
  }

  try {
    // Get and execute importer
    const importer = await getPhaseImporter(phase);
    await importer(options);

    // Mark phase as complete
    manager.completeCurrentPhase();
    console.log(`\n✓ Phase '${phase}' completed successfully\n`);
  } catch (error) {
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}

/**
 * Execute all remaining phases.
 */
async function executeAllPhases(options: ImportOptions): Promise<void> {
  const manager = getCheckpointManager();

  while (true) {
    const nextPhase = manager.getNextPhase();
    if (!nextPhase) {
      console.log('\n✓ All phases completed!\n');
      break;
    }

    await executePhase(nextPhase, options);
  }
}

// =============================================================================
// SIGNAL HANDLING
// =============================================================================

/**
 * Register handlers for graceful shutdown.
 */
function registerSignalHandlers(): void {
  const manager = getCheckpointManager();

  const handleShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Saving checkpoint and exiting...`);
    manager.flush();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('\nUncaught exception:', error);
    manager.recordError(error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('\nUnhandled rejection:', reason);
    manager.recordError(reason instanceof Error ? reason : String(reason));
    process.exit(1);
  });
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  // Parse CLI arguments
  let args: CliArgs;
  try {
    args = parseCliArgs();
  } catch (error) {
    console.error('Error parsing arguments:', error);
    printHelp();
    process.exit(1);
  }

  // Show help
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Show status
  if (args.status) {
    showStatus();
    process.exit(0);
  }

  // Reset checkpoint
  if (args.reset) {
    const manager = getCheckpointManager();
    manager.reset();
    console.log('✓ Checkpoint reset. Run `bulk-import` to start a new import.');
    process.exit(0);
  }

  // Validate environment
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    console.error('Environment validation failed:');
    envValidation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  // Register signal handlers
  registerSignalHandlers();

  // Initialize checkpoint manager
  const manager = getCheckpointManager();

  // Load or create checkpoint
  if (args.force) {
    manager.reset();
    manager.create();
    console.log('Starting fresh import (--force)');
  } else {
    manager.loadOrCreate();
    const state = manager.getState()!;
    if (state.completedPhases.length > 0) {
      console.log(`Resuming import (run: ${state.runId})`);
      console.log(`Completed phases: ${state.completedPhases.join(', ')}`);
    } else {
      console.log(`Starting new import (run: ${state.runId})`);
    }
  }

  // Log configuration
  if (args.verbose) {
    console.log('\nConfiguration:');
    console.log(JSON.stringify(getConfigSummary(), null, 2));
  }

  // Build import options
  const options: ImportOptions = {
    dryRun: args.dryRun,
    verbose: args.verbose,
    force: args.force,
    resume: true, // Always resume by default
  };

  if (args.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No database changes will be made\n');
  }

  try {
    // Execute specific phase or all phases
    if (args.phase) {
      const phase = args.phase as ImportPhase;
      if (!IMPORT_PHASES.includes(phase)) {
        console.error(`Invalid phase: ${args.phase}`);
        console.error(`Valid phases: ${IMPORT_PHASES.join(', ')}`);
        process.exit(1);
      }
      await executePhase(phase, options);
    } else {
      await executeAllPhases(options);
    }

    // Final status
    showStatus();
    console.log('✓ Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Import failed:', error);
    showStatus();
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
