/**
 * Web Vitals performance tracking utilities
 * Monitors Core Web Vitals metrics and enforces performance budgets
 * @module performance
 */

export interface PerformanceMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

/**
 * Performance budgets (based on Core Web Vitals thresholds)
 * Values align with Google's recommended targets for good user experience
 */
const PERFORMANCE_BUDGETS: Record<string, number> = {
  LCP: 2500,  // Largest Contentful Paint (ms)
  FID: 100,   // First Input Delay (ms)
  CLS: 0.1,   // Cumulative Layout Shift (score)
  FCP: 1800,  // First Contentful Paint (ms)
  TTFB: 800,  // Time to First Byte (ms)
  INP: 200,   // Interaction to Next Paint (ms)
};

/**
 * Track Web Vitals metrics
 * Logs to console in development, sends to analytics in production
 * @param metric - The performance metric to track
 */
export function trackWebVitals(metric: PerformanceMetric): void {
  const { name, value, rating } = metric;

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    const unit = name === 'CLS' ? '' : 'ms';
    console.log(
      `[Performance] ${name}: ${value.toFixed(2)}${unit} (${rating})`
    );
  }

  // Check performance budget
  checkPerformanceBudget(metric);

  // In production, send to analytics service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with analytics service (e.g., Vercel Analytics, Google Analytics)
    // Example: sendToAnalytics({ metric: name, value, rating });
  }
}

/**
 * Check if metric exceeds performance budget
 * Warns when budgets are exceeded to help identify performance regressions
 * @param metric - The performance metric to check
 */
export function checkPerformanceBudget(metric: PerformanceMetric): void {
  const budget = PERFORMANCE_BUDGETS[metric.name];

  if (budget && metric.value > budget) {
    const unit = metric.name === 'CLS' ? '' : 'ms';
    console.warn(
      `[Performance] Performance budget exceeded for ${metric.name}: ` +
      `${metric.value.toFixed(2)}${unit} ` +
      `(budget: ${budget}${unit})`
    );
  }
}
