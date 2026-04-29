import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://e-numerak.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // All crawlers: index public pages + login/register (brand searches)
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/services',
          '/peppol',
          '/contact',
          '/login',
          '/register',
        ],
        disallow: [
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/activate',
          '/mfa-verify',
          '/mfa-setup',
          '/dashboard',
          '/invoices',
          '/customers',
          '/companies',
          '/settings',
          '/management',
          '/inbound',
          '/supplier-portal',
          '/buyer/',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
