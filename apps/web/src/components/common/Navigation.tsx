/**
 * Main navigation component for the application
 * @module components/common/Navigation
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu, X, FileText, Users, Vote, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface NavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
}

const navLinks: NavLink[] = [
  { href: '/bills', label: 'Bills', icon: FileText },
  { href: '/legislators', label: 'Legislators', icon: Users },
  { href: '/votes', label: 'Live Votes', icon: Vote },
];

/**
 * Main application navigation with responsive mobile menu.
 *
 * @example
 * ```tsx
 * <Navigation />
 * ```
 */
export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-gray-900">
            LTIP
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex md:gap-6">
            {navLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href as '/bills' | '/legislators' | '/votes'}
                label={link.label}
                isActive={pathname === link.href || pathname?.startsWith(`${link.href}/`)}
              />
            ))}
          </div>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href as '/bills' | '/legislators' | '/votes'}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

interface NavItemProps {
  href: '/bills' | '/legislators' | '/votes';
  label: string;
  isActive?: boolean;
}

function NavItem({ href, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'text-sm font-medium transition-colors',
        isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {label}
    </Link>
  );
}
