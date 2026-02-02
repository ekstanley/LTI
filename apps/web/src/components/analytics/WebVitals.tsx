/**
 * WebVitals component for tracking Core Web Vitals metrics
 * Integrates with Next.js useReportWebVitals hook to monitor performance
 * @module WebVitals
 */

'use client';

import { useReportWebVitals } from 'next/web-vitals';
import type { Metric } from 'web-vitals';

import { trackWebVitals, type PerformanceMetric } from '@/lib/performance';

/**
 * WebVitals Component
 * Invisible component that tracks Web Vitals metrics using Next.js hook
 * Automatically reports LCP, FID, CLS, FCP, TTFB, and INP
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Type guard to ensure metric is valid
    const isValidMetric = (m: unknown): m is Metric => {
      if (typeof m !== 'object' || m === null) return false;
      const obj = m as Record<string, unknown>;
      return (
        typeof obj.name === 'string' &&
        typeof obj.value === 'number' &&
        typeof obj.rating === 'string' &&
        typeof obj.delta === 'number' &&
        typeof obj.id === 'string'
      );
    };

    if (!isValidMetric(metric)) {
      return;
    }

    // Validate specific values
    const validNames: ReadonlyArray<PerformanceMetric['name']> = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'];
    const validRatings: ReadonlyArray<PerformanceMetric['rating']> = ['good', 'needs-improvement', 'poor'];

    // Type-safe after guard above, but ESLint can't infer this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!validNames.includes(metric.name as PerformanceMetric['name'])) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!validRatings.includes(metric.rating as PerformanceMetric['rating'])) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const performanceMetric: PerformanceMetric = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      name: metric.name as PerformanceMetric['name'],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      value: metric.value,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      rating: metric.rating as PerformanceMetric['rating'],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      delta: metric.delta,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      id: metric.id,
    };

    trackWebVitals(performanceMetric);
  });

  // This component renders nothing
  return null;
}
