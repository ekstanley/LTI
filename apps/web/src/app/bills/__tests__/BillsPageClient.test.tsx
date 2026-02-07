/**
 * Tests for BillsPageClient component
 * @module app/bills/__tests__/BillsPageClient.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BillsPageClient } from '../BillsPageClient';
import { createMockBill, createMockPagination } from '@/__tests__/helpers/factories';
import { createSWRWrapper } from '@/__tests__/helpers/render';

// Mock the hooks
vi.mock('@/hooks', () => ({
  useBills: vi.fn(),
  useDebounce: vi.fn((value) => value), // Return value immediately
}));

// Mock the child components to simplify testing
vi.mock('@/components/BillFilters', () => ({
  BillFilters: ({ filters, onChange, onClear, isLoading }: any) => (
    <div data-testid="bill-filters">
      <input
        data-testid="search-input"
        type="text"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        disabled={isLoading}
      />
      <select
        data-testid="chamber-select"
        value={filters.chamber}
        onChange={(e) => onChange({ ...filters, chamber: e.target.value })}
        disabled={isLoading}
      >
        <option value="">All Chambers</option>
        <option value="house">House</option>
        <option value="senate">Senate</option>
      </select>
      <select
        data-testid="status-select"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        disabled={isLoading}
      >
        <option value="">All Statuses</option>
        <option value="introduced">Introduced</option>
        <option value="in_committee">In Committee</option>
      </select>
      <button data-testid="clear-filters-btn" onClick={onClear}>
        Clear Filters
      </button>
    </div>
  ),
}));

vi.mock('@/components/bills', () => ({
  BillCard: ({ bill }: any) => (
    <div data-testid={`bill-card-${bill.id}`}>
      <h3>{bill.title}</h3>
      <span>{bill.status}</span>
      {bill.sponsor && <span>{bill.sponsor.fullName}</span>}
    </div>
  ),
}));

vi.mock('@/components/common', () => ({
  Navigation: () => <nav data-testid="navigation">Navigation</nav>,
  LoadingState: ({ message }: any) => <div data-testid="loading-state">{message}</div>,
  EmptyState: ({ title, message, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  ),
  ErrorFallback: ({ error, title, onRetry }: any) => (
    <div data-testid="error-fallback">
      <h3>{title}</h3>
      <p>{error.message}</p>
      <button data-testid="retry-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  ),
  Pagination: ({ currentPage, totalPages, onPageChange }: any) => (
    <div data-testid="pagination">
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <button data-testid="next-page-btn" onClick={() => onPageChange(currentPage + 1)}>
        Next
      </button>
    </div>
  ),
}));

// Import after mocks
import { useBills } from '@/hooks';

const mockUseBills = vi.mocked(useBills);

describe('BillsPageClient', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.scrollTo
    window.scrollTo = vi.fn();
  });

  it('should show loading state when isLoading is true', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: null,
      isLoading: true,
      isValidating: false,
      error: null,
      state: { status: 'loading' },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Loading bills...')).toBeInTheDocument();
  });

  it('should show error state with retry button when error exists', () => {
    const mockError = new Error('Failed to fetch bills');
    const mockMutate = vi.fn();

    mockUseBills.mockReturnValue({
      bills: [],
      pagination: null,
      isLoading: false,
      isValidating: false,
      error: mockError,
      state: { status: 'error', error: mockError },
      retryState: { retryCount: 1, isRetrying: false, lastError: mockError },
      mutate: mockMutate,
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Failed to load bills')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch bills')).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByTestId('retry-button');
    fireEvent.click(retryButton);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('should show empty state when data is empty array and not loading', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No bills found')).toBeInTheDocument();
  });

  it('should render bill cards when data exists', () => {
    const mockBills = [
      createMockBill({ id: 'hr-1-119', title: 'Test Bill 1' }),
      createMockBill({ id: 'hr-2-119', title: 'Test Bill 2' }),
    ];

    mockUseBills.mockReturnValue({
      bills: mockBills,
      pagination: createMockPagination({ total: 2, hasMore: false }),
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: mockBills, pagination: createMockPagination({ total: 2, hasMore: false }) } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('bill-card-hr-1-119')).toBeInTheDocument();
    expect(screen.getByTestId('bill-card-hr-2-119')).toBeInTheDocument();
    expect(screen.getByText('Test Bill 1')).toBeInTheDocument();
    expect(screen.getByText('Test Bill 2')).toBeInTheDocument();
  });

  it('should show bill title, status, and sponsor info in each card', () => {
    const mockBills = [
      createMockBill({
        id: 'hr-1-119',
        title: 'Infrastructure Act',
        status: 'introduced',
        sponsor: {
          id: 'M001234',
          bioguideId: 'S000001',
          firstName: 'Jane',
          lastName: 'Doe',
          fullName: 'Jane Doe',
          party: 'D',
          state: 'CA',
          chamber: 'house',
          inOffice: true,
          termStart: '2023-01-03',
        },
      }),
    ];

    mockUseBills.mockReturnValue({
      bills: mockBills,
      pagination: createMockPagination({ total: 1, hasMore: false }),
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: mockBills, pagination: createMockPagination({ total: 1, hasMore: false }) } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    const billCard = screen.getByTestId('bill-card-hr-1-119');
    expect(billCard).toHaveTextContent('Infrastructure Act');
    expect(billCard).toHaveTextContent('introduced');
    expect(billCard).toHaveTextContent('Jane Doe');
  });

  it('should render filter inputs (search, chamber select, status select)', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: null,
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'idle' },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('chamber-select')).toBeInTheDocument();
    expect(screen.getByTestId('status-select')).toBeInTheDocument();
  });

  it('should show clear filters button when filters are active', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    const { rerender } = render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    // Initially no active filters - should show default empty state
    expect(screen.getByText('No bills found')).toBeInTheDocument();

    // Type in search input to activate filter
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'infrastructure' } });

    // Re-render to pick up the state change
    rerender(<BillsPageClient />);

    // Should now show search empty state with clear button
    expect(screen.getByText(/Try adjusting your search terms/)).toBeInTheDocument();
    // Should have two "Clear Filters" buttons - one in filters, one in empty state
    expect(screen.getAllByText('Clear Filters')).toHaveLength(2);
  });

  it('should render pagination when hasMore is true and totalPages > 1', () => {
    const mockBills = Array.from({ length: 20 }, (_, i) =>
      createMockBill({ id: `hr-${i + 1}-119`, title: `Bill ${i + 1}` })
    );

    mockUseBills.mockReturnValue({
      bills: mockBills,
      pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }),
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: mockBills, pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }) } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('should scroll to top when page button is clicked', async () => {
    const mockBills = Array.from({ length: 20 }, (_, i) =>
      createMockBill({ id: `hr-${i + 1}-119`, title: `Bill ${i + 1}` })
    );

    mockUseBills.mockReturnValue({
      bills: mockBills,
      pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }),
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: mockBills, pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }) } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    const nextPageBtn = screen.getByTestId('next-page-btn');
    fireEvent.click(nextPageBtn);

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });
  });

  it('should not show pagination when totalPages is 1', () => {
    const mockBills = [createMockBill({ id: 'hr-1-119', title: 'Single Bill' })];

    mockUseBills.mockReturnValue({
      bills: mockBills,
      pagination: createMockPagination({ total: 1, limit: 20, offset: 0, hasMore: false }),
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: mockBills, pagination: createMockPagination({ total: 1, limit: 20, offset: 0, hasMore: false }) } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('should disable filter inputs when loading', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: null,
      isLoading: true,
      isValidating: false,
      error: null,
      state: { status: 'loading' },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('search-input')).toBeDisabled();
    expect(screen.getByTestId('chamber-select')).toBeDisabled();
    expect(screen.getByTestId('status-select')).toBeDisabled();
  });

  it('should clear filters when clear button is clicked', () => {
    mockUseBills.mockReturnValue({
      bills: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      isLoading: false,
      isValidating: false,
      error: null,
      state: { status: 'success', data: { data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } } },
      retryState: { retryCount: 0, isRetrying: false, lastError: null },
      mutate: vi.fn(),
    });

    render(<BillsPageClient />, { wrapper: createSWRWrapper() });

    // Set some filters
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'infrastructure' },
    });
    fireEvent.change(screen.getByTestId('chamber-select'), { target: { value: 'house' } });

    // Click clear filters
    const clearBtn = screen.getByTestId('clear-filters-btn');
    fireEvent.click(clearBtn);

    // Filters should be reset
    expect(screen.getByTestId('search-input')).toHaveValue('');
    expect(screen.getByTestId('chamber-select')).toHaveValue('');
    expect(screen.getByTestId('status-select')).toHaveValue('');
  });
});
