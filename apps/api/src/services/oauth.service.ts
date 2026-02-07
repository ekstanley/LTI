/**
 * OAuth Service
 *
 * Handles OAuth 2.0 Authorization Code flow for Google and GitHub providers.
 * Provides secure state management and user account linking/creation.
 */

import { randomBytes, createHash } from 'crypto';

import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';

import { mapPrismaRole, type ApiRole } from '../utils/roles.js';
import { jwtService, type TokenPair } from './jwt.service.js';

// ============================================================================
// Types
// ============================================================================

export interface OAuthState {
  provider: 'google' | 'github';
  nonce: string;
  createdAt: number;
  redirectUrl?: string | undefined;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name?: string;
  picture?: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface OAuthResult {
  success: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: ApiRole;
    isNewUser: boolean;
  };
  tokens: TokenPair;
}

export interface OAuthError {
  success: false;
  error:
    | 'provider_disabled'
    | 'invalid_state'
    | 'state_expired'
    | 'token_exchange_failed'
    | 'user_info_failed'
    | 'email_not_verified'
    | 'email_required'
    | 'account_inactive'
    | 'internal';
  message: string;
}

export type OAuthResponse = OAuthResult | OAuthError;

// ============================================================================
// State Management (in-memory for simplicity, use Redis in production cluster)
// ============================================================================

const stateStore = new Map<string, OAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographically secure state token
 */
function generateStateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a state token for storage (prevents timing attacks)
 */
function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

/**
 * Store OAuth state with expiration
 */
function storeState(state: string, data: OAuthState): void {
  const hash = hashState(state);
  stateStore.set(hash, data);

  // Auto-cleanup expired states
  setTimeout(() => {
    stateStore.delete(hash);
  }, STATE_TTL_MS);
}

/**
 * Validate and consume OAuth state (one-time use)
 */
function validateAndConsumeState(state: string): OAuthState | null {
  const hash = hashState(state);
  const data = stateStore.get(hash);

  if (!data) {
    return null;
  }

  // Delete immediately (one-time use)
  stateStore.delete(hash);

  // Check expiration
  if (Date.now() - data.createdAt > STATE_TTL_MS) {
    return null;
  }

  return data;
}

// ============================================================================
// Google OAuth
// ============================================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(redirectUrl?: string): string | null {
  if (!config.oauth.google.enabled) {
    return null;
  }

  const state = generateStateToken();
  storeState(state, {
    provider: 'google',
    nonce: randomBytes(16).toString('hex'),
    createdAt: Date.now(),
    redirectUrl,
  });

  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId!,
    redirect_uri: buildCallbackUrl('google'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Build the OAuth callback URL
 */
function buildCallbackUrl(provider: 'google' | 'github'): string {
  const baseUrl = config.isProd
    ? `https://${config.corsOrigins[0]?.replace(/^https?:\/\//, '') ?? 'localhost'}`
    : `http://localhost:${config.port}`;

  return `${baseUrl}/api/v1/auth/${provider}/callback`;
}

/**
 * Exchange authorization code for tokens (Google)
 */
async function exchangeGoogleCode(code: string): Promise<{ access_token: string } | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId!,
        client_secret: config.oauth.google.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: buildCallbackUrl('google'),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'Google token exchange failed');
      return null;
    }

    return (await response.json()) as { access_token: string };
  } catch (error) {
    logger.error({ error }, 'Google token exchange error');
    return null;
  }
}

/**
 * Fetch user info from Google
 */
async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Google userinfo fetch failed');
      return null;
    }

    return (await response.json()) as GoogleUserInfo;
  } catch (error) {
    logger.error({ error }, 'Google userinfo error');
    return null;
  }
}

/**
 * Handle Google OAuth callback
 */
export async function handleGoogleCallback(
  code: string,
  state: string,
  options?: { userAgent?: string; ipAddress?: string }
): Promise<OAuthResponse> {
  // Verify provider is enabled
  if (!config.oauth.google.enabled) {
    return { success: false, error: 'provider_disabled', message: 'Google OAuth is not configured' };
  }

  // Validate state
  const stateData = validateAndConsumeState(state);
  if (!stateData) {
    return { success: false, error: 'invalid_state', message: 'Invalid or expired OAuth state' };
  }

  if (stateData.provider !== 'google') {
    return { success: false, error: 'invalid_state', message: 'State provider mismatch' };
  }

  // Exchange code for tokens
  const tokens = await exchangeGoogleCode(code);
  if (!tokens) {
    return { success: false, error: 'token_exchange_failed', message: 'Failed to exchange authorization code' };
  }

  // Fetch user info
  const userInfo = await fetchGoogleUserInfo(tokens.access_token);
  if (!userInfo) {
    return { success: false, error: 'user_info_failed', message: 'Failed to fetch user information' };
  }

  // Require verified email
  if (!userInfo.verified_email) {
    return { success: false, error: 'email_not_verified', message: 'Google email must be verified' };
  }

  // Find or create user
  return findOrCreateOAuthUser(
    {
      provider: 'google',
      providerId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    },
    options
  );
}

// ============================================================================
// GitHub OAuth
// ============================================================================

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(redirectUrl?: string): string | null {
  if (!config.oauth.github.enabled) {
    return null;
  }

  const state = generateStateToken();
  storeState(state, {
    provider: 'github',
    nonce: randomBytes(16).toString('hex'),
    createdAt: Date.now(),
    redirectUrl,
  });

  const params = new URLSearchParams({
    client_id: config.oauth.github.clientId!,
    redirect_uri: buildCallbackUrl('github'),
    scope: 'read:user user:email',
    state,
  });

  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens (GitHub)
 */
async function exchangeGitHubCode(code: string): Promise<{ access_token: string } | null> {
  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.oauth.github.clientId!,
        client_secret: config.oauth.github.clientSecret!,
        code,
        redirect_uri: buildCallbackUrl('github'),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'GitHub token exchange failed');
      return null;
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (data.error) {
      logger.error({ error: data.error }, 'GitHub token exchange error');
      return null;
    }

    return data as { access_token: string };
  } catch (error) {
    logger.error({ error }, 'GitHub token exchange error');
    return null;
  }
}

