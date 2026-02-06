/**
 * Tests for BiasSpectrum component
 * @module components/bills/__tests__/BiasSpectrum.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock @ltip/shared before importing the component
vi.mock('@ltip/shared', () => ({
  getBiasLabel: (score: number) => {
    if (score < -0.3) return 'Leans Left';
    if (score > 0.3) return 'Leans Right';
    return 'Centrist';
  },
  getBiasColor: (score: number) => {
    if (score < -0.3) return 'text-blue-600';
    if (score > 0.3) return 'text-red-600';
    return 'text-gray-600';
  },
}));

import { BiasSpectrum } from '../BiasSpectrum';

describe('BiasSpectrum', () => {
  describe('position calculation', () => {
    it('should position indicator at 0% for score -1', () => {
      const { container } = render(
        <BiasSpectrum score={-1} confidence={0.9} />
      );
      const indicator = container.querySelector('[style*="left"]');
      expect(indicator).toHaveStyle({ left: '0%' });
    });

    it('should position indicator at 50% for score 0', () => {
      const { container } = render(
        <BiasSpectrum score={0} confidence={0.9} />
      );
      const indicator = container.querySelector('[style*="left"]');
      expect(indicator).toHaveStyle({ left: '50%' });
    });

    it('should position indicator at 100% for score +1', () => {
      const { container } = render(
        <BiasSpectrum score={1} confidence={0.9} />
      );
      const indicator = container.querySelector('[style*="left"]');
      expect(indicator).toHaveStyle({ left: '100%' });
    });

    it('should position indicator at 25% for score -0.5', () => {
      const { container } = render(
        <BiasSpectrum score={-0.5} confidence={0.9} />
      );
      const indicator = container.querySelector('[style*="left"]');
      expect(indicator).toHaveStyle({ left: '25%' });
    });
  });

  describe('label display', () => {
    it('should show bias label and confidence when showLabel is true (default)', () => {
      render(<BiasSpectrum score={-0.5} confidence={0.85} />);
      // Bias label is distinct from scale labels (uses unique mock return values)
      expect(screen.getByText('Leans Left')).toBeInTheDocument();
      expect(screen.getByText('85% confidence')).toBeInTheDocument();
    });

    it('should hide bias label and confidence when showLabel is false', () => {
      render(<BiasSpectrum score={-0.5} confidence={0.85} showLabel={false} />);
      expect(screen.queryByText('Leans Left')).not.toBeInTheDocument();
      expect(screen.queryByText('85% confidence')).not.toBeInTheDocument();
    });

    it('should round confidence to nearest integer', () => {
      render(<BiasSpectrum score={0} confidence={0.756} />);
      expect(screen.getByText('76% confidence')).toBeInTheDocument();
    });
  });

  describe('scale labels', () => {
    it('should always display Left, Center, Right scale labels', () => {
      render(<BiasSpectrum score={0} confidence={0.5} showLabel={false} />);
      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Center')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
    });

    it('should show scale labels even when showLabel hides bias label', () => {
      render(<BiasSpectrum score={-0.5} confidence={0.5} showLabel={false} />);
      // Scale labels persist regardless of showLabel
      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('should apply sm size classes', () => {
      const { container } = render(
        <BiasSpectrum score={0} confidence={0.5} size="sm" />
      );
      const bar = container.querySelector('.h-1\\.5');
      const indicator = container.querySelector('.h-3');
      expect(bar).toBeInTheDocument();
      expect(indicator).toBeInTheDocument();
    });

    it('should apply md size classes (default)', () => {
      const { container } = render(
        <BiasSpectrum score={0} confidence={0.5} />
      );
      const bar = container.querySelector('.h-2');
      expect(bar).toBeInTheDocument();
    });

    it('should apply lg size classes', () => {
      const { container } = render(
        <BiasSpectrum score={0} confidence={0.5} size="lg" />
      );
      const bar = container.querySelector('.h-3');
      expect(bar).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('should apply custom className to root element', () => {
      const { container } = render(
        <BiasSpectrum score={0} confidence={0.5} className="my-custom-class" />
      );
      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});
