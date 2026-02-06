/**
 * Tests for BillDetailClient component
 * @module app/bills/[id]/__tests__/BillDetailClient.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BillDetailClient } from '../BillDetailClient';
import { createMockBill, createMockLegislator } from '@/__tests__/helpers/factories';
import { createSWRWrapper } from '@/__tests__/helpers/render';

// Mock the hooks
vi.mock('@/hooks', () => ({
  useBill: vi.fn(),
}));

// Mock the child components
vi.mock('@/components/bills/BillFormatters', () => ({
  formatBillId: (bill: any) => `${bill.billType.toUpperCase()}-${bill.billNumber}`,
}));

vi.mock('@/components/bills/BillInfoCard', () => ({
  BillInfoCard: ({ label, children }: any) => (
    <div data-testid={`info-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/bills/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('@/components/common', () => ({
  Navigation: () => <nav data-testid="navigation">Navigation</nav>,
  LoadingState: ({ message }: any) => <div data-testid="loading-state">{message}</div>,
  ErrorFallback: ({ error, title, onRetry }: any) => (
    <div data-testid="error-fallback">
      <h3>{title}</h3>
      <p>{error.message}</p>
      <button data-testid="retry-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  ),
}));

vi.mock('@/components/common/DateFormatter', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
}));

// Import after mocks
import { useBill } from '@/hooks';

const mockUseBill = vi.mocked(useBill);

describe('BillDetailClient', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when isLoading is true', () => {
    mockUseBill.mockReturnValue({
      bill: null,
      isLoading: true,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Loading bill details...')).toBeInTheDocument();
  });

  it('should show error state with retry button when error exists', () => {
    const mockError = new Error('Failed to fetch bill');
    const mockMutate = vi.fn();

    mockUseBill.mockReturnValue({
      bill: null,
      isLoading: false,
      isValidating: false,
      error: mockError,
      mutate: mockMutate,
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Failed to load bill')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch bill')).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByTestId('retry-button');
    fireEvent.click(retryButton);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('should show not-found state when bill is null and not loading', () => {
    mockUseBill.mockReturnValue({
      bill: null,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-999-119" />, { wrapper: createSWRWrapper() });

    expect(screen.getByText('Bill not found')).toBeInTheDocument();
    expect(
      screen.getByText(/The bill you're looking for doesn't exist or may have been removed./)
    ).toBeInTheDocument();
    expect(screen.getByText('Browse All Bills')).toBeInTheDocument();
  });

  it('should render bill title and details when bill exists', () => {
    const mockBill = createMockBill({
      id: 'hr-1-119',
      billType: 'hr',
      billNumber: 1,
      congressNumber: 119,
      title: 'Infrastructure Investment Act',
      shortTitle: 'Infrastructure Act',
      status: 'introduced',
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    // Should show formatted bill ID
    expect(screen.getByText('HR-1')).toBeInTheDocument();
    // Should show short title
    expect(screen.getByText('Infrastructure Act')).toBeInTheDocument();
    // Should show full title as subtitle
    expect(screen.getByText('Infrastructure Investment Act')).toBeInTheDocument();
    // Should show status badge
    expect(screen.getByTestId('status-badge')).toHaveTextContent('introduced');
    // Should show congress number
    expect(screen.getByText(/119th Congress/)).toBeInTheDocument();
  });

  it('should show sponsor info with link to legislator page', () => {
    const mockSponsor = createMockLegislator({
      id: 'M001234',
      fullName: 'Jane Doe',
      party: 'D',
      state: 'CA',
    });

    const mockBill = createMockBill({
      id: 'hr-1-119',
      sponsor: mockSponsor,
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    const sponsorCard = screen.getByTestId('info-card-sponsor');
    expect(sponsorCard).toBeInTheDocument();
    expect(sponsorCard).toHaveTextContent('Jane Doe');
    expect(sponsorCard).toHaveTextContent('(D-CA)');

    // Should have link to legislator page
    const sponsorLink = screen.getByRole('link', { name: /Jane Doe/ });
    expect(sponsorLink).toHaveAttribute('href', '/legislators/M001234');
  });

  it('should show back link to /bills', () => {
    const mockBill = createMockBill();

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    const backLink = screen.getByRole('link', { name: /Back to Bills/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/bills');
  });

  it('should render subjects as tags when present', () => {
    const mockBill = createMockBill({
      subjects: ['Economics', 'Taxation', 'Budget'],
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    expect(screen.getByText('Subjects')).toBeInTheDocument();
    expect(screen.getByText('Economics')).toBeInTheDocument();
    expect(screen.getByText('Taxation')).toBeInTheDocument();
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('should show Congress.gov external link', () => {
    const mockBill = createMockBill({
      congressNumber: 119,
      chamber: 'house',
      billNumber: 1,
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    const congressLink = screen.getByRole('link', { name: /View on Congress.gov/ });
    expect(congressLink).toBeInTheDocument();
    expect(congressLink).toHaveAttribute(
      'href',
      'https://www.congress.gov/bill/119th-congress/house-bill/1'
    );
    expect(congressLink).toHaveAttribute('target', '_blank');
    expect(congressLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render info grid with chamber, date, and cosponsors', () => {
    const mockBill = createMockBill({
      chamber: 'house',
      introducedDate: '2025-01-15',
      cosponsorsCount: 42,
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    // Chamber info
    const chamberCard = screen.getByTestId('info-card-originating-chamber');
    expect(chamberCard).toBeInTheDocument();

    // Introduced date
    const dateCard = screen.getByTestId('info-card-introduced');
    expect(dateCard).toBeInTheDocument();

    // Cosponsors
    const cosponsorsCard = screen.getByTestId('info-card-cosponsors');
    expect(cosponsorsCard).toBeInTheDocument();
    expect(cosponsorsCard).toHaveTextContent('42 cosponsors');
  });

  it('should show singular "cosponsor" when count is 1', () => {
    const mockBill = createMockBill({
      cosponsorsCount: 1,
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    const cosponsorsCard = screen.getByTestId('info-card-cosponsors');
    expect(cosponsorsCard).toHaveTextContent('1 cosponsor');
  });

  it('should render latest action when present', () => {
    const mockBill = createMockBill({
      latestAction: {
        date: '2025-02-01',
        text: 'Passed House by voice vote',
        chamber: 'house',
      },
    });

    mockUseBill.mockReturnValue({
      bill: mockBill,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<BillDetailClient billId="hr-1-119" />, { wrapper: createSWRWrapper() });

    expect(screen.getByText('Latest Action')).toBeInTheDocument();
    expect(screen.getByText('Passed House by voice vote')).toBeInTheDocument();
  });
});
