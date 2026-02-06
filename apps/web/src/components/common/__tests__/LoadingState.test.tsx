/**
 * Tests for LoadingState component
 * @module components/common/__tests__/LoadingState
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LoadingState, LoadingInline } from '../LoadingState';

describe('LoadingState', () => {
  it('should render with role="status"', () => {
    render(<LoadingState />);

    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toBeInTheDocument();
  });

  it('should have correct aria-label (defaults to "Loading")', () => {
    render(<LoadingState />);

    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toHaveAttribute('aria-label', 'Loading');
  });

  it('should render custom message in aria-label and as text', () => {
    const message = 'Loading bills...';
    render(<LoadingState message={message} />);

    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toHaveAttribute('aria-label', message);

    const messageText = screen.getByText(message);
    expect(messageText).toBeInTheDocument();
    expect(messageText.tagName).toBe('P');
  });

  it('should render spinner variant with Loader2 icon', () => {
    const { container } = render(<LoadingState variant="spinner" />);

    // Spinner variant should render Loader2 icon with animate-spin class
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('text-blue-600');
  });

  it('should render dots variant with 3 bouncing dots', () => {
    const { container } = render(<LoadingState variant="dots" />);

    // Dots variant renders 3 div elements with animate-bounce
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);

    // Each dot should have proper styling
    dots.forEach(dot => {
      expect(dot).toHaveClass('rounded-full', 'bg-blue-600');
    });
  });

  it('should add min-h-[50vh] class when fullPage prop is true', () => {
    const { container } = render(<LoadingState fullPage />);

    const loadingContainer = container.firstChild as HTMLElement;
    expect(loadingContainer).toHaveClass('min-h-[50vh]');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-loading-class';
    const { container } = render(<LoadingState className={customClass} />);

    const loadingContainer = container.firstChild as HTMLElement;
    expect(loadingContainer).toHaveClass(customClass);
  });

  it('should render LoadingInline with aria-label', () => {
    render(<LoadingInline />);

    // LoadingInline renders Loader2 with aria-label
    const inlineLoader = screen.getByLabelText('Loading');
    expect(inlineLoader).toBeInTheDocument();
  });
});
