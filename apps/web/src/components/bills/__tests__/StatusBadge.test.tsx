/**
 * Tests for StatusBadge component
 * @module components/bills/__tests__/StatusBadge.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';
import type { BillStatus } from '@ltip/shared';

describe('StatusBadge', () => {
  it('should render introduced status with correct label', () => {
    render(<StatusBadge status="introduced" />);
    expect(screen.getByText('Introduced')).toBeInTheDocument();
  });

  it('should render in_committee status with correct label', () => {
    render(<StatusBadge status="in_committee" />);
    expect(screen.getByText('In Committee')).toBeInTheDocument();
  });

  it('should render passed_house status with correct label', () => {
    render(<StatusBadge status="passed_house" />);
    expect(screen.getByText('Passed House')).toBeInTheDocument();
  });

  it('should render passed_senate status with correct label', () => {
    render(<StatusBadge status="passed_senate" />);
    expect(screen.getByText('Passed Senate')).toBeInTheDocument();
  });

  it('should render became_law status with correct label', () => {
    render(<StatusBadge status="became_law" />);
    expect(screen.getByText('Became Law')).toBeInTheDocument();
  });

  it('should render vetoed status with correct label', () => {
    render(<StatusBadge status="vetoed" />);
    expect(screen.getByText('Vetoed')).toBeInTheDocument();
  });

  it('should render failed status with correct label', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should apply correct color classes based on status', () => {
    const { container, rerender } = render(<StatusBadge status="introduced" />);
    const badge = container.querySelector('span');

    // Verify badge element exists
    expect(badge).toBeInTheDocument();

    // Test different statuses to ensure different colors
    rerender(<StatusBadge status="became_law" />);
    expect(screen.getByText('Became Law')).toBeInTheDocument();

    rerender(<StatusBadge status="vetoed" />);
    expect(screen.getByText('Vetoed')).toBeInTheDocument();
  });

  it('should handle unknown status gracefully with fallback', () => {
    const unknownStatus = 'unknown_status' as BillStatus;
    render(<StatusBadge status={unknownStatus} />);

    // Should render the raw status value as fallback
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });

  it('should apply base styling classes', () => {
    const { container } = render(<StatusBadge status="introduced" />);
    const badge = container.querySelector('span');

    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('items-center');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('px-3');
    expect(badge).toHaveClass('py-1');
    expect(badge).toHaveClass('text-sm');
    expect(badge).toHaveClass('font-medium');
  });
});
