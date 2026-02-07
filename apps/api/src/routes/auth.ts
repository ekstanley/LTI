/**
 * Authentication Routes
 *
 * Handles user registration, login, token refresh, logout, and profile access.
 * Implements secure cookie-based refresh token storage.
 */

import { Router, type Router as RouterType, type Request } from 'express';

import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { accountLockout, trackLoginAttempt } from '../middleware/accountLockout.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/authRateLimiter.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { validateRedirectUrl } from '../middleware/validateRedirectUrl.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  revokeSessionSchema,
} from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { oauthService } from '../services/oauth.service.js';

export const authRouter: RouterType = Router();

/**
 * Get a cookie value from the request with type safety.
 * Express types req.cookies as `any` (from cookie-parser). This accessor
 * narrows the type to satisfy @typescript-eslint/no-unsafe-* rules.
 */
function getCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[name];
}

// Cookie configuration for refresh tokens
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Extract client metadata from request
 */
function getClientMetadata(req: Request): { userAgent?: string; ipAddress?: string } {
  const result: { userAgent?: string; ipAddress?: string } = {};

  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    result.userAgent = userAgent;
  }

  const ipAddress = req.ip ?? req.socket.remoteAddress;
  if (ipAddress) {
    result.ipAddress = ipAddress;
  }

  return result;
}

// =============================================================================
// Registration
// =============================================================================

/**
 * POST /api/v1/auth/register
 *
 * Create a new user account
 *
 * @body {email, password, name?}
 * @returns {user, accessToken, expiresAt}
 */
authRouter.post('/register', authRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);

    // Build input, only including name if provided
    const input: { email: string; password: string; name?: string } = {
      email: parsed.email,
      password: parsed.password,
    };
    if (parsed.name !== undefined) {
      input.name = parsed.name;
    }

    const result = await authService.register(input);

    if (!result.success) {
      const errorMessages: Record<string, { status: number; message: string }> = {
        email_exists: { status: 409, message: 'Email already registered' },
        password_weak: { status: 400, message: 'Password does not meet requirements' },
        password_common: { status: 400, message: 'Password is too common' },
        internal: { status: 500, message: 'Registration failed' },
      };

      const errorInfo = errorMessages[result.error] ?? errorMessages['internal']!;

      res.status(errorInfo.status).json({
        error: result.error,
        message: errorInfo.message,
        details: result.details,
      });
      return;
    }

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

    // Return user and access token
    res.status(201).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Login
// =============================================================================

/**
 * POST /api/v1/auth/login
 *
 * Authenticate user and return tokens
 *
 * @body {email, password}
 * @returns {user, accessToken, expiresAt}
 */
