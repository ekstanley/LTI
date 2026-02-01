import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { trackWebVitals, checkPerformanceBudget, type PerformanceMetric } from '../performance';

describe('Performance Tracking', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  describe('trackWebVitals', () => {
    it('should log metrics in development mode', () => {
      process.env.NODE_ENV = 'development';

      const metric: PerformanceMetric = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'v1-1234',
      };

      trackWebVitals(metric);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] LCP: 2000.00ms (good)')
      );
    });

    it('should not log metrics in production mode', () => {
      process.env.NODE_ENV = 'production';

      const metric: PerformanceMetric = {
        name: 'FID',
        value: 50,
        rating: 'good',
        delta: 50,
        id: 'v1-5678',
      };

      trackWebVitals(metric);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle CLS metric without ms unit', () => {
      process.env.NODE_ENV = 'development';

      const metric: PerformanceMetric = {
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'v1-9012',
      };

      trackWebVitals(metric);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] CLS: 0.05 (good)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('ms')
      );
    });

    it('should track all Core Web Vitals metrics', () => {
      process.env.NODE_ENV = 'development';

      const metrics: PerformanceMetric[] = [
        { name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'v1-1' },
        { name: 'FID', value: 50, rating: 'good', delta: 50, id: 'v1-2' },
        { name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'v1-3' },
        { name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'v1-4' },
        { name: 'TTFB', value: 500, rating: 'good', delta: 500, id: 'v1-5' },
        { name: 'INP', value: 150, rating: 'good', delta: 150, id: 'v1-6' },
      ];

      metrics.forEach(trackWebVitals);

      expect(consoleLogSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe('checkPerformanceBudget', () => {
    it('should warn when LCP exceeds budget (2500ms)', () => {
      const metric: PerformanceMetric = {
        name: 'LCP',
        value: 3000,
        rating: 'needs-improvement',
        delta: 3000,
        id: 'v1-1234',
      };

      checkPerformanceBudget(metric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Performance budget exceeded for LCP')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('3000.00ms (budget: 2500ms)')
      );
    });

    it('should warn when FID exceeds budget (100ms)', () => {
      const metric: PerformanceMetric = {
        name: 'FID',
        value: 150,
        rating: 'needs-improvement',
        delta: 150,
        id: 'v1-5678',
      };

      checkPerformanceBudget(metric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Performance budget exceeded for FID')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('150.00ms (budget: 100ms)')
      );
    });

    it('should warn when CLS exceeds budget (0.1)', () => {
      const metric: PerformanceMetric = {
        name: 'CLS',
        value: 0.25,
        rating: 'poor',
        delta: 0.25,
        id: 'v1-9012',
      };

      checkPerformanceBudget(metric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Performance budget exceeded for CLS')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('0.25 (budget: 0.1)')
      );
    });

    it('should not warn when metrics are within budget', () => {
      const metrics: PerformanceMetric[] = [
        { name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'v1-1' },
        { name: 'FID', value: 50, rating: 'good', delta: 50, id: 'v1-2' },
        { name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'v1-3' },
        { name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'v1-4' },
        { name: 'TTFB', value: 500, rating: 'good', delta: 500, id: 'v1-5' },
        { name: 'INP', value: 150, rating: 'good', delta: 150, id: 'v1-6' },
      ];

      metrics.forEach(checkPerformanceBudget);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when FCP exceeds budget (1800ms)', () => {
      const metric: PerformanceMetric = {
        name: 'FCP',
        value: 2000,
        rating: 'needs-improvement',
        delta: 2000,
        id: 'v1-1234',
      };

      checkPerformanceBudget(metric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Performance budget exceeded for FCP')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('2000.00ms (budget: 1800ms)')
      );
    });

    it('should warn when TTFB exceeds budget (800ms)', () => {
      const metric: PerformanceMetric = {
        name: 'TTFB',
        value: 1000,
        rating: 'needs-improvement',
        delta: 1000,
        id: 'v1-5678',
      };

      checkPerformanceBudget(metric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Performance budget exceeded for TTFB')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1000.00ms (budget: 800ms)')
      );
    });
  });
});
