import Link from 'next/link';
import { ArrowRight, Target, Users, Shield, Award } from 'lucide-react';

const TEAM_VALUES = [
  { icon: <Target className="h-5 w-5" />,  title: 'Mission',    desc: 'Simplify UAE e-invoicing compliance for businesses of all sizes through modern, developer-friendly tooling.' },
  { icon: <Users className="h-5 w-5" />,   title: 'For Teams',  desc: 'Multi-user, role-based access (Admin, Accountant, Viewer) so your entire finance team works in one place.' },
  { icon: <Shield className="h-5 w-5" />,  title: 'Security',   desc: 'JWT authentication, company-scoped data isolation, and audit trails on every invoice action.' },
  { icon: <Award className="h-5 w-5" />,   title: 'Certified',  desc: 'Built against the FTA Tax Accounting Software Certification Guidelines for VAT and Excise Tax audit files.' },
];

const TIMELINE = [
  { year: '2017', event: 'UAE Federal Decree-Law No. 8 — VAT introduced at 5%' },
  { year: '2019', event: 'VAT implementation — businesses required to register' },
  { year: '2022', event: 'Excise Tax expanded — energy drinks, tobacco, carbonated beverages' },
  { year: '2024', event: 'Federal Decree-Law No. 16 — e-invoicing mandated' },
  { year: '2026', event: 'Phase 1 PEPPOL B2B/B2G e-invoicing goes live' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">About Us</p>
            <h1 className="text-4xl font-bold mb-4">Built for the UAE Digital Economy</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              We built the UAE E-Invoicing Platform to make FTA compliance straightforward —
              removing the complexity so businesses can focus on growth, not paperwork.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">What Drives Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEAM_VALUES.map((v) => (
              <div key={v.title} className="flex gap-4 p-6 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1e3a5f] text-white shrink-0">
                  {v.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UAE E-Invoicing Timeline */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">UAE Tax & E-Invoicing Timeline</h2>
          <div className="relative border-l-2 border-[#1e3a5f] ml-4 space-y-8">
            {TIMELINE.map((t) => (
              <div key={t.year} className="relative pl-8">
                <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-[#1e3a5f] border-2 border-white" />
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t.year}</span>
                <p className="text-sm text-gray-700 mt-1">{t.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Start Issuing Compliant Invoices</h2>
        <p className="text-gray-500 mb-8">Everything set up. Just log in and create your first invoice.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white font-semibold text-sm transition-colors">
          E-Invoice Portal <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
