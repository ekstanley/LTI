/**
 * Tests for EmptyState component
 * @module components/common/__tests__/EmptyState
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('should render default variant with correct title and message', () => {
    render(<EmptyState />);

    const title = screen.getByRole('heading', { name: /no data found/i });
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H3');

    const message = screen.getByText(/there is no data to display at this time/i);
    expect(message).toBeInTheDocument();
    expect(message.tagName).toBe('P');
  });

  it('should render search variant with correct title and message', () => {
    render(<EmptyState variant="search" />);

    const title = screen.getByRole('heading', { name: /no results found/i });
    expect(title).toBeInTheDocument();

    const message = screen.getByText(/try adjusting your search terms or filters/i);
    expect(message).toBeInTheDocument();
  });

  it('should render filter variant with correct title and message', () => {
    render(<EmptyState variant="filter" />);

    const title = screen.getByRole('heading', { name: /no matching results/i });
    expect(title).toBeInTheDocument();

    const message = screen.getByText(/no items match your current filters/i);
    expect(message).toBeInTheDocument();
  });

  it('should render error variant with correct title and message', () => {
    render(<EmptyState variant="error" />);

    const title = screen.getByRole('heading', { name: /unable to load data/i });
    expect(title).toBeInTheDocument();

    const message = screen.getByText(/there was a problem loading the data/i);
    expect(message).toBeInTheDocument();
  });

  it('should override default title with custom title', () => {
    const customTitle = 'Custom Empty Title';
    render(<EmptyState title={customTitle} />);

    const title = screen.getByRole('heading', { name: customTitle });
    expect(title).toBeInTheDocument();

    // Default title should not be present
    expect(screen.queryByRole('heading', { name: /no data found/i })).not.toBeInTheDocument();
  });

  it('should override default message with custom message', () => {
    const customMessage = 'This is a custom message for empty state.';
    render(<EmptyState message={customMessage} />);

    const message = screen.getByText(customMessage);
    expect(message).toBeInTheDocument();

    // Default message should not be present
    expect(screen.queryByText(/there is no data to display at this time/i)).not.toBeInTheDocument();
  });

  it('should render action only when provided', () => {
    const actionText = 'Clear Filters';
    const { rerender } = render(<EmptyState />);

    // No action initially
    expect(screen.queryByText(actionText)).not.toBeInTheDocument();

    // Render with action
    rerender(
      <EmptyState action={<button>{actionText}</button>} />
    );

    const actionButton = screen.getByRole('button', { name: actionText });
    expect(actionButton).toBeInTheDocument();
  });

  it('should always render icon, title (h3), and message (p)', () => {
    const { container } = render(<EmptyState variant="search" />);

    // Icon should be rendered (lucide-react SVG)
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveClass('h-12', 'w-12', 'text-gray-400');

    // Title should be h3
    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toBeInTheDocument();
    expect(title.textContent).toBe('No results found');

    // Message should be p
    const message = screen.getByText(/try adjusting your search terms/i);
    expect(message).toBeInTheDocument();
    expect(message.tagName).toBe('P');
  });
});
