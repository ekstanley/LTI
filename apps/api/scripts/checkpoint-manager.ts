/**
 * Checkpoint Manager
 *
 * Provides checkpoint-based resumability for long-running import operations.
 * Checkpoints are persisted to JSON files with atomic writes and backup rotation.
 *
 * @module scripts/checkpoint-manager
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CHECKPOINT_CONFIG, IMPORT_PHASES, type ImportPhase } from './import-config.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * State of the import checkpoint.
 */
export interface CheckpointState {
  /** Current import phase */
  phase: ImportPhase;

  /** Current Congress being processed (if applicable) */
  congress: number | null;

  /** Current offset within the phase */
  offset: number;

  /** Bill type being processed (for bills phase) */
  billType: string | null;

  /** Records processed in current phase */
  recordsProcessed: number;

  /** Total records expected in current phase (estimated) */
  totalExpected: number;

  /** Timestamp when checkpoint was created */
  timestamp: string;

  /** Start time of the import */
  importStartedAt: string;

  /** Phase-specific metadata */
  metadata: Record<string, unknown>;

  /** Completed phases */
  completedPhases: ImportPhase[];

  /** Error if the import failed */
  lastError: string | null;

  /** Import run ID for tracking */
  runId: string;
}

/**
 * Options for creating a new checkpoint.
 */
export interface CheckpointCreateOptions {
  /** Starting phase */
  phase?: ImportPhase;

  /** Custom run ID (auto-generated if not provided) */
  runId?: string;
}

/**
 * Options for updating a checkpoint.
 */
export interface CheckpointUpdateOptions {
  /** New phase */
  phase?: ImportPhase;

  /** Current congress */
  congress?: number | null;

  /** Current offset */
  offset?: number;

  /** Bill type (for bills phase) */
  billType?: string | null;

  /** Records processed */
  recordsProcessed?: number;

  /** Total expected */
  totalExpected?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Mark a phase as completed */
  completePhase?: ImportPhase;

  /** Error message */
  lastError?: string | null;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Zod schema for runtime validation of CheckpointState.
 * Ensures checkpoint data loaded from disk matches expected structure.
 */
const CheckpointStateSchema = z.object({
  phase: z.enum(['legislators', 'committees', 'bills', 'votes', 'validate']),
  congress: z.number().nullable(),
  offset: z.number(),
  billType: z.string().nullable(),
  recordsProcessed: z.number(),
  totalExpected: z.number(),
  timestamp: z.string(),
  importStartedAt: z.string(),
  metadata: z.record(z.unknown()),
  completedPhases: z.array(z.enum(['legislators', 'committees', 'bills', 'votes', 'validate'])),
  lastError: z.string().nullable(),
  runId: z.string(),
});

// =============================================================================
// CHECKPOINT MANAGER CLASS
// =============================================================================

/**
 * Manages checkpoint persistence for import operations.
 *
 * Features:
 * - Atomic file writes (write to temp, rename)
 * - Backup rotation
 * - Phase tracking
 * - Resumable from any point
 */
export class CheckpointManager {
  private state: CheckpointState | null = null;
  private readonly checkpointPath: string;
  private readonly backupPath: string;
  private readonly directory: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave = false;

