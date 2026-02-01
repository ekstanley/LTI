/**
 * Loading state component with multiple display variants
 * @module components/common/LoadingState
 */

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type LoadingSize = 'sm' | 'md' | 'lg';
type LoadingVariant = 'spinner' | 'dots' | 'skeleton';

interface LoadingStateProps {
  /** Loading message to display */
  message?: string;
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Visual variant */
  variant?: LoadingVariant;
  /** Additional CSS classes */
  className?: string;
  /** Whether to take full page height */
  fullPage?: boolean;
}

const sizeClasses: Record<LoadingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const textSizeClasses: Record<LoadingSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/**
 * Displays a loading indicator with optional message.
 *
 * @example
 * ```tsx
 * // Simple spinner
 * <LoadingState />
 *
 * // With message
 * <LoadingState message="Loading bills..." size="lg" />
 *
 * // Full page loading
 * <LoadingState fullPage message="Loading..." />
 * ```
 */
export function LoadingState({
  message,
  size = 'md',
  variant = 'spinner',
  className,
  fullPage = false,
}: LoadingStateProps) {
  const containerClasses = cn(
    'flex flex-col items-center justify-center',
    fullPage ? 'min-h-[50vh]' : 'py-8',
    className
  );

  return (
    <div className={containerClasses} role="status" aria-label={message ?? 'Loading'}>
      {variant === 'spinner' && (
        <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size])} />
      )}
      {variant === 'dots' && <LoadingDots size={size} />}
      {message && (
        <p className={cn('mt-3 text-gray-500', textSizeClasses[size])}>{message}</p>
      )}
    </div>
  );
}

interface LoadingDotsProps {
  size?: LoadingSize;
}

function LoadingDots({ size = 'md' }: LoadingDotsProps) {
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2';
  const gap = size === 'sm' ? 'gap-1' : size === 'lg' ? 'gap-2' : 'gap-1.5';

  return (
    <div className={cn('flex', gap)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full bg-blue-600',
            dotSize,
            'animate-bounce'
          )}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Inline loading indicator for buttons or compact spaces
 */
export function LoadingInline({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-4 w-4 animate-spin', className)}
      aria-label="Loading"
    />
  );
}
