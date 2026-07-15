import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | E-Numerak UAE E-Invoicing',
  description:
    'Read the Terms of Service for E-Numerak — covering account responsibilities, subscription fees, intellectual property, and liability terms for the UAE e-invoicing platform.',
  keywords: [
    'E-Numerak terms of service',
    'UAE e-invoicing terms',
    'FTA e-invoice platform terms',
    'E-Invoice service agreement UAE',
    'UAE tax software terms',
  ],
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | E-Numerak UAE E-Invoicing',
    description:
      'Read the Terms of Service for E-Numerak — covering account responsibilities, subscription fees, intellectual property, and liability terms for the UAE e-invoicing platform.',
    url: '/terms',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
