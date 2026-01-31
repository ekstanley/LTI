/**
 * Legislators route error boundary
 * Handles errors in /legislators and /legislators/[id] routes
 */

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LegislatorsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Legislators route error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-lg font-semibold text-red-900">
          Failed to load legislators
        </h2>
        <p className="mt-2 max-w-md text-sm text-red-700">
          {error.message || 'Unable to retrieve legislator information. Please try again.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-red-500">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
