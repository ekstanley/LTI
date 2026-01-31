/**
 * OAuth Redirect URL Validation Middleware
 *
 * SECURITY: Prevents open redirect attacks (CWE-601) in OAuth flows.
 * Only allows redirects to pre-approved origins to prevent phishing attacks.
 *
 * Attack Vector Example:
 * https://api.ltip.gov/auth/google?redirectUrl=https://evil.com/phishing
 *
 * Without validation, users could be redirected to malicious sites after
 * successful OAuth authentication, enabling credential theft.
 */

import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Validate redirect URL against allowlist
 *
 * @param url - The redirect URL to validate (from query string)
 * @returns true if URL is safe to redirect to, false otherwise
 *
 * Validation Rules:
 * 1. No URL provided (undefined) → ALLOW (will use default redirect)
 * 2. Development mode + localhost → ALLOW (any port for local testing)
 * 3. Production mode → ALLOW only if origin matches CORS allowlist
 * 4. Invalid URL format → REJECT
 */
export function validateRedirectUrl(url: string | undefined): boolean {
  // No redirect URL is valid (will use application default)
  if (!url) {
    return true;
  }

  try {
    const parsed = new URL(url);

    // Development: Allow localhost on any port for testing
    if (config.nodeEnv === 'development' && parsed.hostname === 'localhost') {
      logger.debug({ url, hostname: parsed.hostname }, 'Allowing localhost redirect in development');
      return true;
    }

    // Production: Check against CORS origins allowlist
    // We reuse CORS origins as they represent trusted frontend domains
    const allowedOrigins = config.corsOrigins;
    const isAllowed = allowedOrigins.includes(parsed.origin);

    if (!isAllowed) {
      logger.warn(
        {
          url,
          origin: parsed.origin,
          allowedOrigins,
        },
        'SECURITY: Rejected untrusted redirect URL (potential open redirect attack)'
      );
    } else {
      logger.debug({ url, origin: parsed.origin }, 'Validated redirect URL against allowlist');
    }

    return isAllowed;
  } catch (error) {
    // Invalid URL format (malformed, relative path, etc.)
    logger.warn({ url, error }, 'SECURITY: Invalid redirect URL format');
    return false;
  }
}
