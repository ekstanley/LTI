import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { WebVitals } from '@/components/analytics/WebVitals';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'LTIP - Legislative Tracking Intelligence Platform',
    template: '%s | LTIP',
  },
  description:
    'Track congressional bills with AI-powered unbiased analysis, real-time voting updates, and conflict of interest detection.',
  keywords: [
    'congress',
    'legislation',
    'bills',
    'voting',
    'politics',
    'transparency',
  ],
  authors: [{ name: 'LTIP Team' }],
  openGraph: {
    title: 'LTIP - Legislative Tracking Intelligence Platform',
    description:
      'Track congressional bills with AI-powered unbiased analysis.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <WebVitals />
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
