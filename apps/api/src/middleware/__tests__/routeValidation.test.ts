/**
 * Integration Tests: Route Validation Middleware
 *
 * Tests the Express middleware layer for route parameter validation.
 * These are integration tests that verify the middleware correctly uses
 * the shared validation library and returns appropriate HTTP responses.
 *
 * Coverage Target: 100% on routeValidation.ts
 * Test Count: 16 (8 bills + 8 legislators)
 *
 * @module api/middleware/__tests__/routeValidation
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  validateBillIdParam,
  validateLegislatorIdParam,
} from '../routeValidation.js';

describe('Route Validation Middleware', () => {
  describe('validateBillIdParam', () => {
    // TC-INT-01: Valid Bill ID → next() Called
    it('should call next() for valid bill ID', () => {
      const req = { params: { id: 'hr-1234-118' } } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      validateBillIdParam(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    // TC-INT-02: Multiple Valid Formats
    it('should accept all valid bill type formats', () => {
      const validIds = [
        'hr-1-118',
        's-567-119',
        'hjres-45-118',
        'hconres-9999-119',
      ];

      validIds.forEach((id) => {
        const req = { params: { id } } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn();

        validateBillIdParam(req, res, next);
        expect(next).toHaveBeenCalled();
      });
    });

    // TC-INT-03: Invalid Bill ID → 400 Response
    it('should return 400 for invalid bill ID', () => {
      const req = { params: { id: 'INVALID-ID' } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateBillIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INVALID_FORMAT',
          details: expect.any(Object),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-04: Empty Bill ID → 400 Response
    it('should return 400 for empty bill ID', () => {
      const req = { params: { id: '' } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateBillIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'EMPTY_VALUE',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-05: XSS Attack → 400 Response
    it('should return 400 for XSS attack attempt', () => {
      const req = {
        params: { id: '<script>alert("xss")</script>' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateBillIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INVALID_FORMAT',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-06: ReDoS Attack → Fast 400 Response (<10ms)
    it('should reject ReDoS attempts in <10ms', () => {
      const maliciousId = 'a'.repeat(100000) + '-1-118';
      const req = { params: { id: maliciousId } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      const start = performance.now();
      validateBillIdParam(req, res, next);
      const duration = performance.now() - start;

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'EXCEEDS_MAX_LENGTH',
        })
      );
      expect(duration).toBeLessThan(10); // Fast rejection
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-07: Error Response Structure
    it('should return consistent error response structure', () => {
      const testCases = [
        { id: '', expectedCode: 'EMPTY_VALUE' },
        { id: 'INVALID', expectedCode: 'INVALID_FORMAT' },
        { id: 'a'.repeat(100), expectedCode: 'EXCEEDS_MAX_LENGTH' },
      ];

      testCases.forEach(({ id, expectedCode }) => {
        const req = { params: { id } } as unknown as Request;
        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        validateBillIdParam(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(String),
            code: expectedCode,
            details: expect.any(Object),
          })
        );
      });
    });

    // TC-INT-08: Error Details Context
    it('should include helpful context in error details', () => {
      const invalidId = 'invalid-bill-id';
      const req = { params: { id: invalidId } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateBillIdParam(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            received: invalidId,
          }),
        })
      );
    });
  });

  describe('validateLegislatorIdParam', () => {
    // TC-INT-09: Valid Legislator ID → next() Called
    it('should call next() for valid legislator ID', () => {
      const req = { params: { id: 'A000360' } } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      validateLegislatorIdParam(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    // TC-INT-10: Multiple Valid Formats
    it('should accept all valid legislator ID formats', () => {
      const validIds = ['A000360', 'S001198', 'Z999999'];

      validIds.forEach((id) => {
        const req = { params: { id } } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn();

        validateLegislatorIdParam(req, res, next);
        expect(next).toHaveBeenCalled();
      });
    });

    // TC-INT-11: Invalid Legislator ID → 400 Response
    it('should return 400 for invalid legislator ID', () => {
      const req = { params: { id: 'INVALID' } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateLegislatorIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INVALID_FORMAT',
          details: expect.any(Object),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-12: Empty Legislator ID → 400 Response
    it('should return 400 for empty legislator ID', () => {
      const req = { params: { id: '' } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateLegislatorIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'EMPTY_VALUE',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-13: XSS Attack → 400 Response
    it('should return 400 for XSS attack attempt', () => {
      const req = {
        params: { id: '<script>xss</script>' }, // 20 chars - at length limit
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateLegislatorIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INVALID_FORMAT',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-14: ReDoS Attack → Fast 400 Response (<10ms)
    it('should reject ReDoS attempts in <10ms', () => {
      const maliciousId = 'A' + '0'.repeat(100000);
      const req = { params: { id: maliciousId } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      const start = performance.now();
      validateLegislatorIdParam(req, res, next);
      const duration = performance.now() - start;

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'EXCEEDS_MAX_LENGTH',
        })
      );
      expect(duration).toBeLessThan(10); // Fast rejection
      expect(next).not.toHaveBeenCalled();
    });

    // TC-INT-15: Error Response Structure
    it('should return consistent error response structure', () => {
      const testCases = [
        { id: '', expectedCode: 'EMPTY_VALUE' },
        { id: 'invalid', expectedCode: 'INVALID_FORMAT' },
        { id: 'A' + '0'.repeat(100), expectedCode: 'EXCEEDS_MAX_LENGTH' },
      ];

      testCases.forEach(({ id, expectedCode }) => {
        const req = { params: { id } } as unknown as Request;
        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        validateLegislatorIdParam(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(String),
            code: expectedCode,
            details: expect.any(Object),
          })
        );
      });
    });

    // TC-INT-16: Error Details Context
    it('should include helpful context in error details', () => {
      const invalidId = 'a000360'; // lowercase (invalid)
      const req = { params: { id: invalidId } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validateLegislatorIdParam(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            received: invalidId,
          }),
        })
      );
    });
  });
});
