/**
 * Legislator detail client component with real API connection
 * @module app/legislators/[id]/LegislatorDetailClient
 */

'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  Phone,
  Globe,
  Twitter,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useLegislator } from '@/hooks';
import { Navigation, LoadingState, ErrorFallback } from '@/components/common';
import {
  PARTY_LABELS,
  PARTY_COLORS,
  PARTY_TEXT_COLORS,
  CHAMBER_LABELS,
  US_STATES,
} from '@ltip/shared';
import type { Party, Chamber } from '@ltip/shared';

interface LegislatorDetailClientProps {
  legislatorId: string;
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
 * Info card component for displaying legislator metadata
 */
function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
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

/**
 * Contact link component
 */
function ContactLink({
  icon: Icon,
  label,
  href,
  external = false,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  external?: boolean;
}) {
  const isExternal = external || href.startsWith('http');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}

export function LegislatorDetailClient({ legislatorId }: LegislatorDetailClientProps) {
  const { legislator, isLoading, error, mutate } = useLegislator(legislatorId);

  return (
    <>
      <Navigation />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/legislators"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Legislators
          </Link>

          {/* Error state */}
          {error && (
            <ErrorFallback
              error={error}
              title="Failed to load legislator"
              onRetry={() => mutate()}
            />
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <LoadingState message="Loading legislator details..." size="lg" fullPage />
          )}

          {/* Not found state */}
          {!isLoading && !error && !legislator && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Legislator not found</h3>
              <p className="mt-2 text-gray-500">
                The legislator you&apos;re looking for doesn&apos;t exist or may have been removed.
              </p>
              <Link href="/legislators" className="btn-primary mt-4 inline-block">
                Browse All Legislators
              </Link>
            </div>
          )}

          {/* Legislator details */}
          {!isLoading && !error && legislator && (
            <>
              {/* Header */}
              <div className="mb-8 flex flex-col sm:flex-row sm:items-start gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {legislator.imageUrl ? (
                    <img
                      src={legislator.imageUrl}
                      alt={legislator.fullName}
                      className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div
                      className={`flex h-32 w-32 items-center justify-center rounded-full ${
                        PARTY_COLORS[legislator.party as Party] ?? 'bg-gray-600'
                      } text-white text-4xl font-bold border-4 border-white shadow-lg`}
                    >
                      {legislator.firstName[0]}
                      {legislator.lastName[0]}
                    </div>
                  )}
                </div>

                {/* Name and basic info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`text-sm font-medium ${
                        PARTY_TEXT_COLORS[legislator.party as Party] ?? 'text-gray-600'
                      }`}
                    >
                      {PARTY_LABELS[legislator.party as Party] ?? legislator.party}
                    </span>
                    {!legislator.inOffice && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Former Member
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">{legislator.fullName}</h1>
                  <p className="mt-2 text-xl text-gray-600">
                    {CHAMBER_LABELS[legislator.chamber as Chamber] ?? legislator.chamber}
                    {' \u2022 '}
                    {US_STATES[legislator.state as keyof typeof US_STATES] ?? legislator.state}
                    {legislator.district && ` \u2022 District ${legislator.district}`}
                  </p>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                {/* Chamber */}
                <InfoCard icon={Building2} label="Chamber">
                  {CHAMBER_LABELS[legislator.chamber as Chamber] ?? legislator.chamber}
                </InfoCard>

                {/* State */}
                <InfoCard icon={MapPin} label="State">
                  {US_STATES[legislator.state as keyof typeof US_STATES] ?? legislator.state}
                  {legislator.district && `, District ${legislator.district}`}
                </InfoCard>

                {/* Term */}
                <InfoCard icon={Calendar} label="Current Term">
                  {formatDate(legislator.termStart)}
                  {legislator.termEnd && ` - ${formatDate(legislator.termEnd)}`}
                </InfoCard>

                {/* Bioguide ID */}
                <InfoCard icon={Users} label="Bioguide ID">
                  <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                    {legislator.bioguideId}
                  </code>
                </InfoCard>
              </div>

              {/* Contact Information */}
              {(legislator.phone || legislator.website || legislator.twitter) && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
                  <div className="space-y-3">
                    {legislator.phone && (
                      <ContactLink
                        icon={Phone}
                        label={legislator.phone}
                        href={`tel:${legislator.phone.replace(/[^\d]/g, '')}`}
                      />
                    )}
                    {legislator.website && (
                      <ContactLink
                        icon={Globe}
                        label="Official Website"
                        href={legislator.website}
                        external
                      />
                    )}
                    {legislator.twitter && (
                      <ContactLink
                        icon={Twitter}
                        label={`@${legislator.twitter}`}
                        href={`https://twitter.com/${legislator.twitter}`}
                        external
                      />
                    )}
                  </div>
                </div>
              )}

              {/* External links */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Official Congressional Profile
                </h2>
                <p className="text-gray-600 mb-4">
                  View the complete profile, voting record, and sponsored legislation on
                  Congress.gov.
                </p>
                <a
                  href={`https://www.congress.gov/member/${legislator.fullName
                    .toLowerCase()
                    .replace(/\s+/g, '-')}/${legislator.bioguideId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
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
