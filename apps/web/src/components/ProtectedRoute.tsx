/**
 * ProtectedRoute Component: Wrapper for routes requiring authentication
 *
 * Features:
 * - Checks authentication status
 * - Shows loading state during auth check
 * - Redirects to /login if not authenticated
 * - Preserves return URL for post-login redirect
 * - Renders children if authenticated
 *
 * @example
 * ```tsx
 * // In a page component
 * export default function DashboardPage() {
 *   return (
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   );
 * }
 * ```
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/common/LoadingState';

// ============================================================================
// Types
// ============================================================================

interface ProtectedRouteProps {
  /** Content to render if authenticated */
  children: React.ReactNode;
  /**
   * Redirect path for unauthenticated users
   * @default '/login'
   */
  redirectTo?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ProtectedRoute({
  children,
  redirectTo = '/login',
}: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while loading (checking auth state)
    if (isLoading) {
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      // Preserve current path for post-login redirect
      const returnUrl = encodeURIComponent(pathname || '/');
      const redirectUrl = `${redirectTo}?return=${returnUrl}` as const;
      router.push(redirectUrl as never);
    }
  }, [isAuthenticated, isLoading, router, pathname, redirectTo]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState message="Checking authentication..." />
      </div>
    );
  }

  // Don't render children until authenticated
  // (prevents flash of protected content before redirect)
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState message="Redirecting to login..." />
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}
