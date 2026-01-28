'use client';

import { cn } from '@/lib/utils';
import { getBiasLabel, getBiasColor } from '@ltip/shared';

interface BiasSpectrumProps {
  score: number; // -1 (left) to +1 (right)
  confidence: number; // 0 to 1
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

const indicatorSizeStyles = {
  sm: 'h-3 w-0.5',
  md: 'h-4 w-1',
  lg: 'h-5 w-1.5',
};

export function BiasSpectrum({
  score,
  confidence,
  showLabel = true,
  size = 'md',
  className,
}: BiasSpectrumProps) {
  // Convert score from [-1, 1] to [0, 100] for positioning
  const position = ((score + 1) / 2) * 100;
  const label = getBiasLabel(score);
  const colorClass = getBiasColor(score);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className={cn('font-medium', colorClass)}>{label}</span>
          <span className="text-gray-500">
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>
      )}
      <div className="relative">
        {/* Background gradient bar */}
        <div
          className={cn(
            'w-full rounded-full bg-gradient-to-r from-blue-600 via-gray-400 to-red-600',
            sizeStyles[size]
          )}
        />
        {/* Position indicator */}
        <div
          className={cn(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900 ring-2 ring-white',
            indicatorSizeStyles[size]
          )}
          style={{ left: `${position}%` }}
        />
      </div>
      {/* Scale labels */}
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </div>
  );
}
