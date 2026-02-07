import type { Request } from 'express';
import type { Socket } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getClientIP } from '../../utils/ip.js';

/**
 * Build a minimal Express Request mock for IP extraction testing.
 */
function mockRequest(overrides: {
  ip?: string;
  remoteAddress?: string;
  forwardedFor?: string | string[];
} = {}): Request {
  const socket = { remoteAddress: overrides.remoteAddress } as Socket;
  const headers: Record<string, string | string[] | undefined> = {};

  if (overrides.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = overrides.forwardedFor;
  }

  return {
    ip: overrides.ip,
    socket,
    headers,
  } as unknown as Request;
}

describe('getClientIP', () => {
  const originalEnv = process.env.TRUST_PROXY;

  beforeEach(() => {
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TRUST_PROXY = originalEnv;
    } else {
      delete process.env.TRUST_PROXY;
    }
  });

  // --- Secure defaults (TRUST_PROXY unset or false) ---

  it('returns req.ip when TRUST_PROXY is unset', () => {
    const req = mockRequest({ ip: '192.168.1.1', forwardedFor: '10.0.0.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('returns req.ip when TRUST_PROXY is false', () => {
    process.env.TRUST_PROXY = 'false';
    const req = mockRequest({ ip: '192.168.1.1', forwardedFor: '10.0.0.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('ignores x-forwarded-for when TRUST_PROXY is not exactly "true"', () => {
    process.env.TRUST_PROXY = 'TRUE'; // Case-sensitive check
    const req = mockRequest({ ip: '192.168.1.1', forwardedFor: '10.0.0.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  // --- Proxy-trusted mode (TRUST_PROXY=true) ---

  it('returns first x-forwarded-for IP when TRUST_PROXY is true', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockRequest({ ip: '127.0.0.1', forwardedFor: '203.0.113.50' });
    expect(getClientIP(req)).toBe('203.0.113.50');
  });

  it('returns first IP from comma-separated x-forwarded-for', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockRequest({
      ip: '127.0.0.1',
      forwardedFor: '203.0.113.50, 70.41.3.18, 150.172.238.178',
    });
    expect(getClientIP(req)).toBe('203.0.113.50');
  });

  it('trims whitespace from x-forwarded-for IPs', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockRequest({
      ip: '127.0.0.1',
      forwardedFor: '  203.0.113.50  , 70.41.3.18',
    });
    expect(getClientIP(req)).toBe('203.0.113.50');
  });

  it('falls back to req.ip when x-forwarded-for is empty string', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockRequest({ ip: '192.168.1.1', forwardedFor: '' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('falls back to req.ip when x-forwarded-for header is absent', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockRequest({ ip: '192.168.1.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  // --- Fallback chain ---

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const req = mockRequest({ remoteAddress: '10.0.0.5' });
    expect(getClientIP(req)).toBe('10.0.0.5');
  });

  it('returns "unknown" when all IP sources are undefined', () => {
    const req = mockRequest({});
    expect(getClientIP(req)).toBe('unknown');
  });
});
