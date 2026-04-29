/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },

  // Security + SEO headers
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/:path*\\.(:ext(svg|png|jpg|jpeg|webp|ico|woff|woff2))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',            value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Noindex for sensitive auth + all private/app routes (login & register intentionally excluded)
        source: '/(forgot-password|reset-password|verify-email|activate|mfa-verify|mfa-setup|dashboard|invoices|customers|companies|settings|management|inbound|buyer)(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
