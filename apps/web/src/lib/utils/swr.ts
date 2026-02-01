/**
 * SWR utility functions
 * @module lib/utils/swr
 */

/**
 * Create stable cache key from query parameters
 * Ensures consistent key ordering to prevent cache collisions in SWR
 *
 * @param resource - Resource identifier (e.g., 'bills', 'legislators')
 * @param params - Query parameters object
 * @returns Stable cache key array [resource, stringifiedParams]
 *
 * @example
 * ```ts
 * // These produce the SAME cache key:
 * createStableCacheKey('bills', { limit: 20, offset: 0 });
 * createStableCacheKey('bills', { offset: 0, limit: 20 });
 * // => ['bills', '{"limit":20,"offset":0}']
 * ```
 */
export function createStableCacheKey(
  resource: string,
  params: Record<string, unknown>
): [string, string] {
  // Sort keys alphabetically for consistent ordering
  const sortedKeys = Object.keys(params).sort();
  const stableParams: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined) {
      stableParams[key] = value;
    }
  }

  return [resource, JSON.stringify(stableParams)];
}
