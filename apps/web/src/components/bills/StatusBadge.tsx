/**
 * Status badge component for displaying bill status
 * @module components/bills/StatusBadge
 */

import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from '@ltip/shared';
import type { BillStatus } from '@ltip/shared';

/**
 * Props for StatusBadge component
 */
export interface StatusBadgeProps {
  /** Current status of the bill */
  status: BillStatus;
}

/**
 * Status badge component that displays a color-coded pill with the bill's current status.
 *
 * @example
 * ```tsx
 * <StatusBadge status="introduced" />
 * ```
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const label = BILL_STATUS_LABELS[status] ?? status;
  const colors = BILL_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
