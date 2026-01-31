/**
 * Test setup file for Vitest
 * Configures global test utilities and mocks
 */
import { beforeEach, afterEach, vi } from 'vitest';

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// Global test timeout
vi.setConfig({ testTimeout: 10000 });

// Suppress console errors in tests (re-enable for debugging)
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
