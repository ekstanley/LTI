import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable config object for test-level toggling of provider enabled state.
// vi.hoisted() ensures this runs in the hoisted scope alongside vi.mock(),
// avoiding "cannot access before initialization" errors from mock hoisting.
const mockConfig = vi.hoisted(() => ({
  oauth: {
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      callbackUrl: '/api/v1/auth/google/callback',
      enabled: true,
    },
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      callbackUrl: '/api/v1/auth/github/callback',
      enabled: true,
    },
  },
  isProd: false,
  port: 4000,
  corsOrigins: ['http://localhost:3000'],
}));

// Mock config BEFORE importing oauth service
vi.mock('../../config.js', () => ({
  config: mockConfig,
}));

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../services/jwt.service.js', () => ({
  jwtService: {
    generateTokenPair: vi.fn(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGitHubAuthUrl,
  handleGitHubCallback,
  getEnabledProviders,
} from '../../services/oauth.service.js';
import { prisma } from '../../db/client.js';
import { jwtService } from '../../services/jwt.service.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockTokenPair = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  accessTokenExpiresAt: new Date('2026-01-01T01:00:00Z'),
  refreshTokenExpiresAt: new Date('2026-01-08T00:00:00Z'),
};

describe('oauth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset config to default enabled state
    mockConfig.oauth.google.enabled = true;
    mockConfig.oauth.github.enabled = true;
  });

  describe('getEnabledProviders', () => {
    it('should return both providers enabled when config says so', () => {
      const result = getEnabledProviders();

      expect(result).toEqual({
        google: true,
        github: true,
      });
    });

    it('should return providers disabled when config says disabled', () => {
      mockConfig.oauth.google.enabled = false;
      mockConfig.oauth.github.enabled = false;

      const result = getEnabledProviders();

      expect(result).toEqual({
        google: false,
        github: false,
      });
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('should return null when Google OAuth is disabled', () => {
      mockConfig.oauth.google.enabled = false;

      const result = getGoogleAuthUrl();

      expect(result).toBeNull();
    });

    it('should return URL string containing required OAuth params', () => {
      const result = getGoogleAuthUrl();

      expect(result).toBeTruthy();
      const url = new URL(result!);

      expect(url.hostname).toBe('accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('google-client-id');
      expect(url.searchParams.get('redirect_uri')).toContain('/api/v1/auth/google/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
    });

    it('should include state parameter in URL', () => {
      const result = getGoogleAuthUrl();

      const url = new URL(result!);
      const state = url.searchParams.get('state');

      expect(state).toBeTruthy();
      expect(state!.length).toBeGreaterThan(0);
    });

    it('should use custom redirect URL when provided', () => {
      const customRedirect = 'http://localhost:3000/auth/callback';
      const authUrl = getGoogleAuthUrl(customRedirect);

      // State should still be stored with redirectUrl
      // This is tested indirectly through the callback flow
      expect(authUrl).toBeTruthy();
      const url = new URL(authUrl!);
      expect(url.searchParams.get('state')).toBeTruthy();
    });
  });

  describe('getGitHubAuthUrl', () => {
    it('should return null when GitHub OAuth is disabled', () => {
      mockConfig.oauth.github.enabled = false;

      const result = getGitHubAuthUrl();

      expect(result).toBeNull();
    });

    it('should return URL with correct params', () => {
      const result = getGitHubAuthUrl();

      expect(result).toBeTruthy();
      const url = new URL(result!);

      expect(url.hostname).toBe('github.com');
      expect(url.pathname).toBe('/login/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('github-client-id');
      expect(url.searchParams.get('redirect_uri')).toContain('/api/v1/auth/github/callback');
      expect(url.searchParams.get('scope')).toBe('read:user user:email');
    });

    it('should include state parameter', () => {
      const result = getGitHubAuthUrl();

      const url = new URL(result!);
      const state = url.searchParams.get('state');

      expect(state).toBeTruthy();
      expect(state!.length).toBeGreaterThan(0);
    });
  });

  describe('State management', () => {
    it('should be single-use (consumed on first validation)', async () => {
      // Generate state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      } as Response);

      // Mock successful user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google-123',
          email: 'user@gmail.com',
          verified_email: true,
          name: 'Test User',
        }),
      } as Response);

      // Mock database calls
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-123',
        email: 'user@gmail.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      // First use should succeed
      const result1 = await handleGoogleCallback('test-code', state);
      expect(result1.success).toBe(true);

      // Second use should fail with invalid_state
      const result2 = await handleGoogleCallback('test-code', state);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('invalid_state');
      }
    });

    it('should expire after 10 minutes', async () => {
      vi.useFakeTimers();

      // Generate state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Advance time beyond expiry
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      // Should fail with invalid_state
      const result = await handleGoogleCallback('test-code', state);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }

      vi.useRealTimers();
    });

    it('should return invalid_state for unknown state token', async () => {
      const result = await handleGoogleCallback('test-code', 'invalid-state-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });

    it('should return error when state provider mismatches', async () => {
      // Generate Google state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Try to use it with GitHub callback
      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });

    it('should allow state from correct provider', async () => {
      // Generate GitHub state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful GitHub flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'github-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 123,
            login: 'githubuser',
            email: 'user@github.com',
            name: 'GitHub User',
            avatar_url: 'https://avatar.url',
          }),
        } as Response);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-123',
        email: 'user@github.com',
        name: 'GitHub User',
        avatarUrl: 'https://avatar.url',
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null,
        githubId: '123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(true);
    });
  });

  describe('handleGoogleCallback', () => {
    it('should return provider_disabled when Google not enabled', async () => {
      mockConfig.oauth.google.enabled = false;

      const result = await handleGoogleCallback('test-code', 'test-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('provider_disabled');
      }
    });

    it('should return invalid_state for unknown state token', async () => {
      const result = await handleGoogleCallback('test-code', 'unknown-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });

    it('should return invalid_state when state provider is not google', async () => {
      // Generate GitHub state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Try with Google callback
      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });

    it('should return token_exchange_failed when Google token endpoint fails', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock failed token exchange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      } as Response);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('token_exchange_failed');
      }
    });

    it('should return user_info_failed when Google userinfo endpoint fails', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      } as Response);

      // Mock failed userinfo
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('user_info_failed');
      }
    });

    it('should return email_not_verified when Google email is not verified', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      } as Response);

      // Mock userinfo with unverified email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google-123',
          email: 'user@gmail.com',
          verified_email: false,
          name: 'Test User',
        }),
      } as Response);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('email_not_verified');
      }
    });

    it('should return success with user data for new user creation', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful Google flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-123',
            email: 'newuser@gmail.com',
            verified_email: true,
            name: 'New User',
            given_name: 'New',
            picture: 'https://photo.url',
          }),
        } as Response);

      // Mock database: no existing user
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const createdUser = {
        id: 'new-user-id',
        email: 'newuser@gmail.com',
        name: 'New User',
        avatarUrl: 'https://photo.url',
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(createdUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toEqual({
          id: 'new-user-id',
          email: 'newuser@gmail.com',
          name: 'New User',
          avatarUrl: 'https://photo.url',
          role: 'user',
          isNewUser: true,
        });
        expect(result.tokens).toEqual(mockTokenPair);
      }

      // Verify user was created with emailVerified: true
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@gmail.com',
            emailVerified: true,
            googleId: 'google-123',
          }),
        })
      );
    });

    it('should return success with existing user for returning user', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful Google flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-123',
            email: 'existing@gmail.com',
            verified_email: true,
            name: 'Existing User',
          }),
        } as Response);

      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@gmail.com',
        name: 'Existing User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // Mock finding existing user
      vi.mocked(prisma.user.findFirst).mockResolvedValue(existingUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(existingUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.id).toBe('existing-user-id');
        expect(result.user.isNewUser).toBe(false);
      }

      // Verify lastLoginAt was updated
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });

    it('should link provider to existing email account', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful Google flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-new-id',
            email: 'existing@example.com',
            verified_email: true,
            name: 'User',
          }),
        } as Response);

      const existingUserByEmail = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        name: 'User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null, // No Google ID yet
        githubId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // findFirst returns null (no user with this googleId)
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      // findUnique returns existing user by email
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUserByEmail as any);

      const updatedUser = {
        ...existingUserByEmail,
        googleId: 'google-new-id',
      };

      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(true);

      // Verify googleId was linked (first call)
      expect(prisma.user.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: { googleId: 'google-new-id' },
        })
      );

      // Verify lastLoginAt was updated (second call)
      expect(prisma.user.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return account_inactive for inactive user', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful Google flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-123',
            email: 'inactive@gmail.com',
            verified_email: true,
            name: 'Inactive User',
          }),
        } as Response);

      const inactiveUser = {
        id: 'inactive-user-id',
        email: 'inactive@gmail.com',
        name: 'Inactive User',
        avatarUrl: null,
        emailVerified: true,
        isActive: false, // Inactive
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(inactiveUser as any);

      const result = await handleGoogleCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_inactive');
      }
    });
  });

  describe('handleGitHubCallback', () => {
    it('should return provider_disabled when GitHub not enabled', async () => {
      mockConfig.oauth.github.enabled = false;

      const result = await handleGitHubCallback('test-code', 'test-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('provider_disabled');
      }
    });

    it('should return invalid_state for unknown state', async () => {
      const result = await handleGitHubCallback('test-code', 'unknown-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });

    it('should return token_exchange_failed when GitHub token endpoint fails', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock failed token exchange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      } as Response);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('token_exchange_failed');
      }
    });

    it('should return token_exchange_failed when GitHub returns error field in response', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock token exchange with error
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'bad_verification_code' }),
      } as Response);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('token_exchange_failed');
      }
    });

    it('should return user_info_failed when GitHub user endpoint fails', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-token' }),
      } as Response);

      // Mock failed user info
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('user_info_failed');
      }
    });

    it('should fetch primary email from /user/emails when user.email is null', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-token' }),
      } as Response);

      // Mock user info with null email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          login: 'githubuser',
          email: null,
          name: 'GitHub User',
          avatar_url: 'https://avatar.url',
        }),
      } as Response);

      // Mock emails endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { email: 'primary@github.com', primary: true, verified: true },
          { email: 'secondary@github.com', primary: false, verified: true },
        ],
      } as Response);

      // Mock database
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-123',
        email: 'primary@github.com',
        name: 'GitHub User',
        avatarUrl: 'https://avatar.url',
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null,
        githubId: '123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe('primary@github.com');
      }

      // Verify emails endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user/emails',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer github-token',
          }),
        })
      );
    });

    it('should return user_info_failed when no verified primary email found', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-token' }),
      } as Response);

      // Mock user info with null email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          login: 'githubuser',
          email: null,
          name: 'GitHub User',
        }),
      } as Response);

      // Mock emails endpoint with no primary verified email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ email: 'unverified@github.com', primary: true, verified: false }],
      } as Response);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('user_info_failed');
      }
    });

    it('should return success for new user creation', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful GitHub flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'github-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 456,
            login: 'newuser',
            email: 'newgithub@example.com',
            name: 'New GitHub User',
            avatar_url: 'https://avatar.url',
          }),
        } as Response);

      // Mock database: no existing user
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const createdUser = {
        id: 'new-user-id',
        email: 'newgithub@example.com',
        name: 'New GitHub User',
        avatarUrl: 'https://avatar.url',
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null,
        githubId: '456',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(createdUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toEqual({
          id: 'new-user-id',
          email: 'newgithub@example.com',
          name: 'New GitHub User',
          avatarUrl: 'https://avatar.url',
          role: 'user',
          isNewUser: true,
        });
      }

      // Verify user was created with githubId
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newgithub@example.com',
            emailVerified: true,
            githubId: '456',
          }),
        })
      );
    });

    it('should return success for existing user', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful GitHub flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'github-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 789,
            login: 'existinguser',
            email: 'existing@github.com',
            name: 'Existing GitHub User',
          }),
        } as Response);

      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@github.com',
        name: 'Existing GitHub User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null,
        githubId: '789',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(existingUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(existingUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.id).toBe('existing-user-id');
        expect(result.user.isNewUser).toBe(false);
      }

      // Verify lastLoginAt was updated
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });

    it('should link provider to existing email account', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock successful GitHub flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'github-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 999,
            login: 'user',
            email: 'existing@example.com',
            name: 'User',
          }),
        } as Response);

      const existingUserByEmail = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        name: 'User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: null,
        githubId: null, // No GitHub ID yet
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // findFirst returns null (no user with this githubId)
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      // findUnique returns existing user by email
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUserByEmail as any);

      const updatedUser = {
        ...existingUserByEmail,
        githubId: '999',
      };

      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(true);

      // Verify githubId was linked (first call)
      expect(prisma.user.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: { githubId: '999' },
        })
      );

      // Verify lastLoginAt was updated (second call)
      expect(prisma.user.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'existing-user-id' },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('findOrCreateOAuthUser edge cases', () => {
    it('should normalize email to lowercase', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      // Mock Google returning uppercase email
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-123',
            email: 'UPPERCASE@GMAIL.COM',
            verified_email: true,
            name: 'Test User',
          }),
        } as Response);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-123',
        email: 'uppercase@gmail.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      await handleGoogleCallback('test-code', state);

      // Verify email was normalized
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'uppercase@gmail.com',
          }),
        })
      );
    });

    it('should generate tokens with correct userId and email', async () => {
      // Generate valid state
      const authUrl = getGoogleAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'google-123',
            email: 'user@example.com',
            verified_email: true,
            name: 'Test User',
          }),
        } as Response);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-id-123',
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: true,
        isActive: true,
        role: 'USER' as const,
        googleId: 'google-123',
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(jwtService.generateTokenPair).mockResolvedValue(mockTokenPair as any);

      await handleGoogleCallback('test-code', state);

      // Verify tokens generated with correct user info
      expect(jwtService.generateTokenPair).toHaveBeenCalledWith(
        'user-id-123',
        'user@example.com',
        undefined
      );
    });

    it('should return account_inactive for inactive found-by-email user', async () => {
      // Generate valid state
      const authUrl = getGitHubAuthUrl();
      const url = new URL(authUrl!);
      const state = url.searchParams.get('state')!;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'github-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 111,
            login: 'user',
            email: 'inactive@example.com',
            name: 'User',
          }),
        } as Response);

      const inactiveUserByEmail = {
        id: 'inactive-user-id',
        email: 'inactive@example.com',
        name: 'User',
        avatarUrl: null,
        emailVerified: true,
        isActive: false, // Inactive
        role: 'USER' as const,
        googleId: null,
        githubId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // findFirst returns null
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      // findUnique returns inactive user
      vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUserByEmail as any);

      const result = await handleGitHubCallback('test-code', state);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('account_inactive');
      }
    });
  });
});
