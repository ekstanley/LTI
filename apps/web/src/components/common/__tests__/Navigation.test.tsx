/**
 * Tests for Navigation component
 * @module components/common/__tests__/Navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Navigation } from '../Navigation';

// Mock usePathname at module level
let mockPathname = '/';
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => mockPathname,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
  };
});

describe('Navigation', () => {
  beforeEach(() => {
    mockPathname = '/'; // Reset to default
  });

  it('should render logo link to "/"', () => {
    render(<Navigation />);

    const logoLink = screen.getByRole('link', { name: /ltip/i });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('should render all 3 navigation links', () => {
    render(<Navigation />);

    expect(screen.getByRole('link', { name: /bills/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /legislators/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /live votes/i })).toBeInTheDocument();
  });

  it('should highlight active link when pathname matches', () => {
    mockPathname = '/bills';

    render(<Navigation />);

    // Find all Bills links (desktop + mobile)
    const billsLinks = screen.getAllByRole('link', { name: /bills/i });

    // Desktop link should have active class (text-blue-600)
    const desktopLink = billsLinks.find(link =>
      link.className.includes('text-blue-600')
    );
    expect(desktopLink).toBeDefined();
    expect(desktopLink?.className).toContain('text-blue-600');

    // Other links should not be active
    const legislatorsLinks = screen.getAllByRole('link', { name: /legislators/i });
    const desktopLegislatorsLink = legislatorsLinks.find(link =>
      link.className.includes('text-sm')
    );
    expect(desktopLegislatorsLink?.className).not.toContain('text-blue-600');
    expect(desktopLegislatorsLink?.className).toContain('text-gray-600');
  });

  it('should highlight active link for nested paths', () => {
    mockPathname = '/bills/hr-1-119';

    render(<Navigation />);

    // Find all Bills links (desktop + mobile)
    const billsLinks = screen.getAllByRole('link', { name: /bills/i });

    // Desktop link should have active class
    const desktopLink = billsLinks.find(link =>
      link.className.includes('text-blue-600')
    );
    expect(desktopLink).toBeDefined();
    expect(desktopLink?.className).toContain('text-blue-600');
  });

  it('should have mobile menu button with aria-expanded="false" initially', () => {
    render(<Navigation />);

    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should open mobile menu on button click', () => {
    render(<Navigation />);

    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    // Mobile menu should now be visible with links
    const allBillsLinks = screen.getAllByRole('link', { name: /bills/i });
    // Should have desktop link + mobile link = at least 2
    expect(allBillsLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('should close mobile menu when a link is clicked', () => {
    render(<Navigation />);

    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });

    // Open menu
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    // Click a mobile menu link
    const allBillsLinks = screen.getAllByRole('link', { name: /bills/i });
    const mobileLink = allBillsLinks[allBillsLinks.length - 1]!; // Last link is mobile
    fireEvent.click(mobileLink);

    // Menu should be closed
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should not highlight non-matching links', () => {
    mockPathname = '/bills';

    render(<Navigation />);

    // Legislators and Votes should not be active
    const legislatorsLinks = screen.getAllByRole('link', { name: /legislators/i });
    const desktopLegislatorsLink = legislatorsLinks.find(link =>
      link.className.includes('text-sm')
    );
    expect(desktopLegislatorsLink?.className).not.toContain('text-blue-600');

    const votesLinks = screen.getAllByRole('link', { name: /live votes/i });
    const desktopVotesLink = votesLinks.find(link =>
      link.className.includes('text-sm')
    );
    expect(desktopVotesLink?.className).not.toContain('text-blue-600');
  });
});
