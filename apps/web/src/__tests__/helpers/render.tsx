/**
 * Test render helpers with provider wrappers
 *
 * Provides SWR cache isolation and context providers for component tests.
 */

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/**
 * Creates a fresh SWR wrapper for each test.
 * Ensures no cache leakage between tests.
 */
export function createSWRWrapper() {
  return function SWRWrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig value={{ provider: () => new Map() }}>
        {children}
      </SWRConfig>
    );
  };
}
