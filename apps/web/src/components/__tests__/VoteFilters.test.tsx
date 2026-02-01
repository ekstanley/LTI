/**
 * Tests for VoteFilters component
 *
 * @module components/__tests__/VoteFilters.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoteFilters } from '../VoteFilters';
import type { VoteFilters as VoteFiltersType } from '../VoteFilters';

describe('VoteFilters', () => {
  const mockFilters: VoteFiltersType = {
    chamber: '',
    result: '',
  };

  const mockOnChange = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render chamber select', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      expect(chamberSelect).toBeInTheDocument();
    });

    it('should render result select', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const resultSelect = screen.getByLabelText(/filter by result/i);
      expect(resultSelect).toBeInTheDocument();
    });

    it('should not render clear button when no filters active', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.queryByRole('button', { name: /clear all filters/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should render clear button when filters are active', () => {
      const activeFilters: VoteFiltersType = {
        chamber: 'house',
        result: '',
      };

      render(
        <VoteFilters
          filters={activeFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onChange when chamber changes', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      fireEvent.change(chamberSelect, { target: { value: 'senate' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockFilters,
        chamber: 'senate',
      });
    });

    it('should call onChange when result changes', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const resultSelect = screen.getByLabelText(/filter by result/i);
      fireEvent.change(resultSelect, { target: { value: 'passed' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockFilters,
        result: 'passed',
      });
    });

    it('should call onClear when clear button is clicked', () => {
      const activeFilters: VoteFiltersType = {
        chamber: 'senate',
        result: 'passed',
      };

      render(
        <VoteFilters
          filters={activeFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable inputs when loading', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
          isLoading={true}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      const resultSelect = screen.getByLabelText(/filter by result/i);

      expect(chamberSelect).toBeDisabled();
      expect(resultSelect).toBeDisabled();
    });

    it('should disable clear button when loading', () => {
      const activeFilters: VoteFiltersType = {
        chamber: 'house',
        result: '',
      };

      render(
        <VoteFilters
          filters={activeFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
          isLoading={true}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByLabelText(/filter by chamber/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by result/i)).toBeInTheDocument();
    });
  });

  describe('all options', () => {
    it('should include all chamber options', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      const options = chamberSelect.querySelectorAll('option');

      expect(options).toHaveLength(3); // All Chambers, House, Senate
      expect(options[0]).toHaveTextContent('All Chambers');
      expect(options[1]).toHaveTextContent('House');
      expect(options[2]).toHaveTextContent('Senate');
    });

    it('should include all result options', () => {
      render(
        <VoteFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const resultSelect = screen.getByLabelText(/filter by result/i);
      const options = resultSelect.querySelectorAll('option');

      expect(options).toHaveLength(5); // All Results, Passed, Failed, Agreed To, Rejected
      expect(options[0]).toHaveTextContent('All Results');
      expect(options[1]).toHaveTextContent('Passed');
      expect(options[2]).toHaveTextContent('Failed');
      expect(options[3]).toHaveTextContent('Agreed To');
      expect(options[4]).toHaveTextContent('Rejected');
    });
  });
});
