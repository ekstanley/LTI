/**
 * Tests for Pagination component
 * @module components/common/Pagination.test
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Pagination, SimplePagination } from './Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    totalItems: 100,
    pageSize: 10,
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders pagination navigation', () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    it('displays current page and total pages', () => {
      render(<Pagination {...defaultProps} />);
      // Numbers appear in multiple places (item count and page display)
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    });

    it('displays item count when showItemCount is true', () => {
      render(<Pagination {...defaultProps} showItemCount />);
      // Text is split across elements, use regex matcher
      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
      // Numbers appear in item count area
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
    });

    it('returns null when totalPages <= 1 and showItemCount is false', () => {
      const { container } = render(
        <Pagination {...defaultProps} totalPages={1} showItemCount={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('shows first/last buttons when showFirstLast is true', () => {
      render(<Pagination {...defaultProps} showFirstLast />);
      expect(screen.getByLabelText('Go to first page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to last page')).toBeInTheDocument();
    });

    it('hides first/last buttons when showFirstLast is false', () => {
      render(<Pagination {...defaultProps} showFirstLast={false} />);
      expect(screen.queryByLabelText('Go to first page')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Go to last page')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('disables previous button on first page', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);
      expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<Pagination {...defaultProps} currentPage={10} />);
      expect(screen.getByLabelText('Go to next page')).toBeDisabled();
    });

    it('enables previous button when not on first page', () => {
      render(<Pagination {...defaultProps} currentPage={5} />);
      expect(screen.getByLabelText('Go to previous page')).not.toBeDisabled();
    });

    it('enables next button when not on last page', () => {
      render(<Pagination {...defaultProps} currentPage={5} />);
      expect(screen.getByLabelText('Go to next page')).not.toBeDisabled();
    });

    it('calls onPageChange with previous page when clicking previous', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);
      fireEvent.click(screen.getByLabelText('Go to previous page'));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('calls onPageChange with next page when clicking next', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);
      fireEvent.click(screen.getByLabelText('Go to next page'));
      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it('calls onPageChange with 1 when clicking first', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);
      fireEvent.click(screen.getByLabelText('Go to first page'));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('calls onPageChange with totalPages when clicking last', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);
      fireEvent.click(screen.getByLabelText('Go to last page'));
      expect(onPageChange).toHaveBeenCalledWith(10);
    });
  });

  describe('disabled state', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(<Pagination {...defaultProps} currentPage={5} disabled />);
      expect(screen.getByLabelText('Go to first page')).toBeDisabled();
      expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
      expect(screen.getByLabelText('Go to next page')).toBeDisabled();
      expect(screen.getByLabelText('Go to last page')).toBeDisabled();
    });

    it('does not call onPageChange when disabled', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} disabled onPageChange={onPageChange} />);
      fireEvent.click(screen.getByLabelText('Go to next page'));
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('item count calculation', () => {
    it('calculates correct start and end items for first page', () => {
      render(<Pagination {...defaultProps} currentPage={1} pageSize={20} totalItems={100} showItemCount />);
      // '1' appears multiple times (page number and item start)
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('calculates correct start and end items for middle page', () => {
      render(<Pagination {...defaultProps} currentPage={3} pageSize={10} totalItems={100} showItemCount />);
      expect(screen.getByText('21')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('calculates correct end item for last page with partial results', () => {
      render(<Pagination {...defaultProps} currentPage={5} pageSize={10} totalItems={45} totalPages={5} showItemCount />);
      expect(screen.getByText('41')).toBeInTheDocument();
      // '45' appears twice (end item and total items)
      expect(screen.getAllByText('45').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('SimplePagination', () => {
  const defaultProps = {
    hasMore: true,
    hasPrevious: true,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders previous and next buttons', () => {
    render(<SimplePagination {...defaultProps} />);
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  it('disables previous button when hasPrevious is false', () => {
    render(<SimplePagination {...defaultProps} hasPrevious={false} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables next button when hasMore is false', () => {
    render(<SimplePagination {...defaultProps} hasMore={false} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('calls onPrevious when clicking previous', () => {
    const onPrevious = vi.fn();
    render(<SimplePagination {...defaultProps} onPrevious={onPrevious} />);
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPrevious).toHaveBeenCalled();
  });

  it('calls onNext when clicking next', () => {
    const onNext = vi.fn();
    render(<SimplePagination {...defaultProps} onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onNext).toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<SimplePagination {...defaultProps} disabled />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });
});
