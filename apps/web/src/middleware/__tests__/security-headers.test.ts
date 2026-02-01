import { NextRequest, NextResponse } from 'next/server';
import { describe, it, expect } from 'vitest';

import { middleware } from '@/middleware';

describe('Security Headers', () => {
  it('should add X-Frame-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('should add X-Content-Type-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should add Referrer-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should add Strict-Transport-Security header for HTTPS', async () => {
    const request = new NextRequest(new URL('https://localhost:3000/'));
    const response = await middleware(request);

    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('should not add HSTS header for HTTP', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });
});
