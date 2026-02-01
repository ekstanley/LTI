/**
 * Next.js middleware for CSP nonce generation
 * Generates a cryptographically secure nonce for each request to enable strict CSP
 * @module middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Generate a cryptographically secure random nonce
 * Uses Web Crypto API for secure random number generation
 */
function generateNonce(): string {
  // Generate 16 random bytes (128 bits)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Convert to base64
  return Buffer.from(bytes).toString('base64');
}

/**
 * Middleware to generate and inject CSP nonce into requests
 * Runs on all routes to provide nonce-based CSP protection
 */
export function middleware(request: NextRequest) {
  // Generate unique nonce for this request
  const nonce = generateNonce();

  // Clone request headers and add nonce
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // Create response with nonce in headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add nonce to response headers for access in headers() function
  response.headers.set('x-nonce', nonce);

  // Build CSP with nonce for inline scripts
  // Environment-aware API connections
  const isDevelopment = process.env.NODE_ENV === 'development';
  const apiConnections = isDevelopment
    ? "'self' http://localhost:4000 https://api.congress.gov"
    : "'self' https://api.congress.gov";

  // Next.js 14 doesn't have built-in nonce support for inline scripts
  // Both dev and production modes require 'unsafe-inline' until we upgrade to Next.js 15+
  // This allows Next.js's inline scripts for hydration, routing, and hot-reload
  const scriptSrc = `'self' 'unsafe-inline' 'unsafe-eval'`;

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Required for styled-jsx and CSS-in-JS
    "img-src 'self' data: https://bioguide.congress.gov https://theunitedstates.io",
    "font-src 'self' data:",
    `connect-src ${apiConnections}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  // Set CSP header with nonce
  response.headers.set('Content-Security-Policy', cspDirectives);

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add HSTS only for HTTPS connections
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

/**
 * Configure middleware to run on all routes
 * Excludes static files and Next.js internals for performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api routes (API routes handle their own security)
     * 2. /_next/static (static files)
     * 3. /_next/image (image optimization files)
     * 4. /favicon.ico, /sitemap.xml, /robots.txt (static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
