/**
 * Legislator detail page
 * @module app/legislators/[id]/page
 */

import type { Metadata } from 'next';
import { Navigation } from '@/components/common';

interface LegislatorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LegislatorPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Legislator ${id} | LTIP`,
    description: `Profile and voting record for legislator ${id}`,
  };
}

/**
 * Legislator detail page - placeholder for future implementation.
 */
export default async function LegislatorPage({ params }: LegislatorPageProps) {
  const { id } = await params;

  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Legislator Detail</h1>
            <p className="mt-2 text-gray-600">Bioguide ID: {id}</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">
              Legislator profile coming soon. This page will display detailed information,
              voting history, and analysis for this member of Congress.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
