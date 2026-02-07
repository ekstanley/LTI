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
import { isIP } from 'net';

/**
 * Validate an IP address string.
 *
 * @param raw - Candidate IP string
 * @returns The IP if valid (IPv4 or IPv6), otherwise 'unknown'
 *
 * Postcondition: Returns a valid IPv4/IPv6 string or 'unknown'.
 * Uses Node.js net.isIP() (returns 0 for invalid, 4 for IPv4, 6 for IPv6).
 */
function validateIP(raw: string): string {
  if (!raw || isIP(raw) === 0) {
    return 'unknown';
  }
  return raw;
}

/**
 * Extract client IP address from request
 *
 * @param req - Express request
 * @returns Client IP address (guaranteed to be a valid IPv4/IPv6 string or 'unknown')
 *
 * Postcondition: Returns a valid IP address string or 'unknown', never undefined/null.
 * All return paths are validated through net.isIP().
 */
export function getClientIP(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      const ip = forwardedFor.split(',')[0]?.trim();
      if (ip) return validateIP(ip);
    }
  }

  const raw = req.ip ?? req.socket.remoteAddress;
  if (raw) return validateIP(raw);

  return 'unknown';
}
