/**
 * Contact link component for displaying legislator contact information
 * @module components/legislators/ContactLink
 */

import { ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Props for ContactLink component
 */
export interface ContactLinkProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Link label text */
  label: string;
  /** Link href URL */
  href: string;
  /** Whether this is an external link (opens in new tab) */
  external?: boolean;
}

/**
 * Contact link component that displays a clickable link with an icon.
 * External links open in a new tab and show an external link indicator.
 *
 * @example
 * ```tsx
 * <ContactLink
 *   icon={Globe}
 *   label="Official Website"
 *   href="https://example.com"
 *   external
 * />
 * ```
 */
export function ContactLink({
  icon: Icon,
  label,
  href,
  external = false,
}: ContactLinkProps) {
  const isExternal = external || href.startsWith('http');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}
