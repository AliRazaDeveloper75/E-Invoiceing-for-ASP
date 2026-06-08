import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, FileCheck, Network, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FTA Compliance | E-Numerak',
  description:
    'How E-Numerak meets UAE Federal Tax Authority (FTA) e-invoicing requirements under Federal Decree-Law No. 16 of 2024 — BIS 3.0, UBL 2.1, and the 5-corner model.',
  alternates: { canonical: '/fta-compliance' },
};

const POINTS: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: <FileCheck className="h-5 w-5" />,
    title: 'BIS 3.0 / UBL 2.1 Format',
    desc: 'Every invoice is generated as a structured UBL 2.1 XML document that conforms to the UAE PINT (Peppol International) billing specification.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Digital Signing',
    desc: 'Invoices are digitally signed with accredited PKI certificates, ensuring authenticity, integrity, and non-repudiation as required by the FTA.',
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: '5-Corner Model',
    desc: 'Invoices are transmitted through an Accredited Service Provider (ASP) and routed to the buyer and the FTA following the UAE 5-corner e-invoicing model.',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Record Retention',
    desc: 'Tax records are retained for the period mandated by UAE law, with full audit trails on every invoice action.',
  },
];

export default function FtaCompliancePage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Compliance</p>
          <h1 className="text-4xl font-bold mb-4">FTA Compliance</h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            E-Numerak is built to meet the UAE Federal Tax Authority&apos;s e-invoicing
            requirements under Federal Decree-Law No. 16 of 2024.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-6">
            {POINTS.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 mb-4">
                  {p.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5">{p.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Regulatory Basis</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              UAE e-invoicing is mandated under Federal Decree-Law No. 16 of 2024. Phase 1
              covers B2B and B2G transactions. E-Numerak generates compliant structured
              invoices, signs them, and transmits them to the FTA through accredited
              service providers — so your business stays compliant without the complexity.
            </p>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-6 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Talk to our compliance team <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
