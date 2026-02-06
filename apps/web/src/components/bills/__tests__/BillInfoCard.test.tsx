/**
 * Tests for BillInfoCard component
 * @module components/bills/__tests__/BillInfoCard.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { BillInfoCard } from '../BillInfoCard';
import type { LucideProps } from 'lucide-react';

// Minimal mock icon component matching LucideIcon signature (ForwardRefExoticComponent)
const MockIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
  <svg data-testid="mock-icon" ref={ref} {...props} />
));
MockIcon.displayName = 'MockIcon';

describe('BillInfoCard', () => {
  it('should render the label text', () => {
    render(
      <BillInfoCard icon={MockIcon} label="Introduced">
        January 3, 2023
      </BillInfoCard>
    );
    expect(screen.getByText('Introduced')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <BillInfoCard icon={MockIcon} label="Status">
        In Committee
      </BillInfoCard>
    );
    expect(screen.getByText('In Committee')).toBeInTheDocument();
  });

  it('should render the icon component', () => {
    render(
      <BillInfoCard icon={MockIcon} label="Chamber">
        House
      </BillInfoCard>
    );
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('should pass h-4 w-4 className to icon', () => {
    render(
      <BillInfoCard icon={MockIcon} label="Sponsor">
        Rep. Smith
      </BillInfoCard>
    );
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveClass('h-4', 'w-4');
  });

  it('should render children in the gray-900 content container', () => {
    const { container } = render(
      <BillInfoCard icon={MockIcon} label="Policy Area">
        <span data-testid="child-content">Economics</span>
      </BillInfoCard>
    );
    const contentDiv = container.querySelector('.text-gray-900');
    expect(contentDiv).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
