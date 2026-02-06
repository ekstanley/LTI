/**
 * Tests for BillFormatters utility
 * @module components/bills/__tests__/BillFormatters.test
 */

import { describe, it, expect } from 'vitest';
import { formatBillId } from '../BillFormatters';
import { createMockBill } from '@/__tests__/helpers/factories';
import type { BillType } from '@ltip/shared';

describe('formatBillId', () => {
  const billTypeExpectations: Array<[BillType, string]> = [
    ['hr', 'H.R.'],
    ['s', 'S.'],
    ['hjres', 'H.J.Res.'],
    ['sjres', 'S.J.Res.'],
    ['hconres', 'H.Con.Res.'],
    ['sconres', 'S.Con.Res.'],
    ['hres', 'H.Res.'],
    ['sres', 'S.Res.'],
  ];

  it.each(billTypeExpectations)(
    'should format bill type "%s" as "%s"',
    (billType, expectedPrefix) => {
      const bill = createMockBill({ billType, billNumber: 42 });
      expect(formatBillId(bill)).toBe(`${expectedPrefix} 42`);
    }
  );

  it('should format H.R. 1 correctly', () => {
    const bill = createMockBill({ billType: 'hr', billNumber: 1 });
    expect(formatBillId(bill)).toBe('H.R. 1');
  });

  it('should format S.J.Res. 42 correctly', () => {
    const bill = createMockBill({ billType: 'sjres', billNumber: 42 });
    expect(formatBillId(bill)).toBe('S.J.Res. 42');
  });
});
