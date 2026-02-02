/**
 * M-3 Input Validation Test Suite
 *
 * Tests that input validation prevents XSS and SQL injection attacks
 * through ID parameters and query strings (CVSS 5.3)
 *
 * @security M-3: Validates all user inputs to prevent injection attacks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  validateId,
  validateQueryParams,
  ValidationError,
  isValidationError,
  getBill,
  getBills,
  getLegislator,
  getLegislators,
  getVote,
  getVotes,
  getBillAnalysis,
  getConflicts,
  getBillConflicts,
  type ValidationSchema,
} from '../api';

describe('M-3: Input Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateId() function', () => {
    describe('Valid IDs', () => {
      it('should accept alphanumeric IDs', () => {
        expect(validateId('abc123', 'testId')).toBe('abc123');
        expect(validateId('ABC123', 'testId')).toBe('ABC123');
        expect(validateId('Test123ID', 'testId')).toBe('Test123ID');
      });

      it('should accept IDs with hyphens', () => {
        expect(validateId('hr-1234', 'billId')).toBe('hr-1234');
        expect(validateId('s-5678-abc', 'billId')).toBe('s-5678-abc');
      });

      it('should accept IDs with underscores', () => {
        expect(validateId('bill_123', 'billId')).toBe('bill_123');
        expect(validateId('legislator_456_def', 'legislatorId')).toBe('legislator_456_def');
      });

      it('should trim whitespace', () => {
        expect(validateId('  abc123  ', 'testId')).toBe('abc123');
        expect(validateId('\t\nid-456\n\t', 'testId')).toBe('id-456');
      });

      it('should accept IDs up to 100 characters', () => {
        const longId = 'a'.repeat(100);
        expect(validateId(longId, 'testId')).toBe(longId);
      });
    });

    describe('Invalid IDs - XSS Prevention', () => {
      it('should reject IDs with script tags', () => {
        expect(() => validateId('<script>alert(1)</script>', 'billId')).toThrow(ValidationError);
        expect(() => validateId('hr<script>alert(1)</script>', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with HTML tags', () => {
        expect(() => validateId('<img src=x onerror=alert(1)>', 'billId')).toThrow(ValidationError);
        expect(() => validateId('<div>test</div>', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with angle brackets', () => {
        expect(() => validateId('test<123', 'billId')).toThrow(ValidationError);
        expect(() => validateId('test>123', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with quotes', () => {
        expect(() => validateId('test"123', 'billId')).toThrow(ValidationError);
        expect(() => validateId("test'123", 'billId')).toThrow(ValidationError);
        expect(() => validateId('test`123', 'billId')).toThrow(ValidationError);
      });
    });

    describe('Invalid IDs - SQL Injection Prevention', () => {
      it('should reject IDs with SQL keywords', () => {
        expect(() => validateId("1' OR '1'='1", 'billId')).toThrow(ValidationError);
        expect(() => validateId('admin--', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with semicolons', () => {
        expect(() => validateId('test;DROP TABLE bills;', 'billId')).toThrow(ValidationError);
        expect(() => validateId('hr-123;', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with parentheses', () => {
        expect(() => validateId('test(123)', 'billId')).toThrow(ValidationError);
        expect(() => validateId('SELECT * FROM bills WHERE id=1', 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with SQL comment markers', () => {
        expect(() => validateId('test/*comment*/', 'billId')).toThrow(ValidationError);
        expect(() => validateId('test#comment', 'billId')).toThrow(ValidationError);
      });
    });

    describe('Invalid IDs - Length and Format', () => {
      it('should reject empty IDs', () => {
        expect(() => validateId('', 'billId')).toThrow(ValidationError);
        expect(() => validateId('   ', 'billId')).toThrow(ValidationError);
      });

      it('should reject null/undefined IDs', () => {
        expect(() => validateId(null as any, 'billId')).toThrow(ValidationError);
        expect(() => validateId(undefined as any, 'billId')).toThrow(ValidationError);
      });

      it('should reject non-string IDs', () => {
        expect(() => validateId(123 as any, 'billId')).toThrow(ValidationError);
        expect(() => validateId({ id: '123' } as any, 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs over 100 characters', () => {
        const tooLong = 'a'.repeat(101);
        expect(() => validateId(tooLong, 'billId')).toThrow(ValidationError);
      });

      it('should reject IDs with special characters', () => {
        expect(() => validateId('test@example.com', 'billId')).toThrow(ValidationError);
        expect(() => validateId('test$123', 'billId')).toThrow(ValidationError);
        expect(() => validateId('test%20123', 'billId')).toThrow(ValidationError);
        expect(() => validateId('test&123', 'billId')).toThrow(ValidationError);
      });

      it('should provide field name in error message', () => {
        try {
          validateId('invalid!id', 'customFieldName');
          expect.fail('Should have thrown');
        } catch (error: any) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.message).toContain('customFieldName');
          expect(error.field).toBe('customFieldName');
        }
      });
    });
  });

  describe('validateQueryParams() function', () => {
    describe('String validation', () => {
      const schema: ValidationSchema = {
        search: { type: 'string', maxLength: 50 },
      };

      it('should accept valid strings', () => {
        const result = validateQueryParams({ search: 'healthcare' }, schema);
        expect(result.search).toBe('healthcare');
      });

      it('should trim strings', () => {
        const result = validateQueryParams({ search: '  tax reform  ' }, schema);
        expect(result.search).toBe('tax reform');
      });

      it('should reject strings over maxLength', () => {
        const tooLong = 'a'.repeat(51);
        expect(() => validateQueryParams({ search: tooLong }, schema)).toThrow(ValidationError);
      });

      it('should reject strings with control characters', () => {
        expect(() => validateQueryParams({ search: 'test\x00null' }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ search: 'test\x1Fcontrol' }, schema)).toThrow(ValidationError);
      });

      it('should enforce default maxLength of 500', () => {
        const noMaxSchema: ValidationSchema = {
          search: { type: 'string' },
        };
        const longString = 'a'.repeat(500);
        const tooLong = 'a'.repeat(501);

        expect(() => validateQueryParams({ search: longString }, noMaxSchema)).not.toThrow();
        expect(() => validateQueryParams({ search: tooLong }, noMaxSchema)).toThrow(ValidationError);
      });

      it('should validate with pattern', () => {
        const patternSchema: ValidationSchema = {
          state: { type: 'string', pattern: /^[A-Z]{2}$/ },
        };

        expect(() => validateQueryParams({ state: 'CA' }, patternSchema)).not.toThrow();
        expect(() => validateQueryParams({ state: 'California' }, patternSchema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ state: 'ca' }, patternSchema)).toThrow(ValidationError);
      });
    });

    describe('Number validation', () => {
      const schema: ValidationSchema = {
        limit: { type: 'number', integer: true, min: 1, max: 100 },
        score: { type: 'number', min: 0, max: 1 },
      };

      it('should accept valid integers', () => {
        const result = validateQueryParams({ limit: 50 }, schema);
        expect(result.limit).toBe(50);
      });

      it('should accept valid floats', () => {
        const result = validateQueryParams({ score: 0.75 }, schema);
        expect(result.score).toBe(0.75);
      });

      it('should convert string numbers', () => {
        const result = validateQueryParams({ limit: '25' } as any, schema);
        expect(result.limit).toBe(25);
      });

      it('should reject non-integers when integer required', () => {
        expect(() => validateQueryParams({ limit: 25.5 }, schema)).toThrow(ValidationError);
      });

      it('should reject numbers below min', () => {
        expect(() => validateQueryParams({ limit: 0 }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ score: -0.1 }, schema)).toThrow(ValidationError);
      });

      it('should reject numbers above max', () => {
        expect(() => validateQueryParams({ limit: 101 }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ score: 1.1 }, schema)).toThrow(ValidationError);
      });

      it('should reject NaN', () => {
        expect(() => validateQueryParams({ limit: NaN }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ limit: 'not-a-number' } as any, schema)).toThrow(ValidationError);
      });

      it('should reject Infinity', () => {
        expect(() => validateQueryParams({ limit: Infinity }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ limit: -Infinity }, schema)).toThrow(ValidationError);
      });
    });

    describe('Enum validation', () => {
      const schema: ValidationSchema = {
        chamber: { type: 'enum', values: ['house', 'senate'] as const },
        status: { type: 'enum', values: ['active', 'inactive', 'pending'] as const },
      };

      it('should accept valid enum values', () => {
        const result = validateQueryParams({ chamber: 'house', status: 'active' }, schema);
        expect(result.chamber).toBe('house');
        expect(result.status).toBe('active');
      });

      it('should reject invalid enum values', () => {
        expect(() => validateQueryParams({ chamber: 'parliament' }, schema)).toThrow(ValidationError);
        expect(() => validateQueryParams({ status: 'unknown' }, schema)).toThrow(ValidationError);
      });

      it('should trim enum values', () => {
        const result = validateQueryParams({ chamber: '  senate  ' }, schema);
        expect(result.chamber).toBe('senate');
      });

      it('should reject non-string enum values', () => {
        expect(() => validateQueryParams({ chamber: 123 } as any, schema)).toThrow(ValidationError);
      });

      it('should provide helpful error with allowed values', () => {
        try {
          validateQueryParams({ chamber: 'invalid' }, schema);
          expect.fail('Should have thrown');
        } catch (error: any) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.message).toContain('house');
          expect(error.message).toContain('senate');
        }
      });
    });

    describe('Security - Unknown fields', () => {
      const schema: ValidationSchema = {
        search: { type: 'string', maxLength: 50 },
      };

      it('should silently ignore unknown fields (defensive)', () => {
        const result = validateQueryParams(
          { search: 'test', unknownField: 'value', anotherUnknown: 123 } as any,
          schema
        );
        expect(result).toEqual({ search: 'test' });
        expect('unknownField' in result).toBe(false);
      });
    });

    describe('Security - Undefined values', () => {
      const schema: ValidationSchema = {
        search: { type: 'string', maxLength: 50 },
        limit: { type: 'number', integer: true, min: 1, max: 100 },
      };

      it('should skip undefined values', () => {
        const result = validateQueryParams({ search: 'test', limit: undefined }, schema);
        expect(result).toEqual({ search: 'test' });
        expect('limit' in result).toBe(false);
      });
    });
  });

  describe('API Functions Integration', () => {
    beforeEach(() => {
      // Mock fetch to prevent actual API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({ id: 'test', data: [] }),
      });
    });

    describe('getBill()', () => {
      it('should reject invalid bill IDs', async () => {
        await expect(getBill('<script>alert(1)</script>')).rejects.toThrow(ValidationError);
        await expect(getBill("1' OR '1'='1")).rejects.toThrow(ValidationError);
        await expect(getBill('hr-123;DROP TABLE bills;')).rejects.toThrow(ValidationError);
      });

      it('should accept valid bill IDs', async () => {
        await expect(getBill('hr-1234')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/bills/hr-1234'),
          expect.any(Object)
        );
      });
    });

    describe('getBillAnalysis()', () => {
      it('should reject invalid bill IDs', async () => {
        await expect(getBillAnalysis('<img src=x onerror=alert(1)>')).rejects.toThrow(ValidationError);
        await expect(getBillAnalysis('test@example.com')).rejects.toThrow(ValidationError);
      });

      it('should accept valid bill IDs', async () => {
        await expect(getBillAnalysis('s-5678')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/analysis/s-5678'),
          expect.any(Object)
        );
      });
    });

    describe('getLegislator()', () => {
      it('should reject invalid legislator IDs', async () => {
        await expect(getLegislator('test$123')).rejects.toThrow(ValidationError);
        await expect(getLegislator('admin--')).rejects.toThrow(ValidationError);
      });

      it('should accept valid legislator IDs', async () => {
        await expect(getLegislator('leg-123')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/legislators/leg-123'),
          expect.any(Object)
        );
      });
    });

    describe('getVote()', () => {
      it('should reject invalid vote IDs', async () => {
        await expect(getVote('test%20123')).rejects.toThrow(ValidationError);
        await expect(getVote('vote;DROP TABLE votes;')).rejects.toThrow(ValidationError);
      });

      it('should accept valid vote IDs', async () => {
        await expect(getVote('vote-456')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/votes/vote-456'),
          expect.any(Object)
        );
      });
    });

    describe('getConflicts()', () => {
      it('should reject invalid legislator IDs', async () => {
        await expect(getConflicts('test/*comment*/')).rejects.toThrow(ValidationError);
      });

      it('should accept valid legislator IDs', async () => {
        await expect(getConflicts('leg-789')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/conflicts?legislatorId=leg-789'),
          expect.any(Object)
        );
      });
    });

    describe('getBillConflicts()', () => {
      it('should reject invalid bill IDs', async () => {
        await expect(getBillConflicts('test#comment')).rejects.toThrow(ValidationError);
      });

      it('should accept valid bill IDs', async () => {
        await expect(getBillConflicts('hr-999')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/conflicts?billId=hr-999'),
          expect.any(Object)
        );
      });
    });

    describe('getBills() query params', () => {
      it('should reject invalid query params', async () => {
        await expect(getBills({ congressNumber: -1 })).rejects.toThrow(ValidationError);
        await expect(getBills({ limit: 1000 })).rejects.toThrow(ValidationError);
        await expect(getBills({ billType: 'invalid' as any })).rejects.toThrow(ValidationError);
        await expect(getBills({ chamber: 'parliament' as any })).rejects.toThrow(ValidationError);
      });

      it('should accept valid query params', async () => {
        await expect(getBills({
          congressNumber: 118,
          billType: 'hr',
          chamber: 'house',
          limit: 50,
        })).resolves.toBeDefined();
      });
    });

    describe('getLegislators() query params', () => {
      it('should reject invalid query params', async () => {
        await expect(getLegislators({ party: 'X' as any })).rejects.toThrow(ValidationError);
        await expect(getLegislators({ state: 'California' })).rejects.toThrow(ValidationError);
        await expect(getLegislators({ offset: -10 })).rejects.toThrow(ValidationError);
      });

      it('should accept valid query params', async () => {
        await expect(getLegislators({
          chamber: 'senate',
          party: 'D',
          state: 'CA',
          limit: 25,
        })).resolves.toBeDefined();
      });
    });

    describe('getVotes() query params', () => {
      it('should reject invalid query params', async () => {
        await expect(getVotes({ result: 'unknown' as any })).rejects.toThrow(ValidationError);
        await expect(getVotes({ billId: 'invalid!bill' })).rejects.toThrow(ValidationError);
      });

      it('should accept valid query params', async () => {
        await expect(getVotes({
          chamber: 'house',
          result: 'passed',
          limit: 100,
        })).resolves.toBeDefined();
      });
    });
  });

  describe('isValidationError() type guard', () => {
    it('should identify ValidationError instances', () => {
      const error = new ValidationError('Test error', 'testField');
      expect(isValidationError(error)).toBe(true);
    });

    it('should reject non-ValidationError instances', () => {
      expect(isValidationError(new Error('Regular error'))).toBe(false);
      expect(isValidationError('string')).toBe(false);
      expect(isValidationError(null)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
    });

    it('should work with ValidationError metadata', () => {
      const error = new ValidationError('Invalid billId', 'billId');
      expect(isValidationError(error)).toBe(true);
      expect(error.field).toBe('billId');
      expect(error.message).toBe('Invalid billId');
    });
  });

  describe('Comprehensive XSS/SQLi attack vectors', () => {
    describe('XSS vectors', () => {
      const xssVectors = [
        '<script>alert(document.cookie)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>alert(1)</script>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
      ];

      xssVectors.forEach((vector) => {
        it(`should reject XSS vector: ${vector.substring(0, 40)}...`, () => {
          expect(() => validateId(vector, 'testId')).toThrow(ValidationError);
        });
      });
    });

    describe('SQL injection vectors', () => {
      const sqliVectors = [
        "1' OR '1'='1",
        "admin'--",
        "1; DROP TABLE users--",
        "' UNION SELECT * FROM passwords--",
        "1'; DELETE FROM bills WHERE '1'='1",
        "admin' OR 1=1--",
        "' OR 'a'='a",
        "1' AND 1=0 UNION ALL SELECT 'admin', 'password'--",
      ];

      sqliVectors.forEach((vector) => {
        it(`should reject SQLi vector: ${vector}`, () => {
          expect(() => validateId(vector, 'testId')).toThrow(ValidationError);
        });
      });
    });
  });
});
