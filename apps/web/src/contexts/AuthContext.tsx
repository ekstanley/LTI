/**
 * AuthContext: Centralized authentication state management
 *
 * Provides:
 * - Authentication state (user, token, isAuthenticated)
 * - Login/logout functionality
 * - Session persistence via localStorage
 * - Automatic token refresh on expiry
 * - CSRF token management
 */

'use client';

import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '@ltip/shared';
import {
  login as apiLogin,
  logout as apiLogout,
  refreshAuthToken,
  fetchCsrfToken,
  clearCsrfToken,
  getErrorMessage,
} from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

/**
 * Authentication state
 */
export interface AuthState {
  /** Current authenticated user (null if not authenticated) */
  user: User | null;
  /** JWT authentication token (null if not authenticated) */
  token: string | null;
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether authentication operation is in progress */
  isLoading: boolean;
  /** Current authentication error message (null if no error) */
  error: string | null;
}

/**
 * Authentication context value
 */
export interface AuthContextValue extends AuthState {
  /**
   * Login with email and password
   * @param email - User email
   * @param password - User password
   * @throws {Error} If login fails
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Logout current user
   */
  logout: () => Promise<void>;

  /**
   * Refresh authentication token
   * @throws {Error} If refresh fails
   */
  refreshToken: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for authentication token */
const TOKEN_STORAGE_KEY = 'auth_token';

/** localStorage key for user data */
const USER_STORAGE_KEY = 'auth_user';

/** Token refresh interval in milliseconds (5 minutes) */
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;

// ============================================================================
// Context
// ============================================================================

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JWT token to extract expiry time
 * @param token - JWT token string
 * @returns Expiry timestamp in seconds (null if invalid)
 */
function parseTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const decoded = JSON.parse(atob(payload)) as { exp?: number };
    return decoded.exp ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 * @param token - JWT token string
 * @returns True if token is expired or invalid
 */
function isTokenExpired(token: string): boolean {
  const expiry = parseTokenExpiry(token);
  if (!expiry) return true;

  // Consider token expired if it expires within next 60 seconds
  const now = Math.floor(Date.now() / 1000);
  return expiry <= now + 60;
}

/**
 * Save authentication data to localStorage
 */
function saveAuthToStorage(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save auth to localStorage:', error);
  }
}

/**
 * Load authentication data from localStorage
 * @returns Auth data or null if not found/invalid
 */
function loadAuthFromStorage(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userJson = localStorage.getItem(USER_STORAGE_KEY);

    if (!token || !userJson) {
      return null;
    }

    // Validate token is not expired
    if (isTokenExpired(token)) {
      clearAuthFromStorage();
      return null;
    }

    const user = JSON.parse(userJson) as User;

    // Basic validation of user object
    if (!user.id || !user.email || !user.name || !user.role) {
      clearAuthFromStorage();
      return null;
    }

    return { token, user };
  } catch (error) {
    console.error('Failed to load auth from localStorage:', error);
    clearAuthFromStorage();
    return null;
  }
}

/**
 * Clear authentication data from localStorage
 */
function clearAuthFromStorage(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear auth from localStorage:', error);
  }
}

// ============================================================================
// AuthProvider Component
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // Start with loading true (checking localStorage)
    error: null,
  });

  // ============================================================================
  // Initialization: Restore session from localStorage
  // ============================================================================

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const stored = loadAuthFromStorage();

      if (!stored) {
        // No stored auth or expired
        if (mounted) {
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
        return;
      }

      // Restore session
      if (mounted) {
        setState({
          user: stored.user,
          token: stored.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Fetch CSRF token for authenticated session
        try {
          await fetchCsrfToken();
        } catch (error) {
          console.error('Failed to fetch CSRF token on init:', error);
        }
      }
    }

    void initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================================
  // Token Refresh: Automatic refresh before expiry
  // ============================================================================

  useEffect(() => {
    if (!state.isAuthenticated || !state.token) {
      return;
    }

    const intervalId = setInterval(() => {
      // Check if token is about to expire
      if (isTokenExpired(state.token!)) {
        // Attempt to refresh
        void refreshToken().catch((error) => {
          console.error('Automatic token refresh failed:', error);
          // Clear auth state on refresh failure
          void logout();
        });
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [state.isAuthenticated, state.token]);

  // ============================================================================
  // Login Function
  // ============================================================================

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await apiLogin({ email, password });

      // Save to localStorage
      saveAuthToStorage(response.token, response.user);

      // Update state
      setState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Fetch CSRF token after successful login
      try {
        await fetchCsrfToken();
      } catch (csrfError) {
        console.error('Failed to fetch CSRF token after login:', csrfError);
        // Don't fail the login if CSRF token fetch fails
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      throw new Error(errorMessage);
    }
  }, []);

  // ============================================================================
  // Logout Function
  // ============================================================================

  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      // Call logout API (best effort, don't fail if it errors)
      await apiLogout();
    } catch (error) {
      console.error('Logout API call failed (continuing with local logout):', error);
    }

    // Always clear local state and storage (defensive)
    clearAuthFromStorage();
    clearCsrfToken();

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  // ============================================================================
  // Refresh Token Function
  // ============================================================================

  const refreshToken = useCallback(async (): Promise<void> => {
    if (!state.token) {
      throw new Error('No token to refresh');
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await refreshAuthToken();

      // Update storage
      saveAuthToStorage(response.token, response.user);

      // Update state
      setState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Fetch new CSRF token after refresh
      try {
        await fetchCsrfToken();
      } catch (csrfError) {
        console.error('Failed to fetch CSRF token after refresh:', csrfError);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // If refresh fails, clear auth state
      clearAuthFromStorage();
      clearCsrfToken();

      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      throw new Error(errorMessage);
    }
  }, [state.token]);

  // ============================================================================
  // Memoized Context Value
  // ============================================================================

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshToken,
    }),
    [state, login, logout, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
