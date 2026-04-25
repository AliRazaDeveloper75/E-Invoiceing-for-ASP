// Home page is rendered here via the (landing) route group.
// app/page.tsx re-exports this component so both resolve to the same route "/".
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'UAE FTA-Compliant E-Invoicing Platform',
  description:
    'E-Numerak — Generate, validate & submit UAE FTA-compliant tax invoices. PEPPOL BIS 3.0, UBL 2.1, VAT & Excise ready. Start issuing e-invoices today.',
  keywords: [
    'UAE e-invoicing platform',
    'FTA compliant e-invoice',
    'PEPPOL BIS 3.0 UAE',
    'UBL 2.1 invoice UAE',
    'tax invoice generator UAE',
    'VAT invoice software UAE',
    'e-invoicing Federal Decree-Law 16',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'E-Numerak | UAE FTA-Compliant E-Invoicing Platform',
    description:
      'The complete PEPPOL-compliant e-invoicing platform for UAE businesses. Issue, validate, and report tax invoices — all in one place.',
    url: '/',
  },
};
import {
  ArrowRight, CheckCircle2, FileText, Shield, Zap,
  Globe, BarChart3, Lock, ChevronRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'PEPPOL UBL 2.1 XML',
    desc: 'Auto-generate fully compliant e-invoices in PEPPOL BIS 3.0 format, ready for FTA submission.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'FTA Audit File (FAF)',
    desc: 'Capture all 21 VAT FAF and 32 Excise FAF fields required by UAE Tax Accounting Software Certification.',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Real-Time Validation',
    desc: 'Validate invoices against UAE rules before submission — surface errors before the FTA does.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: '5-Corner PEPPOL Flow',
    desc: 'Full visibility from your ERP (Corner 1) through the ASP (Corner 2) to the FTA network (Corner 5).',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'VAT & Excise Reporting',
    desc: 'Automatic 5% VAT with support for zero-rated, exempt, and out-of-scope supplies. Excise ready.',
    color: 'text-rose-600 bg-rose-50',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Role-Based Access',
    desc: 'Admin, Accountant, and Viewer roles with company-scoped data isolation and JWT authentication.',
    color: 'text-indigo-600 bg-indigo-50',
  },
];

const STATS = [
  { value: '5%',   label: 'UAE VAT Rate' },
  { value: '32',   label: 'FAF Data Elements' },
  { value: '5',    label: 'PEPPOL Corners' },
  { value: '100%', label: 'FTA Compliant' },
];

const COMPLIANCE = [
  'Federal Decree-Law No. 16 of 2024 (VAT)',
  'Federal Decree-Law No. 7 of 2017 (Excise)',
  'FTA Tax Accounting Software Certification',
  'PEPPOL BIS Billing 3.0',
  'UBL 2.1 XML Standard',
  'UAE Phase 1 & Phase 2 E-Invoicing',
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1e4080] to-[#0f2147] text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-blue-200 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              UAE FTA Certified &bull; E-Invoicing Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              E-Numerak,{' '}
              <span className="text-blue-300">Done Right.</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 leading-relaxed mb-10 max-w-2xl">
              The complete PEPPOL-compliant e-invoicing platform for UAE businesses.
              Generate, validate, and submit tax invoices directly to the FTA — all in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-lg transition-all"
              >
                Launch E-Invoice Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all"
              >
                View Services <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {['FTA Compliant', 'PEPPOL BIS 3.0', 'VAT & Excise Ready', 'Secure JWT Auth'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 1440 60" className="w-full -mb-1" preserveAspectRatio="none">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-[#1e3a5f]">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything for E-Numerak</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Built specifically for the UAE regulatory landscape — covering VAT, Excise, PEPPOL, and FTA requirements.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for UAE Compliance</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Every invoice is validated against the UAE FTA&apos;s requirements under
                Federal Decree-Law No. 16 of 2024 and PEPPOL BIS Billing 3.0.
              </p>
              <ul className="space-y-3">
                {COMPLIANCE.map((c) => (
                  <li key={c} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white">
              <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-6">Invoice Lifecycle</div>
              {[
                { status: 'DRAFT',     desc: 'Invoice created & editable',       color: 'bg-gray-500' },
                { status: 'PENDING',   desc: 'Submitted for processing',          color: 'bg-amber-500' },
                { status: 'SUBMITTED', desc: 'Sent to ASP (Corner 2)',            color: 'bg-blue-500' },
                { status: 'VALIDATED', desc: 'FTA accepted via Corner 5',         color: 'bg-emerald-500' },
                { status: 'REJECTED',  desc: 'Errors returned — fix & resubmit', color: 'bg-red-500' },
              ].map((step, i, arr) => (
                <div key={step.status} className="flex items-start gap-3 mb-4 last:mb-0">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full mt-0.5 ${step.color}`} />
                    {i < arr.length - 1 && <div className="w-0.5 h-6 bg-white/20 mt-1" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">{step.status}</span>
                    <p className="text-xs text-blue-200 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="bg-[#1e3a5f] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Go Live?</h2>
          <p className="text-blue-200 mb-8 text-lg">Start issuing FTA-compliant e-invoices today.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-lg transition-all"
          >
            Open E-Invoice Portal <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
