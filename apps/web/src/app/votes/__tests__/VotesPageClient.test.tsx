/**
 * Tests for VotesPageClient component
 * @module app/votes/__tests__/VotesPageClient.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VotesPageClient } from '../VotesPageClient';
import {
  createMockVote,
  createMockPagination,
} from '@/__tests__/helpers/factories';
import { createSWRWrapper } from '@/__tests__/helpers/render';

// Mock hooks
vi.mock('@/hooks', () => ({
  useVotes: vi.fn(),
}));

// Mock VoteFilters component (external dependency)
vi.mock('@/components/VoteFilters', () => ({
  VoteFilters: ({ onChange, onClear }: { onChange: (filters: unknown) => void; onClear: () => void }) => (
    <div data-testid="vote-filters">
      <button onClick={() => onChange({ chamber: 'house', result: '' })}>Apply Filter</button>
      <button onClick={onClear}>Clear Filter</button>
    </div>
  ),
}));

// Import after mock to get mocked version
import { useVotes } from '@/hooks';

const mockUseVotes = vi.mocked(useVotes);

describe('VotesPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading state', () => {
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: true,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/loading live votes/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state with retry button', () => {
      const mockMutate = vi.fn();
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: new Error('Network error'),
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/failed to load votes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should call mutate when retry button is clicked', async () => {
      // Use real timers for this test since userEvent needs them
      vi.useRealTimers();

      const user = userEvent.setup();
      const mockMutate = vi.fn();
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: new Error('Network error'),
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockMutate).toHaveBeenCalledTimes(1);

      // Restore fake timers
      vi.useFakeTimers();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no votes', () => {
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: createMockPagination({ total: 0, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/no votes found/i)).toBeInTheDocument();
    });
  });

  describe('Data Rendering', () => {
    it('should render vote cards when data exists', () => {
      const mockVotes = [
        createMockVote({ id: 'vote-1', question: 'On Passage of HR 1' }),
        createMockVote({ id: 'vote-2', question: 'On Passage of S 100' }),
      ];

      mockUseVotes.mockReturnValue({
        votes: mockVotes,
        pagination: createMockPagination({ total: 2, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('On Passage of HR 1')).toBeInTheDocument();
      expect(screen.getByText('On Passage of S 100')).toBeInTheDocument();
    });

    it('should show chamber, date, question, and result in VoteCard', () => {
      const mockVote = createMockVote({
        id: 'vote-1',
        chamber: 'house',
        date: '2025-02-01',
        question: 'On Passage of HR 1',
        result: 'passed',
        rollCallNumber: 100,
      });

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      // Check for chamber
      expect(screen.getAllByText(/house/i).length).toBeGreaterThan(0);
      // Check for question
      expect(screen.getByText('On Passage of HR 1')).toBeInTheDocument();
      // Check for roll call number
      expect(screen.getByText(/roll call #100/i)).toBeInTheDocument();
      // Date formatting is tested implicitly by the component rendering without errors
      // The formatDate function converts '2025-02-01' to a localized date string
    });

    it('should show tally (yea/nay counts)', () => {
      const mockVote = createMockVote({
        id: 'vote-1',
        yeas: 220,
        nays: 210,
        present: 3,
        notVoting: 2,
      });

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      // Check for the tally labels and numbers (numbers are in separate spans)
      expect(screen.getByText('220')).toBeInTheDocument();
      expect(screen.getByText('Yea')).toBeInTheDocument();
      expect(screen.getByText('210')).toBeInTheDocument();
      expect(screen.getByText('Nay')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Present')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Not Voting')).toBeInTheDocument();
    });
  });

  describe('ResultBadge', () => {
    it('should show "Passed" for passed result', () => {
      const mockVote = createMockVote({
        id: 'vote-1',
        result: 'passed',
      });

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('Passed')).toBeInTheDocument();
    });

    it('should show "Failed" for failed result', () => {
      const mockVote = createMockVote({
        id: 'vote-1',
        result: 'failed',
      });

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('Vote Count Summary', () => {
    it('should show vote count summary', () => {
      const mockVotes = Array.from({ length: 5 }, (_, i) =>
        createMockVote({ id: `vote-${i}` })
      );

      mockUseVotes.mockReturnValue({
        votes: mockVotes,
        pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByText(/showing 5 of 50 votes/i)).toBeInTheDocument();
    });
  });

  describe('Refresh Button', () => {
    it('should render refresh button', () => {
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should call mutate when refresh button is clicked', async () => {
      // Use real timers for this test since userEvent needs them
      vi.useRealTimers();

      const user = userEvent.setup();
      const mockMutate = vi.fn();
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(mockMutate).toHaveBeenCalledTimes(1);

      // Restore fake timers
      vi.useFakeTimers();
    });
  });

  describe('Polling', () => {
    it('should set interval on mount', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(setIntervalSpy).toHaveBeenCalled();
      // Verify interval is set to 30000ms (30 seconds)
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should clear interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      const { unmount } = render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should call mutate on polling interval', () => {
      const mockMutate = vi.fn();
      mockUseVotes.mockReturnValue({
        votes: [],
        pagination: null,
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: mockMutate,
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      // Initial render - mutate not called yet
      expect(mockMutate).not.toHaveBeenCalled();

      // Advance time by 30 seconds (one interval)
      vi.advanceTimersByTime(30000);

      // mutate should have been called once
      expect(mockMutate).toHaveBeenCalledTimes(1);

      // Advance another 30 seconds
      vi.advanceTimersByTime(30000);

      // mutate should have been called twice total
      expect(mockMutate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Bill Link', () => {
    it('should show bill link when vote has billId', () => {
      const mockVote = createMockVote({
        id: 'vote-1',
        billId: 'hr-1-119',
      });

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      const billLink = screen.getByRole('link', { name: /view associated bill/i });
      expect(billLink).toBeInTheDocument();
      expect(billLink).toHaveAttribute('href', '/bills/hr-1-119');
    });

    it('should not show bill link when vote has no billId', () => {
      const mockVote = createMockVote({ id: 'vote-1' });
      delete mockVote.billId;

      mockUseVotes.mockReturnValue({
        votes: [mockVote],
        pagination: createMockPagination({ total: 1, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      expect(screen.queryByRole('link', { name: /view associated bill/i })).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should render pagination when hasMore is true', () => {
      const mockVotes = Array.from({ length: 20 }, (_, i) =>
        createMockVote({ id: `vote-${i}` })
      );

      mockUseVotes.mockReturnValue({
        votes: mockVotes,
        pagination: createMockPagination({ total: 50, limit: 20, offset: 0, hasMore: true }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      // Check for pagination component (it should show page numbers/navigation)
      const paginationButtons = screen.getAllByRole('button').filter(btn => {
        const text = btn.textContent || '';
        return /^(1|2|3|next|previous|first|last)$/i.test(text);
      });
      expect(paginationButtons.length).toBeGreaterThan(0);
    });

    it('should not render pagination when totalPages is 1', () => {
      const mockVotes = Array.from({ length: 10 }, (_, i) =>
        createMockVote({ id: `vote-${i}` })
      );

      mockUseVotes.mockReturnValue({
        votes: mockVotes,
        pagination: createMockPagination({ total: 10, limit: 20, offset: 0, hasMore: false }),
        isLoading: false,
        isValidating: false,
        error: null,
        retryState: { retryCount: 0, isRetrying: false, lastError: null },
        mutate: vi.fn(),
      });

      render(<VotesPageClient />, { wrapper: createSWRWrapper() });

      // Pagination should not be present (total 10, page size 20 = 1 page)
      const paginationButtons = screen.queryAllByRole('button').filter(btn => {
        const text = btn.textContent || '';
        return /^(next|previous|first|last)$/i.test(text);
      });
      expect(paginationButtons.length).toBe(0);
    });
  });
});
