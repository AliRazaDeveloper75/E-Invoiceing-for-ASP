import type { Metadata } from 'next';
import { AboutContent } from './AboutContent';

export const metadata: Metadata = {
  title: 'About E-Numerak | UAE E-Invoicing for FTA Compliance',
  description:
    'E-Numerak simplifies UAE e-invoicing under Federal Decree-Law No. 16 of 2024. FTA-certified, BIS 3.0, multi-company, role-based access — built for the UAE digital economy.',
  keywords: [
    'about E-Numerak',
    'UAE e-invoicing compliance',
    'FTA certified platform',
    'Federal Decree-Law 16 2024',
    'UAE VAT invoicing',
    'E-Invoice UAE platform',
  ],
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About E-Numerak | UAE E-Invoicing for FTA Compliance',
    description:
      'Built for the UAE digital economy — FTA-certified, BIS 3.0, VAT & Excise compliant e-invoicing platform.',
    url: '/about',
  },
};

export default function AboutPage() {
  return <AboutContent />;
}
