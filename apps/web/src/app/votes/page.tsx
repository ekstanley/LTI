/**
 * Live votes page
 * @module app/votes/page
 */

import type { Metadata } from 'next';
import { Navigation } from '@/components/common';

export const metadata: Metadata = {
  title: 'Live Votes | LTIP',
  description: 'Real-time congressional vote tracking and results',
};

/**
 * Votes page - placeholder for future implementation.
 */
export default function VotesPage() {
  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Live Votes</h1>
            <p className="mt-2 text-gray-600">
              Real-time tracking of congressional votes
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">
              Live voting display coming soon. This page will show real-time vote tallies
              and individual legislator positions via WebSocket updates.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
