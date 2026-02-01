import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/__tests__/**',
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 100,
        statements: 90,
      },
    },
    testTimeout: 5000,
  },
});
