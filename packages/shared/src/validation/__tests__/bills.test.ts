/**
 * Bill ID Validation Test Suite
 *
 * Tests comprehensive validation including:
 * - Valid formats (4 cases)
 * - Invalid formats (5 cases)
 * - Security attack vectors (3 cases)
 * - Type safety (1 case)
 * - ReDoS prevention (1 case)
 *
 * Target: 100% coverage of bills.ts
 */
import { describe, it, expect } from 'vitest';
import {
  isValidBillId,
  validateBillId,
  BILL_ID_MAX_LENGTH,
  BILL_ID_PATTERN,
} from '../bills';
import { measurePerformance } from './test-utils';

describe('Bill ID Validation', () => {
  // =========================================================================
  // CATEGORY 1: Valid Input Tests (4 cases)
  // =========================================================================

  describe('Valid Formats', () => {
    /**
     * TEST CASE 1: Standard House Bill
     *
     * Input: 'hr-1234-118'
     * Expected: true
     * Rationale: Most common bill format
     */
    it('should accept standard house bill format', () => {
      // Arrange
      const validId = 'hr-1234-118';

      // Act
      const result = isValidBillId(validId);

      // Assert
      expect(result).toBe(true);
    });

    /**
     * TEST CASE 2: Senate Bill
     *
     * Input: 's-567-119'
     * Expected: true
     * Rationale: Senate bills use single letter prefix
     */
    it('should accept senate bill format', () => {
      // Arrange
      const validId = 's-567-119';

      // Act
      const result = isValidBillId(validId);

      // Assert
      expect(result).toBe(true);
    });

    /**
     * TEST CASE 3: House Joint Resolution
     *
     * Input: 'hjres-45-118'
     * Expected: true
     * Rationale: Multi-character bill type prefix
     */
    it('should accept house joint resolution format', () => {
      // Arrange
      const validId = 'hjres-45-118';

      // Act
      const result = isValidBillId(validId);

      // Assert
      expect(result).toBe(true);
    });

    /**
     * TEST CASE 4: Maximum Realistic Length
     *
     * Input: 'hconres-9999-119'
     * Expected: true
     * Rationale: Longest realistic bill ID (16 chars)
     */
    it('should accept maximum realistic length bill ID', () => {
      // Arrange
      const validId = 'hconres-9999-119';

      // Act
      const result = isValidBillId(validId);

      // Assert
      expect(result).toBe(true);
      expect(validId.length).toBeLessThanOrEqual(BILL_ID_MAX_LENGTH);
    });
  });

  // =========================================================================
  // CATEGORY 2: Invalid Format Tests (5 cases)
  // =========================================================================

  describe('Invalid Formats', () => {
    /**
     * TEST CASE 5: Empty String
     *
     * Input: ''
     * Expected: false
     * Rationale: Empty IDs should be rejected immediately
     */
    it('should reject empty string', () => {
      // Arrange
      const emptyId = '';

      // Act
      const result = isValidBillId(emptyId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 6: Missing Parts
     *
     * Input: 'hr-1234'
     * Expected: false
     * Rationale: Bill ID requires 3 parts (billType-number-congress)
     */
    it('should reject bill ID with only 2 parts', () => {
      // Arrange
      const incompleteId = 'hr-1234';

      // Act
      const result = isValidBillId(incompleteId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 7: Wrong Separator
     *
     * Input: 'hr_1234_118'
     * Expected: false
     * Rationale: Must use hyphens, not underscores
     */
    it('should reject bill ID with wrong separator', () => {
      // Arrange
      const wrongSeparator = 'hr_1234_118';

      // Act
      const result = isValidBillId(wrongSeparator);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 8: Uppercase Bill Type
     *
     * Input: 'HR-1234-118'
     * Expected: false
     * Rationale: Bill type must be lowercase
     */
    it('should reject uppercase bill type', () => {
      // Arrange
      const uppercaseId = 'HR-1234-118';

      // Act
      const result = isValidBillId(uppercaseId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 9: Excessive Length
     *
     * Input: 'a'.repeat(51) + '-1-118'
     * Expected: false
     * Rationale: Exceeds BILL_ID_MAX_LENGTH (50 chars)
     */
    it('should reject bill ID exceeding maximum length', () => {
      // Arrange
      const tooLong = 'a'.repeat(51) + '-1-118';

      // Act
      const result = isValidBillId(tooLong);

      // Assert
      expect(result).toBe(false);
      expect(tooLong.length).toBeGreaterThan(BILL_ID_MAX_LENGTH);
    });
  });

  // =========================================================================
  // CATEGORY 3: Security Attack Vectors (3 cases)
  // =========================================================================

  describe('Security - Attack Vector Prevention', () => {
    /**
     * TEST CASE 10: XSS Attack
     *
     * Input: '<script>alert("xss")</script>'
     * Expected: false
     * Rationale: Prevent cross-site scripting injection
     */
    it('should block XSS attack attempts', () => {
      // Arrange
      const xssPayload = '<script>alert("xss")</script>';

      // Act
      const result = isValidBillId(xssPayload);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 11: SQL Injection Attack
     *
     * Input: "' OR 1=1--"
     * Expected: false
     * Rationale: Prevent SQL injection attacks
     */
    it('should block SQL injection attempts', () => {
      // Arrange
      const sqlInjection = "' OR 1=1--";

      // Act
      const result = isValidBillId(sqlInjection);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 12: Path Traversal Attack
     *
     * Input: '../../etc/passwd'
     * Expected: false
     * Rationale: Prevent directory traversal attacks
     */
    it('should block path traversal attempts', () => {
      // Arrange
      const pathTraversal = '../../etc/passwd';

      // Act
      const result = isValidBillId(pathTraversal);

      // Assert
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // CATEGORY 4: Type Safety Tests (1 case)
  // =========================================================================

  describe('Type Safety', () => {
    /**
     * TEST CASE 13: Non-String Input Types
     *
     * Inputs: null, undefined, number, object, array, boolean
     * Expected: false for all
     * Rationale: Type guard must reject non-string inputs
     */
    it('should reject all non-string input types', () => {
      // Arrange
      const nonStringInputs = [
        null,
        undefined,
        12345,
        { id: 'hr-1234-118' },
        ['hr-1234-118'],
        true,
        false,
      ];

      // Act & Assert
      nonStringInputs.forEach((input) => {
        const result = isValidBillId(input as unknown);
        expect(result).toBe(false);
      });
    });
  });

  // =========================================================================
  // CATEGORY 5: ReDoS Prevention with Performance Benchmarks (1 case)
  // =========================================================================

  describe('ReDoS Prevention (Performance)', () => {
    /**
     * TEST CASE 14: Malicious Long String Rejection Speed
     *
     * Input: 'a'.repeat(100000) + '-1-118'
     * Expected: false, duration < 1ms
     * Rationale: Length guard prevents CPU exhaustion (GAP-2 mitigation)
     *
     * Performance Requirement:
     * - WITHOUT length guard: >1000ms (ReDoS vulnerability)
     * - WITH length guard: <1ms (safe rejection)
     */
    it('should reject excessively long strings in <1ms via length guard', () => {
      // Arrange
      const maliciousId = 'a'.repeat(100000) + '-1-118';

      // Act
      const { result, duration } = measurePerformance(() =>
        isValidBillId(maliciousId)
      );

      // Assert
      expect(result).toBe(false);
      expect(duration).toBeLessThan(1); // Sub-millisecond rejection
      expect(maliciousId.length).toBeGreaterThan(BILL_ID_MAX_LENGTH);
    });
  });

  // =========================================================================
  // Rich Validation Function Tests (validateBillId)
  // =========================================================================

  describe('validateBillId() - Rich Error Messages', () => {
    /**
     * TEST: Valid Input Returns Success
     */
    it('should return valid result for correct bill ID', () => {
      // Arrange
      const validId = 'hr-1234-118';

      // Act
      const result = validateBillId(validId);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    /**
     * TEST: Invalid Type Returns Structured Error
     */
    it('should return structured error for non-string input', () => {
      // Arrange
      const invalidInput = 12345;

      // Act
      const result = validateBillId(invalidInput as unknown);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bill ID must be a string');
      expect(result.code).toBe('INVALID_TYPE');
      expect(result.context?.received).toBe('number');
    });

    /**
     * TEST: Empty String Returns Structured Error
     */
    it('should return structured error for empty string', () => {
      // Arrange
      const emptyId = '';

      // Act
      const result = validateBillId(emptyId);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bill ID cannot be empty');
      expect(result.code).toBe('EMPTY_VALUE');
    });

    /**
     * TEST: Excessive Length Returns Structured Error
     */
    it('should return structured error for excessive length', () => {
      // Arrange
      const tooLong = 'a'.repeat(51) + '-1-118';

      // Act
      const result = validateBillId(tooLong);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
      expect(result.code).toBe('EXCEEDS_MAX_LENGTH');
      expect(result.context?.constraint).toBe(BILL_ID_MAX_LENGTH);
    });

    /**
     * TEST: Invalid Format Returns Structured Error
     */
    it('should return structured error for invalid format', () => {
      // Arrange
      const invalidFormat = 'INVALID-FORMAT';

      // Act
      const result = validateBillId(invalidFormat);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Bill ID format must be');
      expect(result.code).toBe('INVALID_FORMAT');
    });
  });

  // =========================================================================
  // Constants Validation
  // =========================================================================

  describe('Exported Constants', () => {
    it('BILL_ID_MAX_LENGTH should be 50', () => {
      expect(BILL_ID_MAX_LENGTH).toBe(50);
    });

    it('BILL_ID_PATTERN should match valid bill IDs', () => {
      expect(BILL_ID_PATTERN.test('hr-1234-118')).toBe(true);
      expect(BILL_ID_PATTERN.test('s-567-119')).toBe(true);
      expect(BILL_ID_PATTERN.test('hjres-45-118')).toBe(true);
    });

    it('BILL_ID_PATTERN should reject invalid bill IDs', () => {
      expect(BILL_ID_PATTERN.test('HR-1234-118')).toBe(false); // Uppercase
      expect(BILL_ID_PATTERN.test('hr-1234')).toBe(false); // Missing part
      expect(BILL_ID_PATTERN.test('hr_1234_118')).toBe(false); // Wrong separator
    });
  });
});
