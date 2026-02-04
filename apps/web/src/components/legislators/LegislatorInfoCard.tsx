/**
 * Info card component for displaying legislator metadata
 * @module components/legislators/LegislatorInfoCard
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Props for LegislatorInfoCard component
 */
export interface LegislatorInfoCardProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Label text for the card */
  label: string;
  /** Content to display in the card */
  children: React.ReactNode;
}

/**
 * Info card component that displays legislator metadata with an icon and label.
 *
 * @example
 * ```tsx
 * <LegislatorInfoCard icon={Building2} label="Chamber">
 *   House of Representatives
 * </LegislatorInfoCard>
 * ```
 */
export function LegislatorInfoCard({ icon: Icon, label, children }: LegislatorInfoCardProps) {
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
