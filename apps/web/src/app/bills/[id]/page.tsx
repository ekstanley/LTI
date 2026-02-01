/**
 * Bill detail page
 * @module app/bills/[id]/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidBillId } from '@ltip/shared/validation';
import { BillDetailClient } from './BillDetailClient';

interface BillPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BillPageProps): Promise<Metadata> {
  const { id } = await params;

  // Validate ID format before generating metadata
  if (!isValidBillId(id)) {
    return {
      title: 'Bill Not Found | LTIP',
      description: 'The requested bill could not be found',
    };
  }

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

  // Validate bill ID format - return 404 if invalid
  if (!isValidBillId(id)) {
    notFound();
  }

  return <BillDetailClient billId={id} />;
}
