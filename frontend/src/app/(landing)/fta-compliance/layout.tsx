import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FTA Compliance | UAE E-Invoicing Requirements - E-Numerak',
  description:
    'Learn how E-Numerak meets UAE FTA e-invoicing requirements under Federal Decree-Law No. 16 — BIS 3.0 format, UBL 2.1, digital signing, and 5-corner model compliance.',
  keywords: [
    'FTA e-invoicing compliance UAE',
    'UAE Federal Tax Authority e-invoice',
    'BIS 3.0 UBL 2.1 compliance',
    '5-corner e-invoicing model UAE',
    'E-Numerak FTA certified',
  ],
  alternates: { canonical: '/fta-compliance' },
  openGraph: {
    title: 'FTA Compliance | UAE E-Invoicing Requirements - E-Numerak',
    description:
      'Learn how E-Numerak meets UAE FTA e-invoicing requirements under Federal Decree-Law No. 16 — BIS 3.0, digital signing, and 5-corner model.',
    url: '/fta-compliance',
  },
};

export default function FtaComplianceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
