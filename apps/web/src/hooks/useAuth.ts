/**
 * useAuth Hook: Consume authentication context
 *
 * Provides type-safe access to authentication state and methods.
 * Must be used within an AuthProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginForm onSubmit={login} />;
 *   }
 *
 *   return <div>Welcome, {user.name}!</div>;
 * }
 * ```
 */

import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext';

/**
 * Hook to access authentication context
 *
 * @returns Authentication context value
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
