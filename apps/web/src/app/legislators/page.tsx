/**
 * Legislators listing page
 * @module app/legislators/page
 */

import type { Metadata } from 'next';
import { Navigation } from '@/components/common';

export const metadata: Metadata = {
  title: 'Legislators | LTIP',
  description: 'Browse members of Congress with voting records and analysis',
};

/**
 * Legislators page - placeholder for future implementation.
 */
export default function LegislatorsPage() {
  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Legislators</h1>
            <p className="mt-2 text-gray-600">
              Browse members of Congress from the 119th Congress
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">
              Legislators list coming soon. This page will display searchable and filterable
              information about current members of Congress.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
