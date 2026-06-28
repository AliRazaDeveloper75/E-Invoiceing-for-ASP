import type { Metadata } from 'next';
import { HomeContent } from './HomeContent';

export const metadata: Metadata = {
  title: 'E-Numerak — E-Invoicing, Done Right',
  description:
    'E-Numerak is an end-to-end compliance platform that centralizes invoicing across your business. UAE FTA-Certified, E-Invoice Compliant. From invoice creation to FTA Validation — everything unified.',
  keywords: [
    'UAE e-invoicing platform',
    'FTA certified e-invoice',
    'E-Invoice compliant platform UAE',
    'BIS 3.0 UAE',
    'VAT excise invoicing UAE',
    'e-invoicing Federal Decree-Law 16',
    'UAE digital economy invoicing',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'E-Numerak | UAE FTA-Certified, E-Invoice Compliant Platform',
    description:
      "Navigate UAE's e-Invoicing regulations with confidence. E-Numerak delivers full control, visibility, and speed — from invoice creation to FTA Validation.",
    url: '/',
  },
};

export default function HomePage() {
  return <HomeContent />;
}
