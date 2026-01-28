import Link from 'next/link';
import type { Bill } from '@ltip/shared';
import {
  formatBillId,
  createBillSlug,
  formatDate,
  formatRelativeTime,
} from '@ltip/shared';
import { BILL_STATUS_LABELS, PARTY_LABELS } from '@ltip/shared';
import { Badge } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { ArrowRight, Users } from 'lucide-react';

interface BillCardProps {
  bill: Bill;
}

export function BillCard({ bill }: BillCardProps) {
  const slug = createBillSlug(bill.billType, bill.billNumber, bill.congressNumber);
  const billId = formatBillId(bill.billType, bill.billNumber, bill.congressNumber);

  const statusLabel = BILL_STATUS_LABELS[bill.status] ?? bill.status;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Bill identifier and status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">{billId}</span>
              <Badge
                variant={
                  bill.status === 'became_law'
                    ? 'success'
                    : bill.status === 'vetoed' || bill.status === 'failed'
                      ? 'error'
                      : bill.status === 'in_committee'
                        ? 'warning'
                        : 'default'
                }
              >
                {statusLabel}
              </Badge>
            </div>

            {/* Title */}
            <h3 className="mt-2 font-semibold text-gray-900 line-clamp-2">
              {bill.shortTitle ?? bill.title}
            </h3>

            {/* Sponsor */}
            {bill.sponsor && (
              <p className="mt-2 text-sm text-gray-600">
                Sponsored by{' '}
                <span className="font-medium">
                  {bill.sponsor.fullName} ({PARTY_LABELS[bill.sponsor.party]}-
                  {bill.sponsor.state})
                </span>
              </p>
            )}

            {/* Latest action */}
            {bill.latestAction && (
              <p className="mt-2 text-sm text-gray-500">
                <span className="font-medium">Latest:</span>{' '}
                {bill.latestAction.text}
                <span className="ml-2 text-gray-400">
                  ({formatRelativeTime(bill.latestAction.date)})
                </span>
              </p>
            )}

            {/* Meta info */}
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {bill.cosponsorsCount} cosponsor
                {bill.cosponsorsCount !== 1 ? 's' : ''}
              </span>
              {bill.policyArea && (
                <Badge variant="default" className="text-xs">
                  {bill.policyArea}
                </Badge>
              )}
              <span>Introduced {formatDate(bill.introducedDate)}</span>
            </div>
          </div>

          {/* View button */}
          <Link
            href={`/bills/${slug}`}
            className="btn-outline flex-shrink-0 self-center"
          >
            View
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
