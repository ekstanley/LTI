/**
 * React hook for CSRF token management
 *
 * Usage:
 *   const { token, isLoading, error, refresh } = useCsrf();
 *
 * Call refresh() after successful authentication to fetch the initial token.
 * Subsequent requests will automatically rotate the token.
 */

import { useState, useCallback } from 'react';
import { fetchCsrfToken, getCsrfToken, clearCsrfToken } from '../lib/api';

interface UseCsrfResult {
  /** Current CSRF token (null if not yet fetched) */
  token: string | null;
  /** Whether token fetch is in progress */
  isLoading: boolean;
  /** Error from token fetch (if any) */
  error: Error | null;
  /** Manually fetch/refresh the CSRF token */
  refresh: () => Promise<void>;
  /** Clear the CSRF token (call on logout) */
  clear: () => void;
}

export function useCsrf(): UseCsrfResult {
  const [token, setToken] = useState<string | null>(getCsrfToken);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newToken = await fetchCsrfToken();
      setToken(newToken);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch CSRF token');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    clearCsrfToken();
    setToken(null);
    setError(null);
  }, []);

  return {
    token,
    isLoading,
    error,
    refresh,
    clear,
  };
}
