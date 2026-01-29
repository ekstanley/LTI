/**
 * Legislator detail page
 * @module app/legislators/[id]/page
 */

import type { Metadata } from 'next';
import { LegislatorDetailClient } from './LegislatorDetailClient';

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
 * Legislator detail page - renders client component with legislator ID.
 */
export default async function LegislatorPage({ params }: LegislatorPageProps) {
  const { id } = await params;

  return <LegislatorDetailClient legislatorId={id} />;
}
