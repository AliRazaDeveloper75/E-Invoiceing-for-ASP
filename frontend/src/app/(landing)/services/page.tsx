import Link from 'next/link';
import { ArrowRight, FileText, BarChart3, Shield, Download, Zap, Users } from 'lucide-react';

const SERVICES = [
  {
    icon: <FileText className="h-7 w-7" />,
    title: 'Tax Invoice Generation',
    desc: 'Create UAE-compliant Tax Invoices, Credit Notes, Commercial Invoices, and Continuous Supply invoices. PEPPOL UBL 2.1 XML auto-generated on every save.',
    tags: ['Tax Invoice', 'Credit Note', 'Commercial', 'Continuous Supply'],
    color: 'blue',
  },
  {
    icon: <Shield className="h-7 w-7" />,
    title: 'FTA Audit File (FAF)',
    desc: 'Capture all 21 VAT FAF and 32 Excise FAF data elements required under the UAE Tax Accounting Software Certification Guidelines.',
    tags: ['VAT FAF', 'Excise FAF', 'GL/ID', 'Permit Numbers', 'Reverse Charges'],
    color: 'emerald',
  },
  {
    icon: <Zap className="h-7 w-7" />,
    title: 'Real-Time Validation',
    desc: 'Invoice header, line items, totals, TRN, and credit note references all validated before submission — errors surfaced instantly.',
    tags: ['Header Validation', 'TRN Check', 'VAT Calculation', 'Error Reporting'],
    color: 'amber',
  },
  {
    icon: <Download className="h-7 w-7" />,
    title: 'PDF & XML Export',
    desc: 'Download human-readable PDF invoices (xhtml2pdf) and machine-readable PEPPOL UBL XML files for any invoice in any status.',
    tags: ['PDF Download', 'UBL XML', 'A4 Format', 'On-Demand'],
    color: 'purple',
  },
  {
    icon: <BarChart3 className="h-7 w-7" />,
    title: 'VAT & Excise Reporting',
    desc: 'Dashboard with VAT breakdown by rate type (5%, zero, exempt, out-of-scope). Per-invoice VAT summary and company-wide revenue totals.',
    tags: ['VAT Summary', 'Excise Tax', 'Dashboard Stats', 'Revenue Totals'],
    color: 'rose',
  },
  {
    icon: <Users className="h-7 w-7" />,
    title: 'Multi-Company & Team Access',
    desc: 'Manage multiple companies under one account. Invite team members with granular role-based permissions (Admin, Accountant, Viewer).',
    tags: ['Multi-Company', 'Role-Based', 'Admin', 'Accountant', 'Viewer'],
    color: 'indigo',
  },
];

const COLOR_MAP: Record<string, string> = {
  blue:    'text-blue-600 bg-blue-50 border-blue-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  amber:   'text-amber-600 bg-amber-50 border-amber-100',
  purple:  'text-purple-600 bg-purple-50 border-purple-100',
  rose:    'text-rose-600 bg-rose-50 border-rose-100',
  indigo:  'text-indigo-600 bg-indigo-50 border-indigo-100',
};

const TAG_COLOR: Record<string, string> = {
  blue:    'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
  purple:  'bg-purple-100 text-purple-700',
  rose:    'bg-rose-100 text-rose-700',
  indigo:  'bg-indigo-100 text-indigo-700',
};

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Our Services</p>
            <h1 className="text-4xl font-bold mb-4">Everything for UAE E-Invoicing Compliance</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              A complete stack for generating, validating, and submitting invoices —
              covering all UAE FTA requirements without the complexity.
            </p>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-5 ${COLOR_MAP[s.color]}`}>
                  {s.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((tag) => (
                    <span key={tag} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TAG_COLOR[s.color]}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAF compliance table */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">FAF Field Coverage</h2>
          <p className="text-gray-500 text-sm mb-8">All fields required by UAE Tax Accounting Software Certification Guidelines are captured.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'VAT FAF Fields (21)',
                color: 'border-blue-200 bg-blue-50',
                fields: [
                  'Company name', 'User ID', 'TRN', 'FAF version indicator',
                  'GL/ID', 'Locations of suppliers', 'Reverse charges', 'Locations of customers',
                  'Tax codes', 'Invoice numbers', 'Invoice dates', 'Permit numbers',
                  'Transaction IDs', 'Debit amounts', 'Credit amounts',
                  'VAT amounts (actual currency)', 'VAT amounts (AED)',
                  'Accounts receivable', 'Accounts payable',
                  'Product/service references', 'Description of goods/services',
                ],
              },
              {
                title: 'Excise FAF Extra Fields (11)',
                color: 'border-orange-200 bg-orange-50',
                fields: [
                  'Designated zone (warehouse) identifiers',
                  'Open stock balances (Excise Tax implementation)',
                  'Product codes',
                  'Excise rate per product',
                  'Transaction types',
                  'Details of movement',
                  'Transaction dates',
                  'Tax payment dates',
                  'Duty status of stock',
                  'Stock adjustments (write-offs, losses)',
                  'Physical location of goods',
                ],
              },
            ].map((group) => (
              <div key={group.title} className={`rounded-2xl border p-6 ${group.color}`}>
                <h3 className="font-bold text-gray-800 mb-4">{group.title}</h3>
                <ul className="space-y-2">
                  {group.fields.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#1e3a5f] text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Try the Platform</h2>
        <p className="text-blue-200 mb-8">Create your first invoice in under 2 minutes.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-colors">
          E-Invoice Portal <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
