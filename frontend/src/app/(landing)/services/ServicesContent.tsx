'use client';

import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  BarChart3,
  Shield,
  Download,
  Zap,
  Users,
  ScrollText,
  Sparkles,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '../AnimatedSection';

const ICONS = [
  <FileText key="0" className="h-6 w-6" />,
  <Shield key="1" className="h-6 w-6" />,
  <Zap key="2" className="h-6 w-6" />,
  <Download key="3" className="h-6 w-6" />,
  <BarChart3 key="4" className="h-6 w-6" />,
  <Users key="5" className="h-6 w-6" />,
];

const CARD_GRADIENTS = [
  'from-blue-600 to-blue-400 shadow-blue-500/25',
  'from-emerald-500 to-emerald-400 shadow-emerald-500/25',
  'from-amber-500 to-amber-400 shadow-amber-500/25',
  'from-purple-600 to-purple-400 shadow-purple-500/25',
  'from-rose-500 to-rose-400 shadow-rose-500/25',
  'from-indigo-600 to-indigo-400 shadow-indigo-500/25',
];

const TAG_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

const COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose', 'indigo'];

export function ServicesContent() {
  const { t } = useI18n();

  const cards = t<{ title: string; desc: string; tags: string[] }[]>('servicesPage.cards');
  const vatFields = t<string[]>('servicesPage.faf.vatFields');
  const exciseFields = t<string[]>('servicesPage.faf.exciseFields');

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
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Text content */}
            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  {t('servicesPage.hero.tag')}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                  {t('servicesPage.hero.title')}
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  {t('servicesPage.hero.body')}
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['Tax Invoice', 'Credit Note', 'Commercial', 'Continuous Supply'].map((badge) => (
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

            {/* Right: Service overview mockup */}
            <AnimatedSection delay={300} direction="right" className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 blur-3xl rounded-3xl" />

                <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 hover:shadow-blue-500/10 transition-shadow duration-500">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 text-blue-200/50 text-[10px] font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
                      e-numerak.com/services
                    </div>
                    <div className="w-14" />
                  </div>

                  {/* Mockup body */}
                  <div className="p-6 space-y-4">
                    {/* Header with service count */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Service Hub</div>
                          <div className="text-[10px] text-blue-300/60">6 active services</div>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                        <span className="text-[9px] font-semibold text-emerald-300">All Operational</span>
                      </div>
                    </div>

                    {/* Invoice type selector cards */}
                    <div className="space-y-2">
                      {[
                        { type: 'Tax Invoice', icon: <FileText className="h-3.5 w-3.5" />, status: 'Active', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
                        { type: 'Credit Note', icon: <FileText className="h-3.5 w-3.5" />, status: 'Active', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
                        { type: 'Commercial Invoice', icon: <FileText className="h-3.5 w-3.5" />, status: 'Active', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
                      ].map((svc) => (
                        <div key={svc.type} className={`flex items-center justify-between ${svc.bg} rounded-xl px-4 py-2.5 border border-white/[0.06] transition-all duration-200 hover:bg-white/10`}>
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 text-blue-200/70">
                              {svc.icon}
                            </div>
                            <span className="text-sm font-medium text-white">{svc.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${svc.dot}`} />
                            <span className="text-[10px] text-blue-300/60 font-medium">{svc.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Processing stats row */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      {[
                        { value: '12.4K', label: 'Processed', gradient: 'from-blue-400 to-blue-500' },
                        { value: '156', label: 'Today', gradient: 'from-emerald-400 to-emerald-500' },
                        { value: '99.2%', label: 'Success Rate', gradient: 'from-violet-400 to-violet-500' },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/[0.05] rounded-xl p-3 border border-white/[0.06] text-center">
                          <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${s.gradient} mx-auto mb-1.5`} />
                          <div className="text-base font-bold text-white">{s.value}</div>
                          <div className="text-[9px] text-blue-200/50">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Recent activity */}
                    <div className="bg-white/[0.03] rounded-xl p-3.5 border border-white/[0.06]">
                      <div className="text-[10px] text-blue-200/50 font-medium mb-2.5">Recent Activity</div>
                      <div className="space-y-2">
                        {[
                          { action: 'Tax Invoice #INV-2406', status: 'Submitted', time: '2m ago' },
                          { action: 'Credit Note #CN-0891', status: 'Validated', time: '15m ago' },
                          { action: 'Commercial #COM-1123', status: 'Pending Review', time: '1h ago' },
                        ].map((act) => (
                          <div key={act.action} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                              <span className="text-[11px] text-blue-100/70">{act.action}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-blue-300/60">{act.status}</span>
                              <span className="text-[9px] text-blue-300/30">{act.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    UBL 2.1 Ready
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

      {/* Services grid */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                What We Offer
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                Comprehensive E-Invoicing Services
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                A complete suite of tools designed to handle every aspect of UAE e-invoicing
                compliance — from creation to submission.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cards.map((s, i) => {
              const color = COLORS[i];
              return (
                <AnimatedSection key={s.title} delay={i * 100} direction="up">
                  <div className="group relative bg-white rounded-2xl border border-gray-200 p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-gray-200/80 hover:border-transparent h-full flex flex-col">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <div className="relative flex-1 flex flex-col">
                      <div
                        className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${CARD_GRADIENTS[i]} text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl mb-5`}
                      >
                        {ICONS[i]}
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-2.5">{s.title}</h3>
                      <p className="text-[15px] text-gray-500 leading-relaxed flex-1 mb-5">
                        {s.desc}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${TAG_COLORS[color]}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/80 text-emerald-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Simple Process
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                From Creation to Compliance
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                A streamlined workflow that takes your invoice from draft to FTA submission
                in just a few steps.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create & Validate',
                desc: 'Generate UAE-compliant invoices with auto-generated UBL 2.1 XML. Real-time validation catches errors instantly.',
                color: 'from-blue-600 to-blue-400',
              },
              {
                step: '02',
                title: 'Review & Approve',
                desc: 'Preview PDF and XML outputs. Role-based approval workflow ensures accuracy before transmission.',
                color: 'from-emerald-500 to-emerald-400',
              },
              {
                step: '03',
                title: 'Submit & Track',
                desc: 'Securely transmit via the 5-corner network. Full audit trail and FAF reporting built into every invoice.',
                color: 'from-purple-600 to-purple-400',
              },
            ].map((step, i) => (
              <AnimatedSection key={step.step} delay={i * 150} direction="up">
                <div className="text-center">
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} text-white text-xl font-bold shadow-lg mb-6 mx-auto`}
                  >
                    {step.step}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed max-w-xs mx-auto">
                    {step.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <div className="relative mt-16 max-w-4xl mx-auto">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 -translate-y-1/2 hidden md:block" />
          </div>
        </div>
      </section>

      {/* FAF compliance */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-brand-900 to-[#0a1628] py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse-glow" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.08] blur-[100px] animate-float" />
          <div className="absolute top-1/3 left-1/3 w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[90px] animate-float-delayed" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-12">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/20 text-amber-300 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5 backdrop-blur-sm">
                <ScrollText className="h-3.5 w-3.5" />
                Audit Ready
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                {t('servicesPage.faf.title')}
              </h2>
              <p className="text-blue-200/70 text-[15px] leading-relaxed mt-4 max-w-xl">
                {t('servicesPage.faf.subtitle')}
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100} direction="up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { value: `${vatFields.length + exciseFields.length}`, label: 'Total FAF Fields', gradient: 'from-blue-400 to-indigo-500' },
                { value: `${vatFields.length}`, label: 'VAT Fields Covered', gradient: 'from-emerald-400 to-teal-500' },
                { value: `${exciseFields.length}`, label: 'Excise Fields Covered', gradient: 'from-amber-400 to-orange-500' },
                { value: '100%', label: 'FTA Compliant', gradient: 'from-violet-400 to-purple-500' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.06] p-5 text-center transition-all duration-300 hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  <div className={`h-1 w-10 rounded-full bg-gradient-to-r ${m.gradient} mx-auto mb-3`} />
                  <div className="text-2xl font-bold text-white">{m.value}</div>
                  <div className="text-[11px] text-blue-200/50 font-medium mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[
              {
                title: t('servicesPage.faf.vatTitle'),
                fields: vatFields,
                gradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
                chipBg: 'bg-blue-500/10 border-blue-400/20 hover:bg-blue-500/20 hover:border-blue-400/40 text-blue-200',
                progressGradient: 'from-blue-400 to-blue-500',
                iconBg: 'from-blue-400 to-blue-600',
              },
              {
                title: t('servicesPage.faf.exciseTitle'),
                fields: exciseFields,
                gradient: 'from-orange-500/20 via-orange-500/5 to-transparent',
                chipBg: 'bg-orange-500/10 border-orange-400/20 hover:bg-orange-500/20 hover:border-orange-400/40 text-orange-200',
                progressGradient: 'from-orange-400 to-orange-500',
                iconBg: 'from-orange-400 to-orange-600',
              },
            ].map((group) => (
              <AnimatedSection key={group.title} delay={200} direction="up">
                <div className="group relative bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 lg:p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 h-full flex flex-col">
                  <div
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${group.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                  />
                  <div className="relative flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${group.iconBg} shadow-lg flex items-center justify-center shrink-0`}>
                        <ClipboardCheck className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{group.title}</div>
                        <div className="text-[10px] text-blue-300/60">{group.fields.length} fields covered</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20 shrink-0">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-emerald-300">Verified</span>
                    </div>
                  </div>
                  <div className="relative flex flex-wrap content-start gap-2 flex-1">
                    {group.fields.map((f) => (
                      <span
                        key={f}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 hover:scale-105 ${group.chipBg}`}
                      >
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        {f}
                      </span>
                    ))}
                  </div>
                  <div className="relative mt-6 pt-4 border-t border-white/[0.06] shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-blue-300/50 font-medium">Coverage</span>
                      <span className="text-[11px] font-semibold text-emerald-300">{group.fields.length}/{group.fields.length} fields</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${group.progressGradient} transition-all duration-1000`}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-[#1e4080] to-[#0f2147] py-24">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-blue-400/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-emerald-400/5 blur-3xl animate-float" />
        </div>
        <AnimatedSection direction="up">
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Get Started
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-5 leading-tight">
              {t('servicesPage.cta.title')}
            </h2>
            <p className="text-blue-200/90 text-[15px] leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('servicesPage.cta.subtitle')}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.04] hover:shadow-blue-500/40 active:scale-[0.97]"
            >
              {t('servicesPage.cta.button')} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </AnimatedSection>
        <svg viewBox="0 0 1440 80" className="w-full absolute bottom-0 left-0" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" fillOpacity="0.03" />
        </svg>
      </section>
    </>
  );
}