  constructor(directory?: string) {
    this.directory = directory ?? CHECKPOINT_CONFIG.directory;
    this.checkpointPath = path.join(this.directory, CHECKPOINT_CONFIG.mainCheckpoint);
    this.backupPath = path.join(this.directory, CHECKPOINT_CONFIG.backupCheckpoint);
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Initialize checkpoint manager.
   * Creates directory if it doesn't exist.
   */
  initialize(): void {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * Create a new checkpoint, starting fresh.
   */
  create(options: CheckpointCreateOptions = {}): CheckpointState {
    this.initialize();

    const runId = options.runId ?? this.generateRunId();
    const now = new Date().toISOString();

    this.state = {
      phase: options.phase ?? IMPORT_PHASES[0],
      congress: null,
      offset: 0,
      billType: null,
      recordsProcessed: 0,
      totalExpected: 0,
      timestamp: now,
      importStartedAt: now,
      metadata: {},
      completedPhases: [],
      lastError: null,
      runId,
    };

    this.saveSync();
    return this.state;
  }

  /**
   * Load existing checkpoint from disk.
   * Returns null if no checkpoint exists.
   */
  load(): CheckpointState | null {
    this.initialize();

    // Try main checkpoint first
    if (fs.existsSync(this.checkpointPath)) {
      try {
        const data = fs.readFileSync(this.checkpointPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Validate checkpoint structure before assigning
        const validationResult = CheckpointStateSchema.safeParse(parsed);

        if (validationResult.success) {
          this.state = validationResult.data;
          return this.state;
        } else {
          // Log specific validation failures
          console.error('Main checkpoint validation failed:');
          validationResult.error.errors.forEach((err) => {
            console.error(`  - Field "${err.path.join('.')}": ${err.message}`);
          });
          console.warn('Attempting to load from backup checkpoint...');
        }
      } catch (error) {
        console.warn(`Failed to load main checkpoint: ${error}`);
      }
    }

    // Try backup if main fails
    if (fs.existsSync(this.backupPath)) {
      try {
        const data = fs.readFileSync(this.backupPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Validate backup checkpoint structure
        const validationResult = CheckpointStateSchema.safeParse(parsed);

        if (validationResult.success) {
          this.state = validationResult.data;
          console.info('Loaded from backup checkpoint');
          return this.state;
        } else {
          // Log specific validation failures for backup
          console.error('Backup checkpoint validation failed:');
          validationResult.error.errors.forEach((err) => {
            console.error(`  - Field "${err.path.join('.')}": ${err.message}`);
          });
          console.error('Both main and backup checkpoints are invalid. Starting fresh.');
        }
      } catch (error) {
        console.warn(`Failed to load backup checkpoint: ${error}`);
      }
    }

    return null;
  }

  /**
   * Load checkpoint or create new if none exists.
   */
  loadOrCreate(options: CheckpointCreateOptions = {}): CheckpointState {
    const existing = this.load();
    if (existing) {
      return existing;
    }
    return this.create(options);
  }

  /**
   * Get current checkpoint state.
   */
  getState(): CheckpointState | null {
    return this.state;
  }

  // ---------------------------------------------------------------------------
  // UPDATE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Update checkpoint with new values.
   * Triggers debounced save.
   */
  update(options: CheckpointUpdateOptions): CheckpointState {
    if (!this.state) {
      throw new Error('No checkpoint initialized. Call create() or load() first.');
    }

    // Update fields
    if (options.phase !== undefined) {
      this.state.phase = options.phase;
    }
    if (options.congress !== undefined) {
      this.state.congress = options.congress;
    }
    if (options.offset !== undefined) {
      this.state.offset = options.offset;
    }
    if (options.billType !== undefined) {
      this.state.billType = options.billType;
    }
    if (options.recordsProcessed !== undefined) {
      this.state.recordsProcessed = options.recordsProcessed;
    }
    if (options.totalExpected !== undefined) {
      this.state.totalExpected = options.totalExpected;
    }
    if (options.metadata !== undefined) {
      this.state.metadata = { ...this.state.metadata, ...options.metadata };
    }
    if (options.lastError !== undefined) {
      this.state.lastError = options.lastError;
    }
    if (options.completePhase && !this.state.completedPhases.includes(options.completePhase)) {
      this.state.completedPhases.push(options.completePhase);
    }

    this.state.timestamp = new Date().toISOString();

    // Schedule debounced save
    this.scheduleSave();

    return this.state;
  }

  /**
   * Advance to the next import phase.
   */
  advancePhase(): CheckpointState {
    if (!this.state) {
      throw new Error('No checkpoint initialized');
    }

    const currentIndex = IMPORT_PHASES.indexOf(this.state.phase);
    if (currentIndex === -1 || currentIndex >= IMPORT_PHASES.length - 1) {
      throw new Error(`Cannot advance from phase: ${this.state.phase}`);
    }

    // Mark current phase as completed
    if (!this.state.completedPhases.includes(this.state.phase)) {
      this.state.completedPhases.push(this.state.phase);
    }

    // Move to next phase (index is validated above to be within bounds)
    const nextPhase = IMPORT_PHASES[currentIndex + 1];
    if (!nextPhase) {
      throw new Error(`Invalid phase index: ${currentIndex + 1}`);
    }
    this.state.phase = nextPhase;
    this.state.offset = 0;
    this.state.recordsProcessed = 0;
    this.state.congress = null;
    this.state.billType = null;
    this.state.totalExpected = 0;
    this.state.metadata = {};
    this.state.timestamp = new Date().toISOString();

    this.saveSync();
    return this.state;
  }

  /**
   * Mark the current phase as completed without advancing.
   */
  completeCurrentPhase(): void {
    if (!this.state) {
      throw new Error('No checkpoint initialized');
    }

    if (!this.state.completedPhases.includes(this.state.phase)) {
      this.state.completedPhases.push(this.state.phase);
      this.state.timestamp = new Date().toISOString();
      this.saveSync();
    }
  }

  /**
   * Record an error in the checkpoint.
   */
  recordError(error: string | Error): void {
    if (!this.state) {
      return;
    }

    this.state.lastError = error instanceof Error ? error.message : error;
    this.state.timestamp = new Date().toISOString();
    this.saveSync();
  }

  // ---------------------------------------------------------------------------
  // PERSISTENCE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Save checkpoint to disk (synchronous).
   * Uses atomic write pattern: write to temp, then rename.
   */
  saveSync(): void {
    if (!this.state) {
      return;
    }

    this.initialize();

    const tempPath = `${this.checkpointPath}.tmp`;

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');

      // Rotate backup if main exists
      if (fs.existsSync(this.checkpointPath)) {
        fs.copyFileSync(this.checkpointPath, this.backupPath);
      }

      // Atomic rename
      fs.renameSync(tempPath, this.checkpointPath);

      this.pendingSave = false;
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * Schedule a debounced save.
   */
  private scheduleSave(): void {
    this.pendingSave = true;

    if (this.saveTimer) {
      return; // Already scheduled
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.pendingSave) {
        this.saveSync();
      }
    }, CHECKPOINT_CONFIG.saveIntervalMs);
  }

  /**
   * Flush any pending saves immediately.
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.pendingSave) {
      this.saveSync();
    }
  }

  // ---------------------------------------------------------------------------
  // RESET METHODS
  // ---------------------------------------------------------------------------

  /**
   * Delete checkpoint files and reset state.
   */
  reset(): void {
    this.flush();

    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
    }
    if (fs.existsSync(this.backupPath)) {
      fs.unlinkSync(this.backupPath);
    }

    this.state = null;
  }

  /**
   * Clear checkpoint state in memory without deleting files.
   */
  clear(): void {
    this.flush();
    this.state = null;
  }

  // ---------------------------------------------------------------------------
  // QUERY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Check if a phase has been completed.
   */
  isPhaseCompleted(phase: ImportPhase): boolean {
    return this.state?.completedPhases.includes(phase) ?? false;
  }

  /**
   * Check if import is complete (all phases done).
   */
  isComplete(): boolean {
    if (!this.state) {
      return false;
    }
    return IMPORT_PHASES.every((phase) => this.state!.completedPhases.includes(phase));
  }

  /**
   * Get the next phase to execute.
   */
  getNextPhase(): ImportPhase | null {
    if (!this.state) {
      return IMPORT_PHASES[0];
    }

    for (const phase of IMPORT_PHASES) {
      if (!this.state.completedPhases.includes(phase)) {
        return phase;
      }
    }

    return null; // All complete
  }

  /**
   * Get progress summary for display.
   */
  getProgressSummary(): {
    runId: string;
    phase: ImportPhase;
    progress: number;
    elapsed: string;
    completedPhases: number;
    totalPhases: number;
  } | null {
    if (!this.state) {
      return null;
    }

    const progress =
      this.state.totalExpected > 0
        ? Math.round((this.state.recordsProcessed / this.state.totalExpected) * 100)
        : 0;

    const elapsed = this.formatDuration(
      new Date().getTime() - new Date(this.state.importStartedAt).getTime()
    );

    return {
      runId: this.state.runId,
      phase: this.state.phase,
      progress,
      elapsed,
      completedPhases: this.state.completedPhases.length,
      totalPhases: IMPORT_PHASES.length,
    };
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique run ID.
   */
  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `import-${timestamp}-${random}`;
  }

  /**
   * Format duration in human-readable form.
   */
  private formatDuration(ms: number): string {
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
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let checkpointManagerInstance: CheckpointManager | null = null;

/**
 * Get the singleton checkpoint manager instance.
 */
export function getCheckpointManager(): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager();
  }
  return checkpointManagerInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetCheckpointManager(): void {
  if (checkpointManagerInstance) {
    checkpointManagerInstance.clear();
    checkpointManagerInstance = null;
  }
}