/**
 * Fetch user info and primary email from GitHub
 */
async function fetchGitHubUserInfo(
  accessToken: string
): Promise<{ user: GitHubUserInfo; primaryEmail: string } | null> {
  try {
    // Fetch user profile
    const userResponse = await fetch(GITHUB_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'LTIP-API',
      },
    });

    if (!userResponse.ok) {
      logger.error({ status: userResponse.status }, 'GitHub userinfo fetch failed');
      return null;
    }

    const user = (await userResponse.json()) as GitHubUserInfo;

    // If public email is available and verified, use it
    if (user.email) {
      return { user, primaryEmail: user.email };
    }

    // Otherwise, fetch emails endpoint for primary verified email
    const emailsResponse = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'LTIP-API',
      },
    });

    if (!emailsResponse.ok) {
      logger.error({ status: emailsResponse.status }, 'GitHub emails fetch failed');
      return null;
    }

    const emails = (await emailsResponse.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primaryEmail = emails.find((e) => e.primary && e.verified);
    if (!primaryEmail) {
      logger.warn('No verified primary email found for GitHub user');
      return null;
    }

    return { user, primaryEmail: primaryEmail.email };
  } catch (error) {
    logger.error({ error }, 'GitHub userinfo error');
    return null;
  }
}

/**
 * Handle GitHub OAuth callback
 */
export async function handleGitHubCallback(
  code: string,
  state: string,
  options?: { userAgent?: string; ipAddress?: string }
): Promise<OAuthResponse> {
  // Verify provider is enabled
  if (!config.oauth.github.enabled) {
    return { success: false, error: 'provider_disabled', message: 'GitHub OAuth is not configured' };
  }

  // Validate state
  const stateData = validateAndConsumeState(state);
  if (!stateData) {
    return { success: false, error: 'invalid_state', message: 'Invalid or expired OAuth state' };
  }

  if (stateData.provider !== 'github') {
    return { success: false, error: 'invalid_state', message: 'State provider mismatch' };
  }

  // Exchange code for tokens
  const tokens = await exchangeGitHubCode(code);
  if (!tokens) {
    return { success: false, error: 'token_exchange_failed', message: 'Failed to exchange authorization code' };
  }

  // Fetch user info
  const userInfo = await fetchGitHubUserInfo(tokens.access_token);
  if (!userInfo) {
    return { success: false, error: 'user_info_failed', message: 'Failed to fetch user information' };
  }

  // Find or create user
  return findOrCreateOAuthUser(
    {
      provider: 'github',
      providerId: userInfo.user.id.toString(),
      email: userInfo.primaryEmail,
      name: userInfo.user.name ?? userInfo.user.login,
      avatarUrl: userInfo.user.avatar_url,
    },
    options
  );
}

// ============================================================================
// User Management
// ============================================================================

interface OAuthUserData {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string | null | undefined;
}

/**
 * Find existing user or create new one from OAuth data
 *
 * Account linking strategy:
 * 1. If user exists with this provider ID -> login
 * 2. If user exists with same email -> link provider
 * 3. Otherwise -> create new user
 */
async function findOrCreateOAuthUser(
  data: OAuthUserData,
  options?: { userAgent?: string; ipAddress?: string }
): Promise<OAuthResponse> {
  try {
    const providerIdField = data.provider === 'google' ? 'googleId' : 'githubId';

    // 1. Check if user exists with this provider ID
    let user = await prisma.user.findFirst({
      where: { [providerIdField]: data.providerId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        role: true,
      },
    });

    let isNewUser = false;

    if (user) {
      // User exists with this OAuth provider
      if (!user.isActive) {
        return { success: false, error: 'account_inactive', message: 'Account is inactive' };
      }
    } else {
      // 2. Check if user exists with same email
      user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          isActive: true,
          role: true,
        },
      });

      if (user) {
        // Link OAuth provider to existing account
        if (!user.isActive) {
          return { success: false, error: 'account_inactive', message: 'Account is inactive' };
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { [providerIdField]: data.providerId },
        });

        logger.info({ userId: user.id, provider: data.provider }, 'Linked OAuth provider to existing account');
      } else {
        // 3. Create new user
        user = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            name: data.name,
            avatarUrl: data.avatarUrl ?? null,
            [providerIdField]: data.providerId,
            emailVerified: true, // OAuth emails are pre-verified
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isActive: true,
            role: true,
          },
        });

        isNewUser = true;
        logger.info({ userId: user.id, provider: data.provider }, 'Created new user via OAuth');
      }
    }

    // Generate tokens
    const tokens = await jwtService.generateTokenPair(user.id, user.email, options);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: mapPrismaRole(user.role),
        isNewUser,
      },
      tokens,
    };
  } catch (error) {
    logger.error({ error, provider: data.provider }, 'OAuth user creation failed');
    return { success: false, error: 'internal', message: 'Failed to process OAuth login' };
  }
}

/**
 * Check if OAuth providers are enabled
 */
export function getEnabledProviders(): { google: boolean; github: boolean } {
  return {
    google: config.oauth.google.enabled,
    github: config.oauth.github.enabled,
  };
}

export const oauthService = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGitHubAuthUrl,
  handleGitHubCallback,
  getEnabledProviders,
};

export type OAuthService = typeof oauthService;
