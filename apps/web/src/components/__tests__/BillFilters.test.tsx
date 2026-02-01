/**
 * Tests for BillFilters component
 *
 * @module components/__tests__/BillFilters.test
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BillFilters } from '../BillFilters';
import type { BillFilters as BillFiltersType } from '../BillFilters';

describe('BillFilters', () => {
  const mockFilters: BillFiltersType = {
    search: '',
    chamber: '',
    status: '',
  };

  const mockOnChange = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render search input', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search bills/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render chamber select', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      expect(chamberSelect).toBeInTheDocument();
    });

    it('should render status select', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const statusSelect = screen.getByLabelText(/filter by status/i);
      expect(statusSelect).toBeInTheDocument();
    });

    it('should not render clear button when no filters active', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.queryByRole('button', { name: /clear all filters/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should render clear button when filters are active', () => {
      const activeFilters: BillFiltersType = {
        search: 'infrastructure',
        chamber: '',
        status: '',
      };

      render(
        <BillFilters
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
    it('should call onChange when search input changes', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search bills/i);
      fireEvent.change(searchInput, { target: { value: 'healthcare' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockFilters,
        search: 'healthcare',
      });
    });

    it('should call onChange when chamber changes', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      fireEvent.change(chamberSelect, { target: { value: 'house' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockFilters,
        chamber: 'house',
      });
    });

    it('should call onChange when status changes', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const statusSelect = screen.getByLabelText(/filter by status/i);
      fireEvent.change(statusSelect, { target: { value: 'passed_house' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockFilters,
        status: 'passed_house',
      });
    });

    it('should call onClear when clear button is clicked', () => {
      const activeFilters: BillFiltersType = {
        search: 'infrastructure',
        chamber: 'house',
        status: 'passed_house',
      };

      render(
        <BillFilters
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

  describe('validation', () => {
    it('should not show error initially', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      const errors = screen.queryAllByRole('alert');
      expect(errors).toHaveLength(0);
    });

    it('should show error for search string that is too long', async () => {
      const { rerender } = render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      // Type into search to mark it as touched
      const searchInput = screen.getByPlaceholderText(/search bills/i);
      fireEvent.change(searchInput, { target: { value: 'a'.repeat(501) } });

      // Wait for onChange to be called
      expect(mockOnChange).toHaveBeenCalled();

      // Rerender with the invalid filters
      const invalidFilters: BillFiltersType = {
        search: 'a'.repeat(501),
        chamber: '',
        status: '',
      };

      rerender(
        <BillFilters
          filters={invalidFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      // Error should appear after rerender
      const error = await screen.findByRole('alert');
      expect(error).toBeInTheDocument();
      expect(error).toHaveTextContent(/cannot exceed 500 characters/i);
    });
  });

  describe('loading state', () => {
    it('should disable inputs when loading', () => {
      render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
          isLoading={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search bills/i);
      const chamberSelect = screen.getByLabelText(/filter by chamber/i);
      const statusSelect = screen.getByLabelText(/filter by status/i);

      expect(searchInput).toBeDisabled();
      expect(chamberSelect).toBeDisabled();
      expect(statusSelect).toBeDisabled();
    });

    it('should disable clear button when loading', () => {
      const activeFilters: BillFiltersType = {
        search: 'infrastructure',
        chamber: '',
        status: '',
      };

      render(
        <BillFilters
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
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByLabelText(/search bills/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by chamber/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
    });

    it('should set aria-invalid when field has error', async () => {
      const { rerender } = render(
        <BillFilters
          filters={mockFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      // Type into search to mark it as touched
      const searchInput = screen.getByPlaceholderText(/search bills/i);
      fireEvent.change(searchInput, { target: { value: 'a'.repeat(501) } });

      // Rerender with invalid filters
      const invalidFilters: BillFiltersType = {
        search: 'a'.repeat(501),
        chamber: '',
        status: '',
      };

      rerender(
        <BillFilters
          filters={invalidFilters}
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      );

      // Wait for validation to run
      await screen.findByRole('alert');

      expect(searchInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
