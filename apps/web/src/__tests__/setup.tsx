/**
 * Test setup file for Vitest
 * Configures Testing Library matchers and global test utilities
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  },
}));

// Mock lucide-react icons to prevent SVG rendering issues
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronsLeft: () => <span data-testid="icon-chevrons-left" />,
  ChevronsRight: () => <span data-testid="icon-chevrons-right" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  Users: () => <span data-testid="icon-users" />,
  Search: () => <span data-testid="icon-search" />,
  Filter: () => <span data-testid="icon-filter" />,
  X: () => <span data-testid="icon-x" />,
  Menu: () => <span data-testid="icon-menu" />,
  Home: () => <span data-testid="icon-home" />,
  FileText: () => <span data-testid="icon-file-text" />,
  User: () => <span data-testid="icon-user" />,
  Vote: () => <span data-testid="icon-vote" />,
  Info: () => <span data-testid="icon-info" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));
