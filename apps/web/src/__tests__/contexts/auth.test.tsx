/**
 * Comprehensive test suite for authentication system
 *
 * Coverage:
 * - Unit Tests: AuthContext Provider (8 tests)
 * - Integration Tests: useAuth Hook (10 tests)
 * - Component Tests: ProtectedRoute (7 tests)
 *
 * Total: 25 tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { User, LoginResponse } from '@ltip/shared';
import * as api from '@/lib/api';

// ============================================================================
// Test Utilities
// ============================================================================

// Mock Next.js navigation
const mockPush = vi.fn();
const mockPathname = '/protected';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// Mock API functions
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    refreshAuthToken: vi.fn(),
    fetchCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  };
});

// Test user data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

// Valid JWT token (expires in future)
const mockToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.signature';

// Expired JWT token
const expiredToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTYwMDAwMDAwMH0.signature';

const mockLoginResponse: LoginResponse = {
  token: mockToken,
  user: mockUser,
};

// Test component that uses useAuth
function TestComponent(): JSX.Element {
  const { user, isAuthenticated, isLoading, error, login, logout } = useAuth();

  const handleLogin = () => {
    login('test@example.com', 'password').catch(() => {
      // Error is already set in auth state, no need to handle here
    });
  };

  const handleLogout = () => {
    logout().catch(() => {
      // Error handling if needed
    });
  };

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="loading-status">{isLoading ? 'loading' : 'not-loading'}</div>
      {user && <div data-testid="user-name">{user.name}</div>}
      {error && <div data-testid="error-message">{error}</div>}
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

// ============================================================================
// Test Setup/Teardown
// ============================================================================

beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();

  // Reset all mocks
  vi.clearAllMocks();

  // Mock CSRF token fetch (always succeeds)
  vi.mocked(api.fetchCsrfToken).mockResolvedValue('csrf-token');
});

afterEach(() => {
  // Clean up
  vi.restoreAllMocks();
});

// ============================================================================
// Unit Tests: AuthContext Provider
// ============================================================================

describe('AuthContext Provider', () => {
  it('should provide initial unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
  });

  it('should handle login flow with valid credentials', async () => {
    vi.mocked(api.login).mockResolvedValue(mockLoginResponse);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for init
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    // Click login button
    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    // Should show loading state
    expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');

    // Wait for login to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    // Should be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');

    // Should have called API
    expect(api.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });

    // Should have fetched CSRF token
    expect(api.fetchCsrfToken).toHaveBeenCalled();

    // Should have saved to localStorage
    expect(localStorage.getItem('auth_token')).toBe(mockToken);
    expect(localStorage.getItem('auth_user')).toBe(JSON.stringify(mockUser));
  });

  it('should handle login flow with invalid credentials (401)', async () => {
    const error = new api.ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password.');
    vi.mocked(api.login).mockRejectedValue(error);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    // Click login (error will be caught in the login function itself)
    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    // Wait for error
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Should not be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');

    // Should not save to localStorage
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should clear all state on logout', async () => {
    // Setup authenticated state
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    vi.mocked(api.logout).mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for session restore
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    const user = userEvent.setup();

    // Click logout
    await act(async () => {
      await user.click(screen.getByText('Logout'));
    });

    // Wait for logout to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    // Should have cleared localStorage
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();

    // Should have called logout API
    expect(api.logout).toHaveBeenCalled();

    // Should have cleared CSRF token
    expect(api.clearCsrfToken).toHaveBeenCalled();
  });

  it('should restore session from localStorage on mount', async () => {
    // Setup stored session
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should start with loading
    expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');

    // Wait for restore
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    // Should be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');

    // Should have fetched CSRF token
    expect(api.fetchCsrfToken).toHaveBeenCalled();
  });

  it('should not restore expired token from localStorage', async () => {
    // Setup expired token
    localStorage.setItem('auth_token', expiredToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    // Should not be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');

    // Should have cleared localStorage
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('should handle token refresh successfully', async () => {
    const refreshedToken = mockToken + '-refreshed';
    vi.mocked(api.refreshAuthToken).mockResolvedValue({
      token: refreshedToken,
      user: mockUser,
    });

    // Setup authenticated state
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    const TestRefreshComponent = () => {
      const { refreshToken } = useAuth();
      return <button onClick={() => void refreshToken()}>Refresh</button>;
    };

    render(
      <AuthProvider>
        <TestRefreshComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Click refresh
    await act(async () => {
      await user.click(screen.getByText('Refresh'));
    });

    // Wait for refresh to complete
    await waitFor(() => {
      expect(api.refreshAuthToken).toHaveBeenCalled();
    });

    // Should have updated localStorage
    expect(localStorage.getItem('auth_token')).toBe(refreshedToken);
  });

  it('should clear state if token refresh fails', async () => {
    vi.mocked(api.refreshAuthToken).mockRejectedValue(
      new Error('Token refresh failed')
    );

    // Setup authenticated state
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    const TestRefreshComponent = () => {
      const { refreshToken, isAuthenticated } = useAuth();
      return (
        <div>
          <div data-testid="auth-status">
            {isAuthenticated ? 'authenticated' : 'not-authenticated'}
          </div>
          <button onClick={() => void refreshToken().catch(() => {})}>Refresh</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestRefreshComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    const user = userEvent.setup();

    // Click refresh
    await act(async () => {
      await user.click(screen.getByText('Refresh'));
    });

    // Wait for refresh to fail
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    // Should have cleared localStorage
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should handle multiple simultaneous login attempts', async () => {
    vi.mocked(api.login).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockLoginResponse), 100);
        })
    );

    const MultiLoginComponent = () => {
      const { login, isLoading } = useAuth();
      return (
        <div>
          <div data-testid="loading-status">{isLoading ? 'loading' : 'not-loading'}</div>
          <button onClick={() => void login('test1@example.com', 'password1')}>
            Login 1
          </button>
          <button onClick={() => void login('test2@example.com', 'password2')}>
            Login 2
          </button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <MultiLoginComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    // Click both login buttons rapidly
    await act(async () => {
      await user.click(screen.getByText('Login 1'));
      await user.click(screen.getByText('Login 2'));
    });

    // Should show loading
    expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');

    // Wait for login to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
      },
      { timeout: 3000 }
    );

    // Both requests should have been made
    expect(api.login).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Integration Tests: useAuth Hook
// ============================================================================

describe('useAuth Hook', () => {
  it('should provide correct initial state when not authenticated', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('should update state correctly after login', async () => {
    vi.mocked(api.login).mockResolvedValue(mockLoginResponse);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });

  it('should clear state correctly after logout', async () => {
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    vi.mocked(api.logout).mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument();
  });

  it('should restore session from localStorage correctly', async () => {
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });

  it('should expose error state when login fails', async () => {
    const error = new api.ApiError(500, 'INTERNAL_ERROR', 'An internal error occurred. Please try again later.');
    vi.mocked(api.login).mockRejectedValue(error);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Should have error message
    expect(screen.getByTestId('error-message')).toHaveTextContent(/server error|error occurred/i);
  });

  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should allow multiple components to consume hook simultaneously', async () => {
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    const Consumer1 = () => {
      const { user } = useAuth();
      return <div data-testid="consumer-1">{user?.name}</div>;
    };

    const Consumer2 = () => {
      const { isAuthenticated } = useAuth();
      return (
        <div data-testid="consumer-2">
          {isAuthenticated ? 'authenticated' : 'not-authenticated'}
        </div>
      );
    };

    render(
      <AuthProvider>
        <Consumer1 />
        <Consumer2 />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-1')).toHaveTextContent('Test User');
    });

    expect(screen.getByTestId('consumer-2')).toHaveTextContent('authenticated');
  });

  it('should propagate state updates to all consumers', async () => {
    vi.mocked(api.login).mockResolvedValue(mockLoginResponse);

    const Consumer1 = () => {
      const { user } = useAuth();
      return <div data-testid="consumer-1">{user?.name ?? 'no-user'}</div>;
    };

    const Consumer2 = () => {
      const { login } = useAuth();
      return <button onClick={() => void login('test@example.com', 'password')}>Login</button>;
    };

    render(
      <AuthProvider>
        <Consumer1 />
        <Consumer2 />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-1')).toHaveTextContent('no-user');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('consumer-1')).toHaveTextContent('Test User');
    });
  });

  it('should expose loading state during operations', async () => {
    vi.mocked(api.login).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockLoginResponse), 100);
        })
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    // Should show loading immediately
    expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');

    await waitFor(
      () => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
      },
      { timeout: 3000 }
    );
  });

  it('should handle token refresh via hook', async () => {
    const refreshedToken = mockToken + '-refreshed';
    vi.mocked(api.refreshAuthToken).mockResolvedValue({
      token: refreshedToken,
      user: mockUser,
    });

    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    const TestRefreshComponent = () => {
      const { refreshToken, isAuthenticated } = useAuth();
      return (
        <div>
          <div data-testid="auth-status">
            {isAuthenticated ? 'authenticated' : 'not-authenticated'}
          </div>
          <button onClick={() => void refreshToken()}>Refresh</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestRefreshComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('Refresh'));
    });

    await waitFor(() => {
      expect(api.refreshAuthToken).toHaveBeenCalled();
    });

    // Should still be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
  });
});

// ============================================================================
// Component Tests: ProtectedRoute
// ============================================================================

describe('ProtectedRoute', () => {
  it('should render children when authenticated', async () => {
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  it('should redirect to /login when not authenticated', async () => {
    render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/login?return=')
      );
    });

    // Should not render protected content
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should show loading state during auth check', () => {
    render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    // Should show loading state (either "checking" or "redirecting")
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/checking authentication|redirecting/i)).toBeInTheDocument();
  });

  it('should preserve return URL in redirect', async () => {
    render(
      <AuthProvider>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        `/login?return=${encodeURIComponent(mockPathname)}`
      );
    });
  });

  it('should support custom redirect path', async () => {
    render(
      <AuthProvider>
        <ProtectedRoute redirectTo="/signin">
          <div>Protected</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/signin?return=')
      );
    });
  });

  it('should handle auth state changes (logout)', async () => {
    localStorage.setItem('auth_token', mockToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    vi.mocked(api.logout).mockResolvedValue();

    const TestLogoutComponent = () => {
      const { logout } = useAuth();
      return <button onClick={() => void logout()}>Logout</button>;
    };

    render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
          <TestLogoutComponent />
        </ProtectedRoute>
      </AuthProvider>
    );

    // Initially authenticated
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Logout
    await act(async () => {
      await user.click(screen.getByText('Logout'));
    });

    // Should redirect after logout
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });

  it('should not flash protected content before redirect', async () => {
    const { container } = render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    // Protected content should never appear in the document
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    // Should show loading/redirecting state
    expect(container.textContent).toMatch(/checking authentication|redirecting/i);
  });
});
