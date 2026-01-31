/**
 * Bill detail page
 * @module app/bills/[id]/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BillDetailClient } from './BillDetailClient';

interface BillPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Validates bill ID format: billType-billNumber-congressNumber
 * Example: "hr-1234-118"
 * @param id - Bill ID to validate
 * @returns true if valid, false otherwise
 */
function isValidBillId(id: string): boolean {
  // Format: billType (letters) - billNumber (digits) - congressNumber (digits)
  // Examples: hr-1234-118, s-567-119, hjres-45-118
  return /^[a-z]+(-[0-9]+){2}$/.test(id);
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
