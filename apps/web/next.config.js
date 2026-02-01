/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ltip/shared'],
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bioguide.congress.gov',
        pathname: '/bioguide/photo/**',
      },
      {
        protocol: 'https',
        hostname: 'theunitedstates.io',
        pathname: '/images/congress/**',
      },
    ],
  },
  async headers() {
    // Note: CSP header is now set in middleware.ts with per-request nonce
    // Other security headers remain static
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
