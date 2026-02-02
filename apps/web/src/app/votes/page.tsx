/**
 * Live votes page
 * @module app/votes/page
 */

import type { Metadata } from 'next';

import { VotesPageClient } from './VotesPageClient';

export const metadata: Metadata = {
  title: 'Live Votes | LTIP',
  description: 'Real-time congressional vote tracking and results',
};

/**
 * Votes page - renders client component with live updates.
 */
export default function VotesPage() {
  return <VotesPageClient />;
}
