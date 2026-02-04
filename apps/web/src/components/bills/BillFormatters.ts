/**
 * Utility functions for formatting bill data
 * @module components/bills/BillFormatters
 */

import type { Bill, BillType } from '@ltip/shared';

/**
 * Type labels for bill types (e.g., "H.R.", "S.")
 */
const BILL_TYPE_LABELS: Record<BillType, string> = {
  hr: 'H.R.',
  s: 'S.',
  hjres: 'H.J.Res.',
  sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.',
  sconres: 'S.Con.Res.',
  hres: 'H.Res.',
  sres: 'S.Res.',
};

/**
 * Format a bill ID for display.
 *
 * @param bill - The bill object containing billType and billNumber
 * @returns Formatted bill ID (e.g., "H.R. 1", "S. 123")
 *
 * @example
 * ```ts
 * formatBillId(bill) // "H.R. 1"
 * ```
 */
export function formatBillId(bill: Bill): string {
  return `${BILL_TYPE_LABELS[bill.billType]} ${bill.billNumber}`;
}
