import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://e-numerak.ae';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/services', '/peppol', '/contact'],
        disallow: [
          '/dashboard',
          '/invoices',
          '/customers',
          '/companies',
          '/settings',
          '/management',
          '/inbound',
          '/supplier-portal',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/mfa-verify',
          '/mfa-setup',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
