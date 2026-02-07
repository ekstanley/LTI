/**
 * IP Address Extraction Utility
 *
 * SECURITY: Provides proxy-aware IP extraction with secure defaults (CWE-441).
 * Only trusts x-forwarded-for when TRUST_PROXY=true to prevent IP spoofing.
 *
 * Set TRUST_PROXY=true ONLY if the application is behind a trusted reverse proxy
 * (e.g., nginx, Cloudflare, AWS ALB). Otherwise, attackers can bypass IP-based
 * security controls by spoofing the x-forwarded-for header.
 */

import type { Request } from 'express';

/**
 * Extract client IP address from request
 *
 * @param req - Express request
 * @returns Client IP address (guaranteed to be a non-empty string)
 *
 * Postcondition: Returns a string, never undefined/null.
 * Default: 'unknown' when no IP source is available.
 */
export function getClientIP(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      const ip = forwardedFor.split(',')[0]?.trim();
      if (ip) return ip;
    }
  }

  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
