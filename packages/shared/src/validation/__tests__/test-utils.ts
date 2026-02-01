/**
 * Test utilities for validation performance measurement
 *
 * @module @ltip/shared/validation/__tests__/test-utils
 */

/**
 * Performance measurement result
 */
export interface PerformanceResult<T> {
  /** The return value of the measured function */
  result: T;

  /** Execution time in milliseconds */
  duration: number;
}

/**
 * Measures the performance of a function execution
 *
 * @param fn - Function to measure
 * @returns Result and execution duration in milliseconds
 *
 * @example
 * ```typescript
 * const { result, duration } = measurePerformance(() => isValidBillId(longString));
 * expect(duration).toBeLessThan(1); // Sub-millisecond requirement
 * ```
 */
export function measurePerformance<T>(fn: () => T): PerformanceResult<T> {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  return {
    result,
    duration: end - start,
  };
}
