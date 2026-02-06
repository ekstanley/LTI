/**
 * Tests for ContactLink component
 * @module components/legislators/__tests__/ContactLink.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactLink } from '../ContactLink';
import { Globe, Phone, Mail } from 'lucide-react';

describe('ContactLink', () => {
  it('should render link with label', () => {
    render(
      <ContactLink
        icon={Globe}
        label="Official Website"
        href="https://example.com"
      />
    );

    expect(screen.getByText('Official Website')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('should render external link with target="_blank" and rel attributes', () => {
    render(
      <ContactLink
        icon={Globe}
        label="External Website"
        href="https://example.com"
        external
      />
    );

    const link = screen.getByRole('link', { name: /External Website/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should auto-detect external links by http/https protocol', () => {
    render(
      <ContactLink
        icon={Globe}
        label="Auto External"
        href="https://example.com"
      />
    );

    const link = screen.getByRole('link', { name: /Auto External/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render internal link without target="_blank"', () => {
    render(
      <ContactLink
        icon={Phone}
        label="Contact Form"
        href="/contact"
      />
    );

    const link = screen.getByRole('link', { name: /Contact Form/i });
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('href', '/contact');
  });

  it('should apply correct styling classes', () => {
    render(
      <ContactLink
        icon={Globe}
        label="Styled Link"
        href="https://example.com"
      />
    );

    const link = screen.getByRole('link', { name: /Styled Link/i });
    expect(link).toHaveClass('flex');
    expect(link).toHaveClass('items-center');
    expect(link).toHaveClass('gap-2');
    expect(link).toHaveClass('text-blue-600');
    expect(link).toHaveClass('hover:text-blue-800');
    expect(link).toHaveClass('hover:underline');
  });

  it('should handle mailto protocol as internal link', () => {
    render(
      <ContactLink
        icon={Mail}
        label="Email"
        href="mailto:test@example.com"
      />
    );

    const link = screen.getByRole('link', { name: /Email/i });
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('href', 'mailto:test@example.com');
  });

  it('should handle tel protocol as internal link', () => {
    render(
      <ContactLink
        icon={Phone}
        label="Phone"
        href="tel:123-456-7890"
      />
    );

    const link = screen.getByRole('link', { name: /Phone/i });
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('href', 'tel:123-456-7890');
  });

  it('should treat http links as external even without explicit prop', () => {
    render(
      <ContactLink
        icon={Globe}
        label="HTTP Link"
        href="http://example.com"
      />
    );

    const link = screen.getByRole('link', { name: /HTTP Link/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render with different icon components', () => {
    const { rerender } = render(
      <ContactLink
        icon={Globe}
        label="Website"
        href="https://example.com"
      />
    );

    expect(screen.getByText('Website')).toBeInTheDocument();

    rerender(
      <ContactLink
        icon={Phone}
        label="Phone"
        href="tel:123-456-7890"
      />
    );

    expect(screen.getByText('Phone')).toBeInTheDocument();

    rerender(
      <ContactLink
        icon={Mail}
        label="Email"
        href="mailto:test@example.com"
      />
    );

    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});
