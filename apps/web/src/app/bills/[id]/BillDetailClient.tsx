/**
 * Bill detail client component with real API connection
 * @module app/bills/[id]/BillDetailClient
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Users, FileText, Building2, Tag } from 'lucide-react';
import { useBill } from '@/hooks';
import { Navigation, LoadingState, ErrorFallback } from '@/components/common';
import {
  BILL_TYPES,
  BILL_STATUS_LABELS,
  BILL_STATUS_COLORS,
  PARTY_LABELS,
  PARTY_TEXT_COLORS,
  CHAMBER_SHORT_LABELS,
} from '@ltip/shared';
import type { Bill, BillType, BillStatus, Party, Chamber } from '@ltip/shared';

interface BillDetailClientProps {
  billId: string;
}

/**
 * Format bill ID for display (e.g., "hr-1-119" -> "H.R. 1")
 */
function formatBillId(bill: Bill): string {
  const typeLabels: Record<BillType, string> = {
    hr: 'H.R.',
    s: 'S.',
    hjres: 'H.J.Res.',
    sjres: 'S.J.Res.',
    hconres: 'H.Con.Res.',
    sconres: 'S.Con.Res.',
    hres: 'H.Res.',
    sres: 'S.Res.',
  };
  return `${typeLabels[bill.billType]} ${bill.billNumber}`;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: BillStatus }) {
  const label = BILL_STATUS_LABELS[status] ?? status;
  const colors = BILL_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors}`}>
      {label}
    </span>
  );
}

/**
 * Info card component for displaying bill metadata
 */
function InfoCard({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="text-gray-900">{children}</div>
    </div>
  );
}

export function BillDetailClient({ billId }: BillDetailClientProps) {
  const { bill, isLoading, error, mutate } = useBill(billId);

  return (
    <>
      <Navigation />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/bills"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Bills
          </Link>

          {/* Error state */}
          {error && (
            <ErrorFallback
              error={error}
              title="Failed to load bill"
              onRetry={() => mutate()}
            />
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <LoadingState message="Loading bill details..." size="lg" fullPage />
          )}

          {/* Not found state */}
          {!isLoading && !error && !bill && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Bill not found</h3>
              <p className="mt-2 text-gray-500">
                The bill you&apos;re looking for doesn&apos;t exist or may have been removed.
              </p>
              <Link href="/bills" className="btn-primary mt-4 inline-block">
                Browse All Bills
              </Link>
            </div>
          )}

          {/* Bill details */}
          {!isLoading && !error && bill && (
            <>
              {/* Header */}
              <div className="mb-8">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-500">
                    {BILL_TYPES[bill.billType]} &middot; {bill.congressNumber}th Congress
                  </span>
                  <StatusBadge status={bill.status} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {formatBillId(bill)}
                </h1>
                <p className="text-xl text-gray-600">
                  {bill.shortTitle ?? bill.title}
                </p>
                {bill.shortTitle && bill.shortTitle !== bill.title && (
                  <p className="mt-2 text-sm text-gray-500">{bill.title}</p>
                )}
              </div>

              {/* Info grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                {/* Sponsor */}
                <InfoCard icon={Users} label="Sponsor">
                  {bill.sponsor ? (
                    <Link
                      href={`/legislators/${bill.sponsor.id}`}
                      className="hover:underline"
                    >
                      <span className={PARTY_TEXT_COLORS[bill.sponsor.party as Party] ?? 'text-gray-900'}>
                        {bill.sponsor.fullName}
                      </span>
                      <span className="text-gray-500 ml-1">
                        ({PARTY_LABELS[bill.sponsor.party as Party]?.[0] ?? bill.sponsor.party}-
                        {bill.sponsor.state})
                      </span>
                    </Link>
                  ) : (
                    <span className="text-gray-500">Not available</span>
                  )}
                </InfoCard>

                {/* Chamber */}
                <InfoCard icon={Building2} label="Originating Chamber">
                  {CHAMBER_SHORT_LABELS[bill.chamber as Chamber] ?? bill.chamber}
                </InfoCard>

                {/* Introduced */}
                <InfoCard icon={Calendar} label="Introduced">
                  {formatDate(bill.introducedDate)}
                </InfoCard>

                {/* Cosponsors */}
                <InfoCard icon={Users} label="Cosponsors">
                  {bill.cosponsorsCount} {bill.cosponsorsCount === 1 ? 'cosponsor' : 'cosponsors'}
                </InfoCard>

                {/* Policy Area */}
                {bill.policyArea && (
                  <InfoCard icon={Tag} label="Policy Area">
                    {bill.policyArea}
                  </InfoCard>
                )}
              </div>

              {/* Latest Action */}
              {bill.latestAction && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Action</h2>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        {formatDate(bill.latestAction.date)}
                        {bill.latestAction.chamber && (
                          <span className="ml-2">
                            &middot; {CHAMBER_SHORT_LABELS[bill.latestAction.chamber as Chamber] ?? bill.latestAction.chamber}
                          </span>
                        )}
                      </p>
                      <p className="text-gray-900">{bill.latestAction.text}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Subjects */}
              {bill.subjects && bill.subjects.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Subjects</h2>
                  <div className="flex flex-wrap gap-2">
                    {bill.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* External link */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Full Bill Text</h2>
                <p className="text-gray-600 mb-4">
                  View the complete bill text and legislative history on Congress.gov.
                </p>
                <a
                  href={`https://www.congress.gov/bill/${bill.congressNumber}th-congress/${bill.chamber === 'house' ? 'house' : 'senate'}-bill/${bill.billNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View on Congress.gov
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
