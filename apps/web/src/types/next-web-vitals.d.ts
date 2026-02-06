/**
 * Type declaration for Next.js compiled web-vitals module.
 *
 * Next.js 14 bundles web-vitals internally at `next/dist/compiled/web-vitals`
 * but ships no `.d.ts` for that path. This causes the Metric type used by
 * `useReportWebVitals` to resolve to `any`, triggering @typescript-eslint
 * no-unsafe-* rules on every property access.
 *
 * Re-exporting from the real `web-vitals` package provides proper types.
 */
declare module 'next/dist/compiled/web-vitals' {
  export type { Metric } from 'web-vitals';
}
