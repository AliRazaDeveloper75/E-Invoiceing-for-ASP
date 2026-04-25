import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://e-numerak.ae';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    template: '%s | E-Numerak',
  },
  description:
    'Generate, validate & submit FTA-compliant tax invoices in the UAE. PEPPOL BIS 3.0, UBL 2.1, VAT & Excise ready. The complete e-invoicing platform for UAE businesses.',
  keywords: [
    'UAE e-invoicing',
    'FTA compliant invoicing',
    'PEPPOL e-invoicing UAE',
    'UAE tax invoice software',
    'e-invoice generator UAE',
    'FTA e-invoicing 2024',
    'PEPPOL BIS 3.0',
    'UBL 2.1 UAE',
    'VAT invoicing UAE',
    'e-invoicing Federal Decree-Law 16 2024',
    'UAE e-invoice platform',
    'E-Numerak',
  ],
  authors: [{ name: 'E-Numerak', url: SITE_URL }],
  creator: 'E-Numerak',
  publisher: 'E-Numerak',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    url: SITE_URL,
    siteName: 'E-Numerak',
    title: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    description:
      'The complete PEPPOL-compliant e-invoicing platform for UAE businesses. Generate, validate, and submit tax invoices directly to the FTA.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'E-Numerak — UAE E-Invoicing Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    description:
      'Generate, validate & submit FTA-compliant tax invoices in the UAE. PEPPOL BIS 3.0 ready.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: 'business software',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.svg',
  },
};

const JSON_LD_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'E-Numerak',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    'FTA-certified UAE e-invoicing platform. Generate, validate, and submit PEPPOL BIS 3.0 compliant tax invoices.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Dubai',
    addressCountry: 'AE',
  },
  sameAs: [],
};

const JSON_LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'E-Numerak',
  url: SITE_URL,
  description: 'UAE FTA-compliant e-invoicing platform. PEPPOL BIS 3.0, UBL 2.1, VAT & Excise ready.',
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
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
