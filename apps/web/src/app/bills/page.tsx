/**
 * Bills listing page
 * @module app/bills/page
 */

import type { Metadata } from 'next';

import { BillsPageClient } from './BillsPageClient';

export const metadata: Metadata = {
  title: 'Bills | LTIP',
  description: 'Browse and search congressional bills with AI-powered analysis',
};

/**
 * Bills page with server-side metadata and client-side interactivity.
 * Uses SWR for data fetching with caching and revalidation.
 */
export default function BillsPage() {
  return <BillsPageClient />;
}
