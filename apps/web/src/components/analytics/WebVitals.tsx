/**
 * WebVitals component for tracking Core Web Vitals metrics
 * Integrates with Next.js useReportWebVitals hook to monitor performance
 * @module WebVitals
 */

'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { trackWebVitals, type PerformanceMetric } from '@/lib/performance';

/**
 * WebVitals Component
 * Invisible component that tracks Web Vitals metrics using Next.js hook
 * Automatically reports LCP, FID, CLS, FCP, TTFB, and INP
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Convert Next.js metric to our PerformanceMetric type
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