authRouter.post('/login', authRateLimiter, accountLockout, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const metadata = getClientMetadata(req);

    const result = await authService.login({
      email,
      password,
      ...metadata,
    });

    // Track login attempt (success or failure)
    const ip = metadata.ipAddress ?? 'unknown';
    await trackLoginAttempt(email, ip, result.success);

    // Audit log: login attempt
    if (result.success) {
      logger.info(
        {
          event: 'auth.login.success',
          email,
          ip,
          userId: result.user.id,
          role: result.user.role,
          timestamp: new Date().toISOString(),
        },
        'AUDIT: Successful login'
      );
    } else {
      logger.warn(
        {
          event: 'auth.login.failure',
          email,
          ip,
          reason: result.error,
          timestamp: new Date().toISOString(),
        },
        'AUDIT: Failed login attempt'
      );
    }

    if (!result.success) {
      const errorMessages: Record<string, { status: number; message: string }> = {
        invalid_credentials: { status: 401, message: 'Invalid email or password' },
        account_inactive: { status: 403, message: 'Account is inactive' },
        account_locked: {
          status: 429,
          message: 'Too many requests. Please try again later.',
        },
        internal: { status: 500, message: 'Login failed' },
      };

      const errorInfo = errorMessages[result.error] ?? errorMessages['internal']!;

      res.status(errorInfo.status).json({
        error: result.error,
        message: errorInfo.message,
      });
      return;
    }

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

    // Return user and access token
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Token Refresh
// =============================================================================

/**
 * POST /api/v1/auth/refresh
 *
 * Get new access token using refresh token from cookie
 *
 * @cookie refreshToken
 * @returns {accessToken, expiresAt}
 */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);

    if (!refreshToken) {
      res.status(401).json({
        error: 'no_refresh_token',
        message: 'No refresh token provided',
      });
      return;
    }

    const metadata = getClientMetadata(req);
    const result = await authService.refresh(refreshToken, metadata);

    if (!result.success) {
      // Clear invalid cookie
      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });

      const errorMessages: Record<string, { status: number; message: string }> = {
        invalid_token: { status: 401, message: 'Invalid refresh token' },
        expired_token: { status: 401, message: 'Refresh token expired' },
        revoked_token: { status: 401, message: 'Refresh token has been revoked' },
        internal: { status: 500, message: 'Token refresh failed' },
      };

      const errorInfo = errorMessages[result.error] ?? errorMessages['internal']!;

      res.status(errorInfo.status).json({
        error: result.error,
        message: errorInfo.message,
      });
      return;
    }

    logger.info(
      {
        event: 'auth.token.refresh',
        ip: getClientMetadata(req).ipAddress,
        timestamp: new Date().toISOString(),
      },
      'AUDIT: Token refreshed'
    );

    // Set new refresh token in cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

    // Return new access token
    res.json({
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Logout
// =============================================================================

/**
 * POST /api/v1/auth/logout
 *
 * Revoke refresh token and clear cookie
 *
 * @cookie refreshToken
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Always clear cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout-all
 *
 * Revoke all sessions for the authenticated user
 *
 * @auth Required
 */
authRouter.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const count = await authService.logoutAll(req.user.id);

    // Clear current cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });

    res.json({ success: true, sessionsRevoked: count });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Profile
// =============================================================================

/**
 * GET /api/v1/auth/me
 *
 * Get current user's profile
 *
 * @auth Required
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const profile = await authService.getProfile(req.user.id);

    if (!profile) {
      throw ApiError.notFound('User');
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/auth/me
 *
 * Update current user's profile
 *
 * @auth Required
 * @body {name?, avatarUrl?}
 */
authRouter.patch('/me', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const parsed = updateProfileSchema.parse(req.body);

    // Build update data, only including properties that are actually provided
    const updateData: { name?: string; avatarUrl?: string | null } = {};
    if (parsed.name !== undefined) {
      updateData.name = parsed.name;
    }
    if (parsed.avatarUrl !== undefined) {
      updateData.avatarUrl = parsed.avatarUrl;
    }

    const profile = await authService.updateProfile(req.user.id, updateData);

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Password Management
// =============================================================================

/**
 * POST /api/v1/auth/change-password
 *
 * Change current user's password
 *
 * @auth Required
 * @body {currentPassword, newPassword}
 */
authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

      if (!result.success) {
        res.status(400).json({
          error: 'password_change_failed',
          message: result.error,
        });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Sessions
// =============================================================================

/**
 * GET /api/v1/auth/sessions
 *
 * Get list of active sessions for current user
 *
 * @auth Required
 */
authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const sessions = await authService.getSessions(req.user.id);

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 *
 * Revoke a specific session
 *
 * @auth Required
 */
authRouter.delete(
  '/sessions/:sessionId',
  requireAuth,
  validate(revokeSessionSchema, 'params'),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { sessionId } = revokeSessionSchema.parse(req.params);
      const success = await authService.revokeSession(req.user.id, sessionId);

      if (!success) {
        throw ApiError.notFound('Session');
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// OAuth Providers
// =============================================================================

/**
 * GET /api/v1/auth/providers
 *
 * Get list of enabled OAuth providers
 *
 * @returns {google: boolean, github: boolean}
 */
authRouter.get('/providers', (_req, res) => {
  res.json(oauthService.getEnabledProviders());
});

/**
 * GET /api/v1/auth/google
 *
 * Initiate Google OAuth flow
 *
 * @query {redirectUrl?} - URL to redirect after successful login
 * @returns Redirect to Google OAuth consent screen
 */
authRouter.get('/google', (req, res) => {
  const redirectUrl = req.query.redirectUrl as string | undefined;

  // SECURITY: Validate redirect URL against allowlist to prevent open redirect attacks
  if (!validateRedirectUrl(redirectUrl)) {
    res.status(400).json({
      error: 'invalid_redirect',
      message: 'Invalid redirect URL. Must be a trusted domain.',
    });
    return;
  }

  const authUrl = oauthService.getGoogleAuthUrl(redirectUrl);

  if (!authUrl) {
    res.status(503).json({
      error: 'provider_disabled',
      message: 'Google OAuth is not configured',
    });
    return;
  }

  res.redirect(authUrl);
});

/**
 * GET /api/v1/auth/google/callback
 *
 * Handle Google OAuth callback
 *
 * @query {code} - Authorization code from Google
 * @query {state} - State token for CSRF protection
 * @returns {user, accessToken, expiresAt} or redirect with tokens
 */
authRouter.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors from provider
    if (oauthError) {
      const errorMessage = typeof oauthError === 'string' ? oauthError : 'Unknown OAuth error';
      res.status(400).json({
        error: 'oauth_error',
        message: `OAuth error: ${errorMessage}`,
      });
      return;
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing code or state parameter',
      });
      return;
    }

    const metadata = getClientMetadata(req);
    const result = await oauthService.handleGoogleCallback(code, state, metadata);

    if (!result.success) {
      const statusCodes: Record<string, number> = {
        provider_disabled: 503,
        invalid_state: 400,
        state_expired: 400,
        token_exchange_failed: 502,
        user_info_failed: 502,
        email_not_verified: 403,
        account_inactive: 403,
        internal: 500,
      };

      res.status(statusCodes[result.error] ?? 500).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

    // Return user and access token
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/github
 *
 * Initiate GitHub OAuth flow
 *
 * @query {redirectUrl?} - URL to redirect after successful login
 * @returns Redirect to GitHub OAuth consent screen
 */
authRouter.get('/github', (req, res) => {
  const redirectUrl = req.query.redirectUrl as string | undefined;

  // SECURITY: Validate redirect URL against allowlist to prevent open redirect attacks
  if (!validateRedirectUrl(redirectUrl)) {
    res.status(400).json({
      error: 'invalid_redirect',
      message: 'Invalid redirect URL. Must be a trusted domain.',
    });
    return;
  }

  const authUrl = oauthService.getGitHubAuthUrl(redirectUrl);

  if (!authUrl) {
    res.status(503).json({
      error: 'provider_disabled',
      message: 'GitHub OAuth is not configured',
    });
    return;
  }

  res.redirect(authUrl);
});

/**
 * GET /api/v1/auth/github/callback
 *
 * Handle GitHub OAuth callback
 *
 * @query {code} - Authorization code from GitHub
 * @query {state} - State token for CSRF protection
 * @returns {user, accessToken, expiresAt} or redirect with tokens
 */
authRouter.get('/github/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors from provider
    if (oauthError) {
      const errorMessage = typeof oauthError === 'string' ? oauthError : 'Unknown OAuth error';
      res.status(400).json({
        error: 'oauth_error',
        message: `OAuth error: ${errorMessage}`,
      });
      return;
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing code or state parameter',
      });
      return;
    }

    const metadata = getClientMetadata(req);
    const result = await oauthService.handleGitHubCallback(code, state, metadata);

    if (!result.success) {
      const statusCodes: Record<string, number> = {
        provider_disabled: 503,
        invalid_state: 400,
        state_expired: 400,
        token_exchange_failed: 502,
        user_info_failed: 502,
        email_required: 403,
        account_inactive: 403,
        internal: 500,
      };

      res.status(statusCodes[result.error] ?? 500).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

    // Return user and access token
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
