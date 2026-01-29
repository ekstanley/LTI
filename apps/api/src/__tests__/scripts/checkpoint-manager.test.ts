/**
 * Checkpoint Manager Unit Tests
 *
 * Tests for the checkpoint persistence and state management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  CheckpointManager,
  getCheckpointManager,
  resetCheckpointManager,
  type CheckpointState,
} from '../../../scripts/checkpoint-manager.js';

describe('CheckpointManager', () => {
  let testDir: string;
  let manager: CheckpointManager;

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-test-'));
    manager = new CheckpointManager(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    resetCheckpointManager();
  });

  describe('create', () => {
    it('creates a new checkpoint with default values', () => {
      const state = manager.create();

      expect(state).toBeDefined();
      expect(state.phase).toBe('legislators');
      expect(state.congress).toBeNull();
      expect(state.offset).toBe(0);
      expect(state.recordsProcessed).toBe(0);
      expect(state.completedPhases).toEqual([]);
      expect(state.lastError).toBeNull();
      expect(state.runId).toMatch(/^import-/);
    });

    it('creates checkpoint with custom starting phase', () => {
      const state = manager.create({ phase: 'bills' });

      expect(state.phase).toBe('bills');
    });

    it('creates checkpoint with custom run ID', () => {
      const state = manager.create({ runId: 'test-run-123' });

      expect(state.runId).toBe('test-run-123');
    });

    it('persists checkpoint to disk', () => {
      manager.create();

      const checkpointPath = path.join(testDir, 'import-checkpoint.json');
      expect(fs.existsSync(checkpointPath)).toBe(true);
    });

    it('creates directory if it does not exist', () => {
      const nestedDir = path.join(testDir, 'nested', 'checkpoint');
      const nestedManager = new CheckpointManager(nestedDir);

      nestedManager.create();

      expect(fs.existsSync(nestedDir)).toBe(true);
    });
  });

  describe('load', () => {
    it('loads existing checkpoint from disk', () => {
      // Create and save a checkpoint
      const created = manager.create({ runId: 'test-load' });
      manager.update({ offset: 500, recordsProcessed: 500 });
      manager.flush();

      // Create new manager and load
      const newManager = new CheckpointManager(testDir);
      const loaded = newManager.load();

      expect(loaded).toBeDefined();
      expect(loaded!.runId).toBe('test-load');
      expect(loaded!.offset).toBe(500);
      expect(loaded!.recordsProcessed).toBe(500);
    });

    it('returns null when no checkpoint exists', () => {
      const loaded = manager.load();

      expect(loaded).toBeNull();
    });

    it('loads from backup if main checkpoint is corrupted', () => {
      // Create a valid checkpoint
      manager.create({ runId: 'backup-test' });
      manager.flush();

      // Corrupt the main checkpoint
      const mainPath = path.join(testDir, 'import-checkpoint.json');
      fs.writeFileSync(mainPath, 'invalid json{{{');

      // Create backup
      const backupPath = path.join(testDir, 'import-checkpoint.backup.json');
      const validState: CheckpointState = {
        phase: 'legislators',
        congress: null,
        offset: 100,
        billType: null,
        recordsProcessed: 100,
        totalExpected: 500,
        timestamp: new Date().toISOString(),
        importStartedAt: new Date().toISOString(),
        metadata: {},
        completedPhases: [],
        lastError: null,
        runId: 'backup-test',
      };
      fs.writeFileSync(backupPath, JSON.stringify(validState));

      // Load should use backup
      const newManager = new CheckpointManager(testDir);
      const loaded = newManager.load();

      expect(loaded).toBeDefined();
      expect(loaded!.offset).toBe(100);
    });
  });

  describe('loadOrCreate', () => {
    it('loads existing checkpoint if present', () => {
      manager.create({ runId: 'existing' });
      manager.flush();

      const newManager = new CheckpointManager(testDir);
      const state = newManager.loadOrCreate({ runId: 'new' });

      expect(state.runId).toBe('existing');
    });

    it('creates new checkpoint if none exists', () => {
      const state = manager.loadOrCreate({ runId: 'new-created' });

      expect(state.runId).toBe('new-created');
    });
  });

  describe('update', () => {
    it('updates checkpoint fields', () => {
      manager.create();

      const updated = manager.update({
        congress: 118,
        offset: 1000,
        recordsProcessed: 1000,
        totalExpected: 15000,
      });

      expect(updated.congress).toBe(118);
      expect(updated.offset).toBe(1000);
      expect(updated.recordsProcessed).toBe(1000);
      expect(updated.totalExpected).toBe(15000);
    });

    it('updates phase', () => {
      manager.create();

      manager.update({ phase: 'bills' });

      expect(manager.getState()!.phase).toBe('bills');
    });

    it('merges metadata', () => {
      manager.create();
      manager.update({ metadata: { key1: 'value1' } });
      manager.update({ metadata: { key2: 'value2' } });

      const state = manager.getState()!;
      expect(state.metadata).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('adds completed phase', () => {
      manager.create();

      manager.update({ completePhase: 'legislators' });

      expect(manager.getState()!.completedPhases).toContain('legislators');
    });

    it('does not duplicate completed phases', () => {
      manager.create();

      manager.update({ completePhase: 'legislators' });
      manager.update({ completePhase: 'legislators' });

      const phases = manager.getState()!.completedPhases;
      expect(phases.filter((p) => p === 'legislators')).toHaveLength(1);
    });

    it('updates timestamp on each update', () => {
      manager.create();
      const timestamp1 = manager.getState()!.timestamp;

      // Small delay to ensure different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      manager.update({ offset: 100 });
      const timestamp2 = manager.getState()!.timestamp;

      vi.useRealTimers();

      expect(new Date(timestamp2).getTime()).toBeGreaterThan(new Date(timestamp1).getTime());
    });

    it('throws if no checkpoint initialized', () => {
      expect(() => manager.update({ offset: 100 })).toThrow('No checkpoint initialized');
    });
  });

  describe('advancePhase', () => {
    it('advances to next phase', () => {
      manager.create();

      const state = manager.advancePhase();

      expect(state.phase).toBe('committees');
      expect(state.completedPhases).toContain('legislators');
    });

    it('resets offset and records when advancing', () => {
      manager.create();
      manager.update({ offset: 500, recordsProcessed: 500 });

      const state = manager.advancePhase();

      expect(state.offset).toBe(0);
      expect(state.recordsProcessed).toBe(0);
    });

    it('advances through all phases', () => {
      manager.create();

      manager.advancePhase(); // legislators -> committees
      manager.advancePhase(); // committees -> bills
      manager.advancePhase(); // bills -> votes
      manager.advancePhase(); // votes -> validate

      expect(manager.getState()!.phase).toBe('validate');
      expect(manager.getState()!.completedPhases).toEqual([
        'legislators',
        'committees',
        'bills',
        'votes',
      ]);
    });

    it('throws when trying to advance past last phase', () => {
      manager.create();
      manager.update({ phase: 'validate' });

      expect(() => manager.advancePhase()).toThrow('Cannot advance from phase: validate');
    });
  });

  describe('recordError', () => {
    it('records string error', () => {
      manager.create();

      manager.recordError('API rate limit exceeded');

      expect(manager.getState()!.lastError).toBe('API rate limit exceeded');
    });

    it('records Error object', () => {
      manager.create();

      manager.recordError(new Error('Connection failed'));

      expect(manager.getState()!.lastError).toBe('Connection failed');
    });

    it('saves checkpoint after recording error', () => {
      manager.create();
      manager.recordError('Test error');

      const newManager = new CheckpointManager(testDir);
      const loaded = newManager.load();

      expect(loaded!.lastError).toBe('Test error');
    });
  });

  describe('reset', () => {
    it('deletes checkpoint files', () => {
      manager.create();
      manager.flush();

      const checkpointPath = path.join(testDir, 'import-checkpoint.json');
      expect(fs.existsSync(checkpointPath)).toBe(true);

      manager.reset();

      expect(fs.existsSync(checkpointPath)).toBe(false);
    });

    it('clears state', () => {
      manager.create();

      manager.reset();

      expect(manager.getState()).toBeNull();
    });
  });

  describe('isPhaseCompleted', () => {
    it('returns false for incomplete phase', () => {
      manager.create();

      expect(manager.isPhaseCompleted('legislators')).toBe(false);
    });

    it('returns true for completed phase', () => {
      manager.create();
      manager.update({ completePhase: 'legislators' });

      expect(manager.isPhaseCompleted('legislators')).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('returns false when phases remain', () => {
      manager.create();

      expect(manager.isComplete()).toBe(false);
    });

    it('returns true when all phases completed', () => {
      manager.create();
      manager.update({ completePhase: 'legislators' });
      manager.update({ completePhase: 'committees' });
      manager.update({ completePhase: 'bills' });
      manager.update({ completePhase: 'votes' });
      manager.update({ completePhase: 'validate' });

      expect(manager.isComplete()).toBe(true);
    });
  });

  describe('getNextPhase', () => {
    it('returns first phase when none completed', () => {
      manager.create();

      expect(manager.getNextPhase()).toBe('legislators');
    });

    it('returns next incomplete phase', () => {
      manager.create();
      manager.update({ completePhase: 'legislators' });
      manager.update({ completePhase: 'committees' });

      expect(manager.getNextPhase()).toBe('bills');
    });

    it('returns null when all complete', () => {
      manager.create();
      manager.update({ completePhase: 'legislators' });
      manager.update({ completePhase: 'committees' });
      manager.update({ completePhase: 'bills' });
      manager.update({ completePhase: 'votes' });
      manager.update({ completePhase: 'validate' });

      expect(manager.getNextPhase()).toBeNull();
    });
  });

  describe('getProgressSummary', () => {
    it('returns progress summary', () => {
      manager.create({ runId: 'progress-test' });
      manager.update({
        phase: 'bills',
        recordsProcessed: 5000,
        totalExpected: 10000,
        completePhase: 'legislators',
      });

      const summary = manager.getProgressSummary();

      expect(summary).toBeDefined();
      expect(summary!.runId).toBe('progress-test');
      expect(summary!.phase).toBe('bills');
      expect(summary!.progress).toBe(50);
      expect(summary!.completedPhases).toBe(1);
      expect(summary!.totalPhases).toBe(5);
    });

    it('returns null when no checkpoint', () => {
      expect(manager.getProgressSummary()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('returns same instance', () => {
      const instance1 = getCheckpointManager();
      const instance2 = getCheckpointManager();

      expect(instance1).toBe(instance2);
    });

    it('resets singleton instance', () => {
      const instance1 = getCheckpointManager();
      resetCheckpointManager();
      const instance2 = getCheckpointManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});
