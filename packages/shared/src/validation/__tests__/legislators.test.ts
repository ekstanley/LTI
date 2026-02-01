/**
 * Legislator ID Validation Test Suite
 *
 * Tests comprehensive validation including:
 * - Valid formats (3 cases)
 * - Invalid formats (6 cases)
 * - Security attack vectors (3 cases)
 * - Type safety (1 case)
 * - ReDoS prevention (1 case)
 *
 * Target: 100% coverage of legislators.ts
 */
import { describe, it, expect } from 'vitest';
import {
  isValidLegislatorId,
  validateLegislatorId,
  LEGISLATOR_ID_MAX_LENGTH,
  LEGISLATOR_ID_PATTERN,
} from '../legislators';
import { measurePerformance } from './test-utils';

describe('Legislator ID Validation', () => {
  // =========================================================================
  // CATEGORY 1: Valid Input Tests (3 cases)
  // =========================================================================

  describe('Valid Formats', () => {
    /**
     * TEST CASE 1: Standard Bioguide ID
     *
     * Input: 'A000360'
     * Expected: true
     * Rationale: Standard format (1 uppercase letter + 6 digits)
     */
    it('should accept standard bioguide ID format', () => {
      // Arrange
      const validId = 'A000360';

      // Act
      const result = isValidLegislatorId(validId);

      // Assert
      expect(result).toBe(true);
    });

    /**
     * TEST CASE 2: Various Letter Prefixes
     *
     * Inputs: 'S001198', 'M001111', 'Z999999'
     * Expected: true for all
     * Rationale: All uppercase letters are valid
     */
    it('should accept various uppercase letter prefixes', () => {
      // Arrange
      const validIds = ['S001198', 'M001111', 'Z999999'];

      // Act & Assert
      validIds.forEach((id) => {
        const result = isValidLegislatorId(id);
        expect(result).toBe(true);
      });
    });

    /**
     * TEST CASE 3: Minimum and Maximum Numeric Values
     *
     * Inputs: 'A000000', 'Z999999'
     * Expected: true for both
     * Rationale: Test numeric boundaries
     */
    it('should accept minimum and maximum numeric values', () => {
      // Arrange
      const minId = 'A000000';
      const maxId = 'Z999999';

      // Act
      const minResult = isValidLegislatorId(minId);
      const maxResult = isValidLegislatorId(maxId);

      // Assert
      expect(minResult).toBe(true);
      expect(maxResult).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 2: Invalid Format Tests (6 cases)
  // =========================================================================

  describe('Invalid Formats', () => {
    /**
     * TEST CASE 4: Empty String
     *
     * Input: ''
     * Expected: false
     * Rationale: Empty IDs should be rejected immediately
     */
    it('should reject empty string', () => {
      // Arrange
      const emptyId = '';

      // Act
      const result = isValidLegislatorId(emptyId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 5: Too Short
     *
     * Input: 'A00036' (6 characters instead of 7)
     * Expected: false
     * Rationale: Must be exactly 7 characters
     */
    it('should reject ID shorter than 7 characters', () => {
      // Arrange
      const tooShort = 'A00036';

      // Act
      const result = isValidLegislatorId(tooShort);

      // Assert
      expect(result).toBe(false);
      expect(tooShort.length).toBeLessThan(7);
    });

    /**
     * TEST CASE 6: Too Long
     *
     * Input: 'A0003600' (8 characters instead of 7)
     * Expected: false
     * Rationale: Must be exactly 7 characters
     */
    it('should reject ID longer than 7 characters', () => {
      // Arrange
      const tooLong = 'A0003600';

      // Act
      const result = isValidLegislatorId(tooLong);

      // Assert
      expect(result).toBe(false);
      expect(tooLong.length).toBeGreaterThan(7);
    });

    /**
     * TEST CASE 7: Lowercase Letter
     *
     * Input: 'a000360'
     * Expected: false
     * Rationale: First character must be uppercase
     */
    it('should reject lowercase first letter', () => {
      // Arrange
      const lowercaseId = 'a000360';

      // Act
      const result = isValidLegislatorId(lowercaseId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 8: Multiple Letters
     *
     * Input: 'AA00360'
     * Expected: false
     * Rationale: Must have exactly 1 letter + 6 digits
     */
    it('should reject multiple letter prefix', () => {
      // Arrange
      const multiLetter = 'AA00360';

      // Act
      const result = isValidLegislatorId(multiLetter);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * TEST CASE 9: Special Characters
     *
     * Input: 'A-00036'
     * Expected: false
     * Rationale: Only alphanumeric characters allowed
     */
    it('should reject special characters', () => {
      // Arrange
      const specialChars = 'A-00036';

      // Act
      const result = isValidLegislatorId(specialChars);

      // Assert
      expect(result).toBe(false);
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
      const result = isValidLegislatorId(xssPayload);

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
      const result = isValidLegislatorId(sqlInjection);

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
      const result = isValidLegislatorId(pathTraversal);

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
        { id: 'A000360' },
        ['A000360'],
        true,
        false,
      ];

      // Act & Assert
      nonStringInputs.forEach((input) => {
        const result = isValidLegislatorId(input as unknown);
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
     * Input: 'A' + '0'.repeat(100000)
     * Expected: false, duration < 1ms
     * Rationale: Length guard prevents CPU exhaustion (GAP-2 mitigation)
     */
    it('should reject excessively long strings in <1ms via length guard', () => {
      // Arrange
      const maliciousId = 'A' + '0'.repeat(100000);

      // Act
      const { result, duration } = measurePerformance(() =>
        isValidLegislatorId(maliciousId)
      );

      // Assert
      expect(result).toBe(false);
      expect(duration).toBeLessThan(1); // Sub-millisecond rejection
      expect(maliciousId.length).toBeGreaterThan(LEGISLATOR_ID_MAX_LENGTH);
    });
  });

  // =========================================================================
  // Rich Validation Function Tests (validateLegislatorId)
  // =========================================================================

  describe('validateLegislatorId() - Rich Error Messages', () => {
    /**
     * TEST: Valid Input Returns Success
     */
    it('should return valid result for correct legislator ID', () => {
      // Arrange
      const validId = 'A000360';

      // Act
      const result = validateLegislatorId(validId);

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
      const result = validateLegislatorId(invalidInput as unknown);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Legislator ID must be a string');
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
      const result = validateLegislatorId(emptyId);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Legislator ID cannot be empty');
      expect(result.code).toBe('EMPTY_VALUE');
    });

    /**
     * TEST: Excessive Length Returns Structured Error
     */
    it('should return structured error for excessive length', () => {
      // Arrange
      const tooLong = 'A' + '0'.repeat(21);

      // Act
      const result = validateLegislatorId(tooLong);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
      expect(result.code).toBe('EXCEEDS_MAX_LENGTH');
      expect(result.context?.constraint).toBe(LEGISLATOR_ID_MAX_LENGTH);
    });

    /**
     * TEST: Invalid Format Returns Structured Error
     */
    it('should return structured error for invalid format', () => {
      // Arrange
      const invalidFormat = 'INVALID';

      // Act
      const result = validateLegislatorId(invalidFormat);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Legislator ID format must be');
      expect(result.code).toBe('INVALID_FORMAT');
    });
  });

  // =========================================================================
  // Constants Validation
  // =========================================================================

  describe('Exported Constants', () => {
    it('LEGISLATOR_ID_MAX_LENGTH should be 20', () => {
      expect(LEGISLATOR_ID_MAX_LENGTH).toBe(20);
    });

    it('LEGISLATOR_ID_PATTERN should match valid legislator IDs', () => {
      expect(LEGISLATOR_ID_PATTERN.test('A000360')).toBe(true);
      expect(LEGISLATOR_ID_PATTERN.test('S001198')).toBe(true);
      expect(LEGISLATOR_ID_PATTERN.test('Z999999')).toBe(true);
    });

    it('LEGISLATOR_ID_PATTERN should reject invalid legislator IDs', () => {
      expect(LEGISLATOR_ID_PATTERN.test('a000360')).toBe(false); // Lowercase
      expect(LEGISLATOR_ID_PATTERN.test('AA00360')).toBe(false); // Multiple letters
      expect(LEGISLATOR_ID_PATTERN.test('A-00036')).toBe(false); // Special chars
      expect(LEGISLATOR_ID_PATTERN.test('A00036')).toBe(false); // Too short
      expect(LEGISLATOR_ID_PATTERN.test('A0003600')).toBe(false); // Too long
    });
  });
});
