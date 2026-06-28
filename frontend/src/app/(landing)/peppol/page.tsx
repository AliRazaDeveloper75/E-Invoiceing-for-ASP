import type { Metadata } from 'next';
import { PeppolContent } from './PeppolContent';

export const metadata: Metadata = {
  title: '5-Corner E-Invoicing UAE | UBL 2.1 & FTA Network',
  description:
    'Learn how the 5-corner model works for UAE e-invoicing. E-Numerak acts as Corner 1 — generating UBL 2.1 XML invoices for FTA submission via UAE-accredited ASPs.',
  keywords: [
    '5-corner UAE',
    'E-Invoice e-invoicing model',
    'UBL 2.1 XML UAE',
    'FTA E-Invoice network',
    'UAE ASP accredited service provider',
    'E-Invoice BIS billing 3.0',
    'e-invoice FTA submission',
  ],
  alternates: { canonical: '/peppol' },
  openGraph: {
    title: '5-Corner E-Invoicing UAE | E-Numerak',
    description:
      'Full 5-corner model for UAE e-invoicing — from your ERP (Corner 1) through the ASP to the FTA network (Corner 5).',
    url: '/peppol',
  },
};

export default function PeppolPage() {
  return <PeppolContent />;
}
