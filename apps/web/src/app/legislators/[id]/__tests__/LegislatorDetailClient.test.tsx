/**
 * Tests for LegislatorDetailClient component
 * @module app/legislators/[id]/__tests__/LegislatorDetailClient.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegislatorDetailClient } from '../LegislatorDetailClient';
import { createMockLegislator } from '@/__tests__/helpers/factories';
import { createSWRWrapper } from '@/__tests__/helpers/render';

// Mock the hooks
vi.mock('@/hooks', () => ({
  useLegislator: vi.fn(),
}));

// Mock the child components
vi.mock('@/components/legislators/LegislatorInfoCard', () => ({
  LegislatorInfoCard: ({ label, children }: any) => (
    <div data-testid={`info-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/legislators/ContactLink', () => ({
  ContactLink: ({ label, href, external }: any) => (
    <a
      data-testid={`contact-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {label}
    </a>
  ),
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
import { useLegislator } from '@/hooks';

const mockUseLegislator = vi.mocked(useLegislator);

describe('LegislatorDetailClient', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when isLoading is true', () => {
    mockUseLegislator.mockReturnValue({
      legislator: null,
      isLoading: true,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="S000033" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Loading legislator details...')).toBeInTheDocument();
  });

  it('should show error state with retry button when error exists', () => {
    const mockError = new Error('Failed to fetch legislator');
    const mockMutate = vi.fn();

    mockUseLegislator.mockReturnValue({
      legislator: null,
      isLoading: false,
      isValidating: false,
      error: mockError,
      mutate: mockMutate,
    });

    render(<LegislatorDetailClient legislatorId="S000033" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Failed to load legislator')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch legislator')).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByTestId('retry-button');
    fireEvent.click(retryButton);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('should show not-found state when legislator is null and not loading', () => {
    mockUseLegislator.mockReturnValue({
      legislator: null,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="X999999" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.getByText('Legislator not found')).toBeInTheDocument();
    expect(
      screen.getByText(/The legislator you're looking for doesn't exist or may have been removed./)
    ).toBeInTheDocument();
    expect(screen.getByText('Browse All Legislators')).toBeInTheDocument();
  });

  it('should render legislator name and details when legislator exists', () => {
    const mockLegislator = createMockLegislator({
      fullName: 'Elizabeth Warren',
      party: 'D',
      chamber: 'senate',
      state: 'MA',
      inOffice: true,
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="W000817" />, {
      wrapper: createSWRWrapper(),
    });

    // Should show name
    expect(screen.getByText('Elizabeth Warren')).toBeInTheDocument();
    // Should show party label (may appear multiple times in header and info cards)
    expect(screen.getAllByText('Democrat').length).toBeGreaterThan(0);
    // Should show chamber and state (may appear multiple times in header and info cards)
    expect(screen.getAllByText(/Senate/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Massachusetts/).length).toBeGreaterThan(0);
  });

  it('should show party and state info in header', () => {
    const mockLegislator = createMockLegislator({
      fullName: 'Ted Cruz',
      party: 'R',
      chamber: 'senate',
      state: 'TX',
    });
    delete (mockLegislator as { district?: number }).district;

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="C001098" />, {
      wrapper: createSWRWrapper(),
    });

    // Party label should be visible (may appear multiple times in header and info cards)
    expect(screen.getAllByText('Republican').length).toBeGreaterThan(0);
    // State should be visible (may appear multiple times in header and info cards)
    expect(screen.getAllByText(/Texas/).length).toBeGreaterThan(0);
  });

  it('should show back link to /legislators', () => {
    const mockLegislator = createMockLegislator();

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="S000033" />, {
      wrapper: createSWRWrapper(),
    });

    const backLink = screen.getByRole('link', { name: /Back to Legislators/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/legislators');
  });

  it('should render office status - shows "Former Member" badge when not in office', () => {
    const mockLegislator = createMockLegislator({
      fullName: 'Joe Biden',
      inOffice: false,
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="B000444" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.getByText('Former Member')).toBeInTheDocument();
  });

  it('should not show "Former Member" badge when legislator is in office', () => {
    const mockLegislator = createMockLegislator({
      fullName: 'Current Member',
      inOffice: true,
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="C001234" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.queryByText('Former Member')).not.toBeInTheDocument();
  });

  it('should render info cards with chamber, state, and term', () => {
    const mockLegislator = createMockLegislator({
      chamber: 'house',
      state: 'CA',
      district: 12,
      termStart: '2023-01-03',
      termEnd: '2025-01-03',
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="P001234" />, {
      wrapper: createSWRWrapper(),
    });

    // Chamber info card
    expect(screen.getByTestId('info-card-chamber')).toBeInTheDocument();
    // State info card
    expect(screen.getByTestId('info-card-state')).toBeInTheDocument();
    // Term info card
    expect(screen.getByTestId('info-card-current-term')).toBeInTheDocument();
    // Bioguide ID card
    expect(screen.getByTestId('info-card-bioguide-id')).toBeInTheDocument();
  });

  it('should show district number for House members', () => {
    const mockLegislator = createMockLegislator({
      chamber: 'house',
      state: 'NY',
      district: 14,
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="O000172" />, {
      wrapper: createSWRWrapper(),
    });

    // District should appear in the state info card and header
    const stateCard = screen.getByTestId('info-card-state');
    expect(stateCard).toHaveTextContent('District 14');
  });

  it('should show contact information when available', () => {
    const mockLegislator = createMockLegislator({
      phone: '(202) 224-3121',
      website: 'https://example.senate.gov',
      twitter: 'SenatorExample',
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="E001234" />, {
      wrapper: createSWRWrapper(),
    });

    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByTestId('contact-link-(202)-224-3121')).toBeInTheDocument();
    expect(screen.getByTestId('contact-link-official-website')).toBeInTheDocument();
    expect(screen.getByTestId('contact-link-@senatorexample')).toBeInTheDocument();
  });

  it('should show Congress.gov external link', () => {
    const mockLegislator = createMockLegislator({
      fullName: 'Bernie Sanders',
      bioguideId: 'S000033',
    });

    mockUseLegislator.mockReturnValue({
      legislator: mockLegislator,
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LegislatorDetailClient legislatorId="S000033" />, {
      wrapper: createSWRWrapper(),
    });

    const congressLink = screen.getByRole('link', { name: /View on Congress.gov/ });
    expect(congressLink).toBeInTheDocument();
    expect(congressLink).toHaveAttribute(
      'href',
      'https://www.congress.gov/member/bernie-sanders/S000033'
    );
    expect(congressLink).toHaveAttribute('target', '_blank');
    expect(congressLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
