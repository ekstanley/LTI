/**
 * Bill detail page
 * @module app/bills/[id]/page
 */

import type { Metadata } from 'next';
import { Navigation } from '@/components/common';

interface BillPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BillPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Bill ${id} | LTIP`,
    description: `Analysis and details for bill ${id}`,
  };
}

/**
 * Bill detail page - placeholder for future implementation.
 */
export default async function BillPage({ params }: BillPageProps) {
  const { id } = await params;

  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bill Detail</h1>
            <p className="mt-2 text-gray-600">Bill ID: {id}</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-500">
              Bill detail page coming soon. This page will display the full bill text,
              AI-powered analysis, bias scoring, and voting predictions.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
