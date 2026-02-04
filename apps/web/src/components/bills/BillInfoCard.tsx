/**
 * Info card component for displaying bill metadata
 * @module components/bills/BillInfoCard
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Props for BillInfoCard component
 */
export interface BillInfoCardProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Label text for the card */
  label: string;
  /** Content to display in the card */
  children: React.ReactNode;
}

/**
 * Info card component that displays bill metadata with an icon and label.
 *
 * @example
 * ```tsx
 * <BillInfoCard icon={Calendar} label="Introduced">
 *   January 3, 2023
 * </BillInfoCard>
 * ```
 */
export function BillInfoCard({ icon: Icon, label, children }: BillInfoCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="text-gray-900">{children}</div>
    </div>
  );
}
