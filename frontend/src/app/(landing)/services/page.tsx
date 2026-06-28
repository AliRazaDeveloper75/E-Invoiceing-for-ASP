import type { Metadata } from 'next';
import { ServicesContent } from './ServicesContent';

export const metadata: Metadata = {
  title: 'E-Invoicing Services | Tax Invoice, FTA Audit Files & E-Invoice',
  description:
    'E-Numerak services: tax invoice generation (UBL 380/381/480), FTA audit files (21 VAT FAF + 32 Excise fields), real-time validation, PDF/XML export, VAT reporting, and multi-company access.',
  keywords: [
    'UAE tax invoice generation',
    'FTA audit file software',
    'VAT FAF UAE',
    'Excise FAF UAE',
    'UBL 2.1 XML',
    'e-invoice PDF export UAE',
    'VAT reporting UAE software',
    'multi-company invoicing UAE',
  ],
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'E-Numerak Services | UAE Tax Invoice & FTA Compliance',
    description:
      'Tax invoice generation, FTA audit files, E-Invoice validation, PDF/XML export, and VAT reporting — fully FTA-compliant.',
    url: '/services',
  },
};

export default function ServicesPage() {
  return <ServicesContent />;
}
