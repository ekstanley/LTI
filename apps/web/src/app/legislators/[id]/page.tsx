/**
 * Legislator detail page
 * @module app/legislators/[id]/page
 */

import { isValidLegislatorId } from '@ltip/shared/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegislatorDetailClient } from './LegislatorDetailClient';

interface LegislatorPageProps {
  params: Promise<{ id: string }>;
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
