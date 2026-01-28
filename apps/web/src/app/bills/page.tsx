import Link from 'next/link';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export const metadata = {
  title: 'Bills',
  description: 'Browse and search congressional bills with AI-powered analysis',
};

// Placeholder data until API is connected
const mockBills = [
  {
    id: '1',
    congressNumber: 119,
    billType: 'hr' as const,
    billNumber: 1,
    title: 'American Energy Independence Act',
    shortTitle: 'American Energy Independence Act',
    introducedDate: '2025-01-03',
    status: 'in_committee' as const,
    chamber: 'house' as const,
    cosponsorsCount: 45,
    subjects: ['Energy'],
    policyArea: 'Energy',
    sponsor: {
      id: '1',
      bioguideId: 'S000001',
      firstName: 'John',
      lastName: 'Smith',
      fullName: 'Rep. John Smith',
      party: 'R' as const,
      state: 'TX',
      chamber: 'house' as const,
      inOffice: true,
      termStart: '2023-01-03',
    },
    latestAction: {
      date: '2025-01-15',
      text: 'Referred to the Committee on Energy and Commerce',
    },
    createdAt: '2025-01-03',
    updatedAt: '2025-01-15',
  },
  {
    id: '2',
    congressNumber: 119,
    billType: 's' as const,
    billNumber: 1,
    title: 'Healthcare Access and Affordability Act',
    shortTitle: 'Healthcare Access Act',
    introducedDate: '2025-01-03',
    status: 'introduced' as const,
    chamber: 'senate' as const,
    cosponsorsCount: 23,
    subjects: ['Healthcare'],
    policyArea: 'Health',
    sponsor: {
      id: '2',
      bioguideId: 'J000001',
      firstName: 'Jane',
      lastName: 'Johnson',
      fullName: 'Sen. Jane Johnson',
      party: 'D' as const,
      state: 'CA',
      chamber: 'senate' as const,
      inOffice: true,
      termStart: '2023-01-03',
    },
    latestAction: {
      date: '2025-01-10',
      text: 'Read twice and referred to the Committee on Finance',
    },
    createdAt: '2025-01-03',
    updatedAt: '2025-01-10',
  },
];

export default function BillsPage() {
  return (
    <>
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              LTIP
            </Link>
            <div className="hidden md:flex md:gap-6">
              <Link
                href="/bills"
                className="text-sm font-medium text-blue-600"
              >
                Bills
              </Link>
              <Link
                href="/legislators"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Legislators
              </Link>
              <Link
                href="/votes"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Live Votes
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
            <p className="mt-2 text-gray-600">
              Browse and search congressional legislation from the 119th Congress
            </p>
          </div>

          {/* Search and filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search bills by title, number, or keyword..."
                className="input w-full pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select className="input w-auto">
                <option value="">All Chambers</option>
                <option value="house">House</option>
                <option value="senate">Senate</option>
              </select>
              <select className="input w-auto">
                <option value="">All Statuses</option>
                <option value="introduced">Introduced</option>
                <option value="in_committee">In Committee</option>
                <option value="passed_house">Passed House</option>
                <option value="passed_senate">Passed Senate</option>
                <option value="became_law">Became Law</option>
              </select>
              <button className="btn-outline">
                <Filter className="mr-2 h-4 w-4" />
                More Filters
              </button>
            </div>
          </div>

          {/* Bills list */}
          <div className="space-y-4">
            {mockBills.map((bill) => (
              <BillCardSimple key={bill.id} bill={bill} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">1-2</span> of{' '}
              <span className="font-medium">10,000+</span> bills
            </p>
            <div className="flex gap-2">
              <button className="btn-outline" disabled>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button className="btn-outline">
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// Inline simplified card for now (will use BillCard component when API connected)
function BillCardSimple({
  bill,
}: {
  bill: (typeof mockBills)[0];
}) {
  const billId = `${bill.billType.toUpperCase()} ${bill.billNumber}`;

  return (
    <div className="card p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">
              {billId} (119th)
            </span>
            <span
              className={`badge ${
                bill.status === 'in_committee'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {bill.status === 'in_committee' ? 'In Committee' : 'Introduced'}
            </span>
          </div>

          <h3 className="mt-2 font-semibold text-gray-900">
            {bill.shortTitle}
          </h3>

          {bill.sponsor && (
            <p className="mt-2 text-sm text-gray-600">
              Sponsored by{' '}
              <span className="font-medium">
                {bill.sponsor.fullName} ({bill.sponsor.party}-{bill.sponsor.state})
              </span>
            </p>
          )}

          {bill.latestAction && (
            <p className="mt-2 text-sm text-gray-500">
              <span className="font-medium">Latest:</span> {bill.latestAction.text}
            </p>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span>{bill.cosponsorsCount} cosponsors</span>
            <span className="badge bg-gray-100 text-gray-800">
              {bill.policyArea}
            </span>
          </div>
        </div>

        <Link
          href={`/bills/${bill.billType}-${bill.billNumber}-${bill.congressNumber}`}
          className="btn-outline flex-shrink-0"
        >
          View
        </Link>
      </div>
    </div>
  );
}
