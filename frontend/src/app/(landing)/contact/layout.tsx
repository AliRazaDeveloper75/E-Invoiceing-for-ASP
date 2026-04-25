import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact E-Numerak | UAE E-Invoicing Support',
  description:
    'Get in touch with E-Numerak for UAE e-invoicing questions — FTA compliance, PEPPOL integration, platform support, and demo requests. Dubai, UAE.',
  keywords: [
    'contact UAE e-invoicing',
    'E-Numerak support',
    'FTA compliance help UAE',
    'PEPPOL integration UAE',
    'UAE invoice platform demo',
  ],
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact E-Numerak | UAE E-Invoicing Support',
    description:
      'Questions about UAE FTA e-invoicing compliance or PEPPOL integration? Our team in Dubai is here to help.',
    url: '/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
