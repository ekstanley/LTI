/**
 * About page
 * @module app/about/page
 */

import type { Metadata } from 'next';

import { Navigation } from '@/components/common';

export const metadata: Metadata = {
  title: 'About | LTIP',
  description: 'About the Legislative Transparency Intelligence Platform',
};

/**
 * About page with project information.
 */
export default function AboutPage() {
  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About LTIP</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-600 mb-6">
              The Legislative Transparency Intelligence Platform (LTIP) is designed to make
              congressional activity more accessible and understandable to citizens.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Our Mission</h2>
            <p className="text-gray-600 mb-4">
              We believe that informed citizens are essential to a healthy democracy. LTIP uses
              AI-powered analysis to break down complex legislation and help you understand
              how your representatives are voting.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Features</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>Plain-language summaries of congressional bills</li>
              <li>Multi-perspective analysis showing different viewpoints</li>
              <li>Real-time vote tracking with WebSocket updates</li>
              <li>Conflict of interest detection for legislators</li>
              <li>Bill passage probability predictions</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Data Sources</h2>
            <p className="text-gray-600 mb-4">
              LTIP aggregates data from official congressional sources including Congress.gov
              and the Bioguide. Our analysis is generated using advanced AI models.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
