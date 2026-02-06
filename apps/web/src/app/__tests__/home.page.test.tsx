/**
 * Tests for HomePage component
 * @module app/__tests__/home.page.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link to render as plain anchor tags
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => <svg data-testid="icon-search" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="icon-trending" {...props} />,
  Users: (props: Record<string, unknown>) => <svg data-testid="icon-users" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  ArrowRight: (props: Record<string, unknown>) => <svg data-testid="icon-arrow" {...props} />,
}));

import HomePage from '../page';

describe('HomePage', () => {
  describe('hero section', () => {
    it('should render hero heading with key phrases', () => {
      render(<HomePage />);
      expect(screen.getByText(/Track Legislation with/i)).toBeInTheDocument();
      expect(screen.getByText(/Unbiased Intelligence/i)).toBeInTheDocument();
    });

    it('should render hero description', () => {
      render(<HomePage />);
      expect(screen.getByText(/AI-powered analysis/i)).toBeInTheDocument();
    });

    it('should render CTA buttons', () => {
      render(<HomePage />);
      expect(screen.getByText('Explore Bills')).toBeInTheDocument();
      expect(screen.getByText('Learn More')).toBeInTheDocument();
    });
  });

  describe('feature cards', () => {
    it('should render 4 feature cards with correct titles', () => {
      render(<HomePage />);
      expect(screen.getByText('Bill Tracking')).toBeInTheDocument();
      expect(screen.getByText('AI Analysis')).toBeInTheDocument();
      expect(screen.getByText('Live Voting')).toBeInTheDocument();
      expect(screen.getByText('COI Detection')).toBeInTheDocument();
    });
  });

  describe('stat cards', () => {
    it('should render 4 stat cards with correct values', () => {
      render(<HomePage />);
      expect(screen.getByText('10,000+')).toBeInTheDocument();
      expect(screen.getByText('535')).toBeInTheDocument();
      expect(screen.getByText('24/7')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should render stat labels', () => {
      render(<HomePage />);
      expect(screen.getByText('Bills Tracked')).toBeInTheDocument();
      // "Legislators" appears in both nav and stat section
      expect(screen.getAllByText('Legislators').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Live Updates')).toBeInTheDocument();
      expect(screen.getByText('Transparent')).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('should render nav links for bills, legislators, votes', () => {
      render(<HomePage />);
      const billsLinks = screen.getAllByRole('link', { name: /bills/i });
      expect(billsLinks.length).toBeGreaterThanOrEqual(1);

      const legislatorsLink = screen.getByRole('link', { name: /legislators/i });
      expect(legislatorsLink).toHaveAttribute('href', '/legislators');

      const votesLink = screen.getByRole('link', { name: /live votes/i });
      expect(votesLink).toHaveAttribute('href', '/votes');
    });
  });

  describe('footer', () => {
    it('should render footer links for about, privacy, and GitHub', () => {
      render(<HomePage />);
      const aboutLink = screen.getByRole('link', { name: 'About' });
      expect(aboutLink).toHaveAttribute('href', '/about');

      const privacyLink = screen.getByRole('link', { name: 'Privacy' });
      expect(privacyLink).toHaveAttribute('href', '/privacy');

      const githubLink = screen.getByRole('link', { name: 'GitHub' });
      expect(githubLink).toHaveAttribute('href', 'https://github.com/ekstanley/LTI');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
