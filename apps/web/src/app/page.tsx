import { Search, TrendingUp, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
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
              <Link href="/bills" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Bills
              </Link>
              <Link href="/legislators" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Legislators
              </Link>
              <Link href="/votes" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Live Votes
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search bills..."
                className="input w-64 pl-10"
              />
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                Track Legislation with
                <span className="block text-blue-600">Unbiased Intelligence</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
                AI-powered analysis of congressional bills. Real-time voting updates.
                Transparent conflict of interest detection.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/bills" className="btn-primary">
                  Explore Bills
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/about" className="btn-secondary">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">
                Comprehensive Legislative Intelligence
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Everything you need to understand what Congress is doing
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Search className="h-6 w-6" />}
                title="Bill Tracking"
                description="Search and track any bill with comprehensive summaries and real-time status updates."
              />
              <FeatureCard
                icon={<TrendingUp className="h-6 w-6" />}
                title="AI Analysis"
                description="Unbiased AI analysis showing perspectives from across the political spectrum."
              />
              <FeatureCard
                icon={<Users className="h-6 w-6" />}
                title="Live Voting"
                description="Watch votes happen in real-time with WebSocket-powered instant updates."
              />
              <FeatureCard
                icon={<AlertTriangle className="h-6 w-6" />}
                title="COI Detection"
                description="Transparent detection of potential conflicts of interest for legislators."
              />
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y border-gray-200 bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 text-center md:grid-cols-4">
              <StatCard value="10,000+" label="Bills Tracked" />
              <StatCard value="535" label="Legislators" />
              <StatCard value="24/7" label="Live Updates" />
              <StatCard value="100%" label="Transparent" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-gray-500">
              2025 LTIP. Open source and transparent.
            </p>
            <div className="flex gap-6">
              <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900">
                About
              </Link>
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900">
                Privacy
              </Link>
              <a
                href="https://github.com/ekstanley/LTI"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}
