/**
 * Privacy policy page
 * @module app/privacy/page
 */

import type { Metadata } from 'next';
import { Navigation } from '@/components/common';

export const metadata: Metadata = {
  title: 'Privacy Policy | LTIP',
  description: 'Privacy policy for the Legislative Transparency Intelligence Platform',
};

/**
 * Privacy policy page.
 */
export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-500 mb-6">Last updated: January 2025</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Overview</h2>
            <p className="text-gray-600 mb-4">
              The Legislative Transparency Intelligence Platform (LTIP) is committed to
              protecting your privacy. This policy explains how we collect, use, and
              protect your information.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Information We Collect</h2>
            <p className="text-gray-600 mb-4">
              LTIP may collect basic usage analytics to improve the service. We do not
              require user accounts and do not collect personal identifying information
              for basic browsing.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Data Sources</h2>
            <p className="text-gray-600 mb-4">
              All legislative data displayed on LTIP comes from public government sources.
              We do not collect or store any private legislative information.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Cookies</h2>
            <p className="text-gray-600 mb-4">
              We may use essential cookies to improve site functionality. No tracking
              cookies are used for advertising purposes.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Contact</h2>
            <p className="text-gray-600 mb-4">
              For privacy concerns, please contact us through our GitHub repository.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
