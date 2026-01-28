import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'dem'
  | 'rep'
  | 'ind';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  dem: 'bg-blue-100 text-blue-800',
  rep: 'bg-red-100 text-red-800',
  ind: 'bg-purple-100 text-purple-800',
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'badge',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
