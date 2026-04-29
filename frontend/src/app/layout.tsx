import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://e-numerak.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    template: '%s | E-Numerak',
  },
  description:
    'E-Numerak — Generate, validate & submit FTA-compliant tax invoices in the UAE. PEPPOL BIS 3.0, UBL 2.1, VAT & Excise ready. The complete e-invoicing SaaS platform for UAE businesses.',
  keywords: [
    'UAE e-invoicing',
    'FTA compliant invoicing',
    'FTA e-invoicing 2024',
    'e-invoice UAE Federal Decree Law 16',
    'PEPPOL e-invoicing UAE',
    'PEPPOL BIS 3.0 UAE',
    'UAE tax invoice software',
    'e-invoice generator UAE',
    'UBL 2.1 UAE',
    'VAT invoicing UAE',
    'UAE digital invoice platform',
    'E-Numerak',
    'UAE ASP accredited platform',
    'Dubai e-invoicing software',
    'FTA PEPPOL network UAE',
  ],
  authors: [{ name: 'E-Numerak', url: SITE_URL }],
  creator: 'E-Numerak',
  publisher: 'E-Numerak',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    url: SITE_URL,
    siteName: 'E-Numerak',
    title: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    description:
      'The complete PEPPOL-compliant e-invoicing platform for UAE businesses. Generate, validate, and submit tax invoices directly to the FTA — all in one place.',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'E-Numerak — UAE E-Invoicing Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@enumerak',
    title: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    description:
      'Generate, validate & submit FTA-compliant tax invoices in the UAE. PEPPOL BIS 3.0 ready. Start for free.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: SITE_URL },
  category: 'business software',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/favicon.svg' }],
    shortcut: '/favicon.svg',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

const JSON_LD_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'E-Numerak',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/favicon.svg`,
    width: 64,
    height: 64,
  },
  description:
    'FTA-certified UAE e-invoicing platform. Generate, validate, and submit PEPPOL BIS 3.0 compliant tax invoices directly to the Federal Tax Authority.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Dubai',
    addressRegion: 'Dubai',
    addressCountry: 'AE',
  },
  areaServed: {
    '@type': 'Country',
    name: 'United Arab Emirates',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${SITE_URL}/contact`,
    availableLanguage: 'English',
  },
};

const JSON_LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'E-Numerak',
  url: SITE_URL,
  description: 'UAE FTA-compliant e-invoicing platform. PEPPOL BIS 3.0, UBL 2.1, VAT & Excise ready.',
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const JSON_LD_SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'E-Numerak',
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'AED',
    description: 'Free plan available. Contact for enterprise pricing.',
  },
  description:
    'E-Numerak is a UAE FTA-compliant SaaS platform for generating, validating, and submitting e-invoices via the PEPPOL BIS 3.0 network.',
  screenshot: `${SITE_URL}/opengraph-image.png`,
  featureList: [
    'FTA-compliant tax invoice generation',
    'PEPPOL BIS 3.0 / UBL 2.1 format',
    'ASP validation and digital signing',
    'Automatic FTA reporting (Corner 5)',
    'Multi-company support',
    'Role-based access control',
    'Buyer portal with payment tracking',
  ],
  publisher: { '@id': `${SITE_URL}/#organization` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_ORGANIZATION) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_SOFTWARE) }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
