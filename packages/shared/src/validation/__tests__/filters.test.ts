/**
 * Tests for filter validation schemas
 *
 * @module validation/__tests__/filters.test
 */

import { describe, it, expect } from 'vitest';
import {
  billFilterSchema,
  voteFilterSchema,
  legislatorFilterSchema,
  type BillFilterInput,
  type VoteFilterInput,
  type LegislatorFilterInput,
} from '../filters';

describe('billFilterSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid filter with all fields', () => {
      const input: BillFilterInput = {
        search: 'infrastructure',
        congress: 119,
        chamber: 'house',
        status: 'passed_house',
        billType: 'hr',
        limit: 20,
        offset: 0,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty filter (all optional)', () => {
      const input = {};

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial filter with just search', () => {
      const input: Partial<BillFilterInput> = {
        search: 'healthcare',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should trim search string', () => {
      const input: Partial<BillFilterInput> = {
        search: '  infrastructure  ',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('infrastructure');
      }
    });

    it('should apply default values for limit and offset', () => {
      const input = {};

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject search longer than 200 characters', () => {
      const input: Partial<BillFilterInput> = {
        search: 'a'.repeat(201),
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.search).toBeDefined();
      }
    });

    it('should reject empty search string', () => {
      const input: Partial<BillFilterInput> = {
        search: '',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.search).toBeDefined();
      }
    });

    it('should reject congress less than 1', () => {
      const input: Partial<BillFilterInput> = {
        congress: 0,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.congress).toBeDefined();
      }
    });

    it('should reject congress greater than 200', () => {
      const input: Partial<BillFilterInput> = {
        congress: 201,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.congress).toBeDefined();
      }
    });

    it('should reject non-integer congress', () => {
      const input = {
        congress: 119.5,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.congress).toBeDefined();
      }
    });

    it('should reject invalid chamber', () => {
      const input = {
        chamber: 'invalid',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.chamber).toBeDefined();
      }
    });

    it('should reject invalid status', () => {
      const input = {
        status: 'invalid',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.status).toBeDefined();
      }
    });

    it('should reject invalid bill type', () => {
      const input = {
        billType: 'invalid',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.billType).toBeDefined();
      }
    });

    it('should reject limit less than 1', () => {
      const input: Partial<BillFilterInput> = {
        limit: 0,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.limit).toBeDefined();
      }
    });

    it('should reject limit greater than 100', () => {
      const input: Partial<BillFilterInput> = {
        limit: 101,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.limit).toBeDefined();
      }
    });

    it('should reject negative offset', () => {
      const input: Partial<BillFilterInput> = {
        offset: -1,
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.offset).toBeDefined();
      }
    });

    it('should reject extra fields (strict mode)', () => {
      const input = {
        search: 'test',
        extraField: 'invalid',
      };

      const result = billFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('voteFilterSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid filter with all fields', () => {
      const input: VoteFilterInput = {
        chamber: 'senate',
        result: 'passed',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        billId: 'hr-1234-119',
        limit: 20,
        offset: 0,
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty filter (all optional)', () => {
      const input = {};

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial filter with just chamber', () => {
      const input: Partial<VoteFilterInput> = {
        chamber: 'house',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid date range', () => {
      const input: Partial<VoteFilterInput> = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-06-30T23:59:59Z',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid chamber', () => {
      const input = {
        chamber: 'invalid',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.chamber).toBeDefined();
      }
    });

    it('should reject invalid result', () => {
      const input = {
        result: 'invalid',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.result).toBeDefined();
      }
    });

    it('should reject invalid date format', () => {
      const input = {
        startDate: '2024-01-01',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.startDate).toBeDefined();
      }
    });

    it('should reject end date before start date', () => {
      const input: Partial<VoteFilterInput> = {
        startDate: '2024-12-31T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.endDate).toBeDefined();
      }
    });

    it('should reject invalid bill ID format', () => {
      const input = {
        billId: 'invalid-bill-id',
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.billId).toBeDefined();
      }
    });

    it('should reject bill ID longer than 50 characters', () => {
      const input = {
        billId: 'a'.repeat(51),
      };

      const result = voteFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.billId).toBeDefined();
      }
    });
  });
});

describe('legislatorFilterSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid filter with all fields', () => {
      const input: LegislatorFilterInput = {
        search: 'Smith',
        state: 'CA',
        chamber: 'senate',
        party: 'D',
        limit: 20,
        offset: 0,
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty filter (all optional)', () => {
      const input = {};

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should trim search string', () => {
      const input: Partial<LegislatorFilterInput> = {
        search: '  Smith  ',
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('Smith');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject search longer than 200 characters', () => {
      const input: Partial<LegislatorFilterInput> = {
        search: 'a'.repeat(201),
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.search).toBeDefined();
      }
    });

    it('should reject empty search string', () => {
      const input: Partial<LegislatorFilterInput> = {
        search: '',
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.search).toBeDefined();
      }
    });

    it('should reject state code not exactly 2 characters', () => {
      const input = {
        state: 'CAL',
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.state).toBeDefined();
      }
    });

    it('should reject lowercase state code', () => {
      const input = {
        state: 'ca',
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.state).toBeDefined();
      }
    });

    it('should reject invalid party', () => {
      const input = {
        party: 'X',
      };

      const result = legislatorFilterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.party).toBeDefined();
      }
    });
  });
});
