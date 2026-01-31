/**
 * Legislators listing page
 * @module app/legislators/page
 */

import type { Metadata } from 'next';
import { LegislatorsPageClient } from './LegislatorsPageClient';

export const metadata: Metadata = {
  title: 'Legislators | LTIP',
  description: 'Browse members of Congress with voting records and analysis',
};

/**
 * Legislators page - renders client component with filters and list.
 */
export default function LegislatorsPage() {
  return <LegislatorsPageClient />;
}
