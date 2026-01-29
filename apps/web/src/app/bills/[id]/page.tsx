/**
 * Bill detail page
 * @module app/bills/[id]/page
 */

import type { Metadata } from 'next';
import { BillDetailClient } from './BillDetailClient';

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
 * Bill detail page - renders client component with bill ID.
 */
export default async function BillPage({ params }: BillPageProps) {
  const { id } = await params;

  return <BillDetailClient billId={id} />;
}
