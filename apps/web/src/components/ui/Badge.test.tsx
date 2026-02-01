/**
 * Tests for Badge component
 * @module components/ui/Badge.test
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, type BadgeVariant } from './Badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Content</Badge>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('applies success variant styles', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('applies warning variant styles', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('applies error variant styles', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('applies info variant styles', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('applies dem (Democrat) variant styles', () => {
    render(<Badge variant="dem">D</Badge>);
    const badge = screen.getByText('D');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('applies rep (Republican) variant styles', () => {
    render(<Badge variant="rep">R</Badge>);
    const badge = screen.getByText('R');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('applies ind (Independent) variant styles', () => {
    render(<Badge variant="ind">I</Badge>);
    const badge = screen.getByText('I');
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
  });

  it('merges custom className with base styles', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('badge', 'custom-class');
  });

  it('renders as a span element', () => {
    render(<Badge>Span</Badge>);
    const badge = screen.getByText('Span');
    expect(badge.tagName).toBe('SPAN');
  });

  const variants: BadgeVariant[] = [
    'default',
    'success',
    'warning',
    'error',
    'info',
    'dem',
    'rep',
    'ind',
  ];

  it.each(variants)('applies badge class for variant: %s', (variant) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    const badge = screen.getByText(variant);
    expect(badge).toHaveClass('badge');
  });
});
