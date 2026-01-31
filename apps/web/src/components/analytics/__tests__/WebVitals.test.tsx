import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WebVitals } from '../WebVitals';
import * as NextWebVitals from 'next/web-vitals';

// Mock next/web-vitals
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: vi.fn(),
}));

// Mock trackWebVitals
vi.mock('@/lib/performance', () => ({
  trackWebVitals: vi.fn(),
}));

describe('WebVitals', () => {
  it('should render without errors', () => {
    const { container } = render(<WebVitals />);
    expect(container).toBeInTheDocument();
  });

  it('should call useReportWebVitals hook', () => {
    const useReportWebVitalsSpy = vi.spyOn(NextWebVitals, 'useReportWebVitals');

    render(<WebVitals />);

    expect(useReportWebVitalsSpy).toHaveBeenCalledWith(expect.any(Function));
  });
});
