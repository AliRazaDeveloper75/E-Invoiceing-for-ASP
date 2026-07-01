'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Network,
  Clock,
  ArrowUp,
  CheckCircle2,
  ScrollText,
  BadgeCheck,
  FileCode2,
} from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';

const COMPLIANCE_POINTS: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: <FileCode2 className="h-5 w-5" />,
    title: 'BIS 3.0 / UBL 2.1 Format',
    desc: 'Every invoice is generated as a structured UBL 2.1 XML document that conforms to the UAE PINT (Peppol International) billing specification.',
  },
  {
    icon: <BadgeCheck className="h-5 w-5" />,
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
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'PKI & Encryption',
    desc: 'End-to-end encryption and PKI-based digital signatures ensure invoice integrity and non-repudiation throughout the transmission lifecycle.',
  },
  {
    icon: <ScrollText className="h-5 w-5" />,
    title: 'Full Audit Trail',
    desc: 'Every invoice action — creation, validation, signing, submission — is logged with timestamps and user identity for complete traceability.',
  },
];

const POINT_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-violet-500 to-violet-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
];

const MILESTONES = [
  { year: '2024', event: 'Federal Decree-Law No. 16 mandates e-invoicing in the UAE', active: true },
  { year: '2025', event: 'Phase 1 — B2B & B2G e-invoicing goes live for large taxpayers', active: true },
  { year: '2026', event: 'Phase 2 — Middle segment and SME adoption period', active: false },
  { year: '2027', event: 'Full compliance — all taxable persons required to use e-invoicing', active: false },
];

export default function FtaCompliancePage() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-[#1e4080] to-[#0f2147] text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse-glow" />
          <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px] animate-float" />
          <div className="absolute -bottom-32 left-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[90px] animate-float-delayed" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Regulatory Compliance
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-5">
                  FTA Compliance
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  E-Numerak is built to meet the UAE Federal Tax Authority&apos;s e-invoicing requirements under Federal Decree-Law No. 16 of 2024.
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['BIS 3.0', 'UBL 2.1', '5-Corner Model', 'PKI Signed'].map((badge) => (
                    <span
                      key={badge}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-200 text-xs font-medium"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </AnimatedSection>
            </div>

            {/* Right: Compliance dashboard mockup */}
            <AnimatedSection delay={300} direction="right" className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 blur-3xl rounded-3xl" />

                <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 hover:shadow-blue-500/10 transition-shadow duration-500">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400/80" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400/80" />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-blue-200/50 text-[9px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                      e-numerak.com/compliance
                    </div>
                    <div className="w-10" />
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <BadgeCheck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Compliance Status</div>
                          <div className="text-[9px] text-blue-300/60">FTA Certified Platform</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-semibold text-emerald-300">Compliant</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {[
                        { label: 'BIS Billing 3.0', status: 'Passed', color: 'bg-emerald-400' },
                        { label: 'UBL 2.1 XML Generation', status: 'Passed', color: 'bg-emerald-400' },
                        { label: 'Digital Signing (PKI)', status: 'Passed', color: 'bg-emerald-400' },
                        { label: '5-Corner Transmission', status: 'Verified', color: 'bg-blue-400' },
                        { label: 'FAF Data Elements (32/32)', status: 'Complete', color: 'bg-blue-400' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400/80" />
                            <span className="text-[11px] text-blue-100/80">{item.label}</span>
                          </div>
                          <span className={`text-[8px] font-medium ${item.color === 'bg-emerald-400' ? 'text-emerald-300/80' : 'text-blue-300/80'}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                      <div className="text-[9px] text-blue-200/50 font-medium mb-2">Regulatory Framework</div>
                      <div className="flex flex-wrap gap-1">
                        {['Decree-Law 16/2024', 'BIS 3.0', 'PINT Spec', 'FTA Guidelines'].map((f) => (
                          <span key={f} className="px-2 py-0.5 rounded-md bg-white/10 text-blue-200/70 text-[8px] font-semibold border border-white/[0.06]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    FTA Certified
                  </div>
                </div>
              </div>
            </AnimatedSection>

          </div>
        </div>
        <svg viewBox="0 0 1440 80" className="w-full -mb-1" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
        </svg>
      </section>

      {/* Compliance pillars */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Compliance Pillars
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                How We Meet FTA Requirements
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                Every layer of the E-Numerak platform is engineered to satisfy UAE e-invoicing regulations.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPLIANCE_POINTS.map((p, i) => (
              <AnimatedSection key={p.title} delay={i * 100} direction="up">
                <div className="group relative bg-white rounded-2xl border border-gray-200 p-7 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-gray-200/80 hover:border-transparent h-full">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="relative">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${POINT_GRADIENTS[i]} text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl mb-5`}>
                      {p.icon}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">{p.title}</h3>
                    <p className="text-[15px] text-gray-500 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Regulatory timeline */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <AnimatedSection direction="left" delay={0}>
              <div>
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-100/80 text-amber-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                  <Clock className="h-3.5 w-3.5" />
                  Regulatory Timeline
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
                  UAE E-Invoicing Roadmap
                </h2>
                <div className="space-y-4 text-gray-600 text-[15px] leading-relaxed">
                  <p>
                    The UAE e-invoicing mandate is being rolled out in phases to ensure a smooth transition for all businesses operating in the country.
                  </p>
                  <p>
                    E-Numerak is designed to support taxpayers at every stage of the rollout, from early adoption through full compliance.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={100}>
              <div className="relative pl-8 border-l-2 border-gray-200 space-y-8">
                {MILESTONES.map((m, i) => (
                  <div key={m.year} className="relative">
                    <div className={`absolute -left-[calc(1rem+5px)] top-0 w-4 h-4 rounded-full border-4 ${
                      m.active ? 'bg-blue-500 border-blue-200' : 'bg-gray-300 border-gray-100'
                    } shadow-sm`} />
                    <div className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-1.5 ${
                      m.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.year}
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      m.active ? 'text-gray-700 font-medium' : 'text-gray-400'
                    }`}>
                      {m.event}
                    </p>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Regulatory basis + CTA */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-[#1e4080] to-[#0f2147] p-10 lg:p-14">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[10px] font-semibold uppercase tracking-[0.12em] mb-4">
                    <ScrollText className="h-3 w-3" />
                    Regulatory Basis
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">
                    Built on UAE Law
                  </h3>
                  <p className="text-blue-100/80 text-[15px] leading-relaxed mb-6 max-w-xl">
                    UAE e-invoicing is mandated under Federal Decree-Law No. 16 of 2024. Phase 1 covers B2B and B2G transactions. E-Numerak generates compliant structured invoices, signs them, and transmits them to the FTA through accredited service providers — so your business stays compliant without the complexity.
                  </p>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.04] hover:shadow-blue-500/40 active:scale-[0.97]"
                  >
                    Talk to our compliance team <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="hidden lg:flex flex-wrap gap-3 justify-center">
                  {['Federal Decree-Law 16/2024', 'BIS Billing 3.0', 'UBL 2.1 / PINT', '5-Corner Model', 'PKI Digital Signing', 'FAF Compliance'].map((tag) => (
                    <span key={tag} className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-blue-200 text-xs font-medium backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-40 flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-900 to-brand-700 text-white shadow-lg shadow-brand-900/30 transition-all duration-300 hover:scale-110 hover:shadow-xl ${
          showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </>
  );
}
