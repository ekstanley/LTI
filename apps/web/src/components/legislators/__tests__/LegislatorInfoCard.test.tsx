/**
 * Tests for LegislatorInfoCard component
 * @module components/legislators/__tests__/LegislatorInfoCard.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { LegislatorInfoCard } from '../LegislatorInfoCard';
import type { LucideProps } from 'lucide-react';

// Minimal mock icon component matching LucideIcon signature (ForwardRefExoticComponent)
const MockIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
  <svg data-testid="mock-icon" ref={ref} {...props} />
));
MockIcon.displayName = 'MockIcon';

describe('LegislatorInfoCard', () => {
  it('should render the label text', () => {
    render(
      <LegislatorInfoCard icon={MockIcon} label="Chamber">
        House of Representatives
      </LegislatorInfoCard>
    );
    expect(screen.getByText('Chamber')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <LegislatorInfoCard icon={MockIcon} label="Party">
        Democrat
      </LegislatorInfoCard>
    );
    expect(screen.getByText('Democrat')).toBeInTheDocument();
  });

  it('should render the icon component', () => {
    render(
      <LegislatorInfoCard icon={MockIcon} label="State">
        California
      </LegislatorInfoCard>
    );
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('should pass h-4 w-4 className to icon', () => {
    render(
      <LegislatorInfoCard icon={MockIcon} label="District">
        12th
      </LegislatorInfoCard>
    );
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveClass('h-4', 'w-4');
  });

  it('should render children in the gray-900 content container', () => {
    const { container } = render(
      <LegislatorInfoCard icon={MockIcon} label="Term Start">
        <span data-testid="child-content">January 3, 2023</span>
      </LegislatorInfoCard>
    );
    const contentDiv = container.querySelector('.text-gray-900');
    expect(contentDiv).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
