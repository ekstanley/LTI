/**
 * Legislator detail page
 * @module app/legislators/[id]/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegislatorDetailClient } from './LegislatorDetailClient';

interface LegislatorPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Validates legislator ID format (Bioguide ID)
 * Example: "A000360"
 * @param id - Legislator ID to validate
 * @returns true if valid, false otherwise
 */
function isValidLegislatorId(id: string): boolean {
  // Format: One uppercase letter followed by 6 digits (Bioguide ID)
  // Examples: A000360, S001198, M001111
  return /^[A-Z][0-9]{6}$/.test(id);
}

export async function generateMetadata({ params }: LegislatorPageProps): Promise<Metadata> {
  const { id } = await params;

  // Validate ID format before generating metadata
  if (!isValidLegislatorId(id)) {
    return {
      title: 'Legislator Not Found | LTIP',
      description: 'The requested legislator could not be found',
    };
  }

  return {
    title: `Legislator ${id} | LTIP`,
    description: `Profile and voting record for legislator ${id}`,
  };
}

/**
 * Legislator detail page - renders client component with legislator ID.
 */
export default async function LegislatorPage({ params }: LegislatorPageProps) {
  const { id } = await params;

  // Validate legislator ID format - return 404 if invalid
  if (!isValidLegislatorId(id)) {
    notFound();
  }

  return <LegislatorDetailClient legislatorId={id} />;
}
