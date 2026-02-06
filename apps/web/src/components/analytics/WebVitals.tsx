/**
 * WebVitals component for tracking Core Web Vitals metrics
 * Integrates with Next.js useReportWebVitals hook to monitor performance
 * @module WebVitals
 */

'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { trackWebVitals, type PerformanceMetric } from '@/lib/performance';

const VALID_NAMES: ReadonlySet<PerformanceMetric['name']> = new Set(['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP']);
const VALID_RATINGS: ReadonlySet<PerformanceMetric['rating']> = new Set(['good', 'needs-improvement', 'poor']);

/**
 * WebVitals Component
 * Invisible component that tracks Web Vitals metrics using Next.js hook
 * Automatically reports LCP, FID, CLS, FCP, TTFB, and INP
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // With next-web-vitals.d.ts, metric is now properly typed as web-vitals Metric
    if (!VALID_NAMES.has(metric.name as PerformanceMetric['name'])) {
      return;
    }
    if (!VALID_RATINGS.has(metric.rating as PerformanceMetric['rating'])) {
      return;
    }

    const performanceMetric: PerformanceMetric = {
      name: metric.name as PerformanceMetric['name'],
      value: metric.value,
      rating: metric.rating as PerformanceMetric['rating'],
      delta: metric.delta,
      id: metric.id,
    };

    trackWebVitals(performanceMetric);
  });

  // This component renders nothing
  return null;
}
