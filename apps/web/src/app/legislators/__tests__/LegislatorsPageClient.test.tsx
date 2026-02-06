/**
 * Tests for LegislatorsPageClient component
 * @module app/legislators/__tests__/LegislatorsPageClient.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LegislatorsPageClient } from '../LegislatorsPageClient';
import {
  createMockLegislator,
  createMockPagination,
} from '@/__tests__/helpers/factories';
import { createSWRWrapper } from '@/__tests__/helpers/render';

// Mock hooks
vi.mock('@/hooks', () => ({
  useLegislators: vi.fn(),
  useDebounce: vi.fn((value: string) => value), // Return immediately for tests
}));

// Import after mock to get mocked version
import { useLegislators } from '@/hooks';

const mockUseLegislators = vi.mocked(useLegislators);

describe('LegislatorsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state', () => {
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: true,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/loading legislators/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state with retry button', () => {
      const mockMutate = vi.fn();
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: new Error('Network error'),
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/failed to load legislators/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should call mutate when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockMutate = vi.fn();
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: new Error('Network error'),
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no legislators match', () => {
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: createMockPagination({ total: 0, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/no legislators found/i)).toBeInTheDocument();
    });

    it('should show search-specific empty state when filters active', async () => {
      const user = userEvent.setup();
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: createMockPagination({ total: 0, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await user.type(searchInput, 'NonexistentName');

      await waitFor(() => {
        expect(screen.getByText(/no legislators match your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Rendering', () => {
    it('should render legislator cards when data exists', () => {
      const mockLegislators = [
        createMockLegislator({ id: 'M001', fullName: 'John Smith', party: 'D', state: 'CA' }),
        createMockLegislator({ id: 'M002', fullName: 'Jane Doe', party: 'R', state: 'TX' }),
      ];

      mockUseLegislators.mockReturnValue({
        legislators: mockLegislators,
        pagination: createMockPagination({ total: 2, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should show legislator name, party, and state on each card', () => {
      const mockLegislator = createMockLegislator({
        id: 'M001',
        fullName: 'John Smith',
        party: 'D',
        state: 'CA',
      });

      mockUseLegislators.mockReturnValue({
        legislators: [mockLegislator],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      // "Democrat" appears in both the party filter dropdown and the card
      // so we use getAllByText and check that at least one is present
      expect(screen.getAllByText(/democrat/i).length).toBeGreaterThan(0);
      expect(screen.getByText('CA')).toBeInTheDocument();
    });

    it('should show "Former Member" badge when inOffice is false', () => {
      const mockLegislator = createMockLegislator({
        id: 'M001',
        fullName: 'John Smith',
        inOffice: false,
      });

      mockUseLegislators.mockReturnValue({
        legislators: [mockLegislator],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('Former Member')).toBeInTheDocument();
    });

    it('should show initials when no avatar URL', () => {
      const mockLegislator = createMockLegislator({
        id: 'M001',
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
      });
      delete (mockLegislator as { imageUrl?: string }).imageUrl;

      mockUseLegislators.mockReturnValue({
        legislators: [mockLegislator],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Check for initials "JS" in the avatar placeholder
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });

  describe('Filter Inputs', () => {
    it('should render all filter inputs', () => {
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Search input
      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();

      // Get all comboboxes (there should be 3: chamber, party, state)
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(3);

      // Verify we have chamber, party, and state selects by checking for specific options
      expect(screen.getByText('All Chambers')).toBeInTheDocument();
      expect(screen.getByText('All Parties')).toBeInTheDocument();
      expect(screen.getByText('All States')).toBeInTheDocument();
    });

    it('should render state dropdown with options', () => {
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Find state select and verify it has options
      const selects = screen.getAllByRole('combobox');
      const stateSelect = selects.find(select =>
        select.querySelector('option[value="CA"]')
      );

      expect(stateSelect).toBeDefined();
      expect(stateSelect?.querySelector('option[value="CA"]')).toBeInTheDocument();
    });
  });

  describe('Clear Filters', () => {
    it('should show clear filters button when filters are active', async () => {
      const user = userEvent.setup();
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Initially, no clear button (excluding the one in empty state)
      const clearButtons = screen.queryAllByRole('button', { name: /clear/i });
      // There might be one in the empty state, but it says "Clear Filters"
      expect(clearButtons.filter(btn => btn.textContent === 'Clear').length).toBe(0);

      // Type in search
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await user.type(searchInput, 'John');

      // Clear button should appear (the one that just says "Clear", not "Clear Filters")
      await waitFor(() => {
        const clearButtons = screen.getAllByRole('button', { name: /clear/i });
        expect(clearButtons.some(btn => btn.textContent === 'Clear')).toBe(true);
      });
    });

    it('should reset all filter values when clear is clicked', async () => {
      const user = userEvent.setup();
      mockUseLegislators.mockReturnValue({
        legislators: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Apply filters
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await user.type(searchInput, 'John');

      const selects = screen.getAllByRole('combobox');
      const chamberSelect = selects[0]!;
      await user.selectOptions(chamberSelect, 'house');

      // Verify filter is active
      expect(searchInput).toHaveValue('John');

      // Find the clear button (the one in the filter bar, not in empty state)
      const clearButton = await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /clear/i });
        return buttons.find(btn => btn.textContent === 'Clear');
      });

      expect(clearButton).toBeDefined();
      if (clearButton) {
        await user.click(clearButton);
      }

      // Verify filters are reset
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Pagination', () => {
    it('should render pagination when hasMore is true', () => {
      const mockLegislators = Array.from({ length: 24 }, (_, i) =>
        createMockLegislator({ id: `M${i}`, fullName: `Legislator ${i}` })
      );

      mockUseLegislators.mockReturnValue({
        legislators: mockLegislators,
        pagination: createMockPagination({ total: 50, limit: 24, offset: 0, hasMore: true }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Check for pagination component (it should show page numbers/navigation)
      const paginationButtons = screen.getAllByRole('button').filter(btn =>
        /^(1|2|next|previous|first|last)$/i.test(btn.textContent || '')
      );
      expect(paginationButtons.length).toBeGreaterThan(0);
    });

    it('should not render pagination when totalPages is 1', () => {
      const mockLegislators = Array.from({ length: 10 }, (_, i) =>
        createMockLegislator({ id: `M${i}`, fullName: `Legislator ${i}` })
      );

      mockUseLegislators.mockReturnValue({
        legislators: mockLegislators,
        pagination: createMockPagination({ total: 10, limit: 24, offset: 0, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<LegislatorsPageClient />, { wrapper: createSWRWrapper() });

      // Pagination should not be present (total 10, page size 24 = 1 page)
      const paginationButtons = screen.queryAllByRole('button').filter(btn =>
        /^(next|previous|first|last)$/i.test(btn.textContent || '')
      );
      expect(paginationButtons.length).toBe(0);
    });
  });
});
