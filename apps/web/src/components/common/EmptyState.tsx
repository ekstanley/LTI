/**
 * Empty state component for when no data is available
 * @module components/common/EmptyState
 */

import { FileQuestion, Search, Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type EmptyStateVariant = 'default' | 'search' | 'filter' | 'error';

interface EmptyStateProps {
  /** Main title text */
  title?: string;
  /** Descriptive message */
  message?: string;
  /** Display variant with different default icons */
  variant?: EmptyStateVariant;
  /** Custom icon component */
  icon?: LucideIcon;
  /** Action button or custom content */
  action?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const defaultContent: Record<EmptyStateVariant, { title: string; message: string; icon: LucideIcon }> = {
  default: {
    title: 'No data found',
    message: 'There is no data to display at this time.',
    icon: Inbox,
  },
  search: {
    title: 'No results found',
    message: 'Try adjusting your search terms or filters.',
    icon: Search,
  },
  filter: {
    title: 'No matching results',
    message: 'No items match your current filters. Try adjusting or clearing filters.',
    icon: FileQuestion,
  },
  error: {
    title: 'Unable to load data',
    message: 'There was a problem loading the data. Please try again.',
    icon: FileQuestion,
  },
};

/**
 * Displays an empty state with icon, message, and optional action.
 *
 * @example
 * ```tsx
 * // Default empty state
 * <EmptyState />
 *
 * // Search variant with action
 * <EmptyState
 *   variant="search"
 *   action={<button onClick={clearSearch}>Clear Search</button>}
 * />
 *
 * // Custom content
 * <EmptyState
 *   title="No bills found"
 *   message="Start by adding your first bill."
 *   icon={PlusCircle}
 *   action={<Link href="/bills/new">Add Bill</Link>}
 * />
 * ```
 */
export function EmptyState({
  title,
  message,
  variant = 'default',
  icon,
  action,
  className,
}: EmptyStateProps) {
  const defaults = defaultContent[variant];
  const Icon = icon ?? defaults.icon;
  const displayTitle = title ?? defaults.title;
  const displayMessage = message ?? defaults.message;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center',
        className
      )}
    >
      <Icon className="h-12 w-12 text-gray-400" strokeWidth={1.5} />
      <h3 className="mt-4 text-lg font-medium text-gray-900">{displayTitle}</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{displayMessage}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
