import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

describe('useAuth', () => {
  beforeEach(() => {
    // Suppress console.error for expected error tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should throw error with correct message when used outside AuthProvider', () => {
    // renderHook without wrapper (no AuthProvider)
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('should return context value when used within AuthProvider', () => {
    // Mock context value
    const mockContextValue: AuthContextValue = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    };

    // Create wrapper with mocked context
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual(mockContextValue);
    expect(result.current.user?.email).toBe('test@example.com');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should not throw when context is defined', () => {
    // Mock minimal valid context
    const mockContextValue: AuthContextValue = {
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    expect(() => {
      renderHook(() => useAuth(), { wrapper });
    }).not.toThrow();
  });
});
