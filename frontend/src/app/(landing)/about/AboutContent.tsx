'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Target,
  Users,
  Shield,
  Award,
  CheckCircle2,
  Building2,
  FileCheck,
  Network,
  ScrollText,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '../AnimatedSection';

const VALUE_ICONS = [
  <Target key="0" className="h-6 w-6" />,
  <Users key="1" className="h-6 w-6" />,
  <Shield key="2" className="h-6 w-6" />,
  <Award key="3" className="h-6 w-6" />,
];

const VALUE_GRADIENTS = [
  'from-blue-600 to-blue-400 shadow-blue-500/25',
  'from-emerald-500 to-emerald-400 shadow-emerald-500/25',
  'from-amber-500 to-amber-400 shadow-amber-500/25',
  'from-purple-600 to-purple-400 shadow-purple-500/25',
];

const TIMELINE_DOTS = [
  'bg-blue-500 shadow-blue-200',
  'bg-amber-500 shadow-amber-200',
  'bg-emerald-500 shadow-emerald-200',
  'bg-red-500 shadow-red-200',
  'bg-purple-500 shadow-purple-200',
];

const HIGHLIGHTS = [
  {
    icon: <FileCheck className="h-6 w-6" />,
    title: 'FTA Certified',
    desc: 'Built against FTA Tax Accounting Software Certification Guidelines.',
  },
  {
    icon: <Network className="h-6 w-6" />,
    title: '5-Corner Model',
    desc: 'End-to-end invoice transmission via the E-Invoice network.',
  },
  {
    icon: <ScrollText className="h-6 w-6" />,
    title: 'UBL 2.1 XML',
    desc: 'BIS Billing 3.0 compliant invoice generation.',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Real-Time Validation',
    desc: 'Instant error detection before submission.',
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    title: 'Multi-Company',
    desc: 'Manage multiple entities with role-based access.',
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    title: 'VAT & Excise Ready',
    desc: 'Full FAF coverage for both VAT and Excise Tax.',
  },
];

const STATS = [
  { value: '5+', label: 'Years of Expertise' },
  { value: '5%', label: 'UAE VAT Rate' },
  { value: '32', label: 'FAF Data Elements' },
  { value: '100%', label: 'FTA Compliant' },
];

export function AboutContent() {
  const { t } = useI18n();

  const values = t<{ title: string; desc: string }[]>('about.values');
  const timeline = t<{ year: string; event: string }[]>('about.timeline');

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
                  {t('about.hero.tag')}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                  {t('about.hero.title')}
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  {t('about.hero.body')}
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['FTA Certified', 'BIS 3.0', 'UBL 2.1', 'VAT Compliant'].map((badge) => (
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

            {/* Right: Company profile mockup */}
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
                      e-numerak.com/about
                    </div>
                    <div className="w-14" />
                  </div>

                  {/* Mockup body */}
                  <div className="p-6 space-y-5">
                    {/* Company header with avatar */}
                    <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-white">E-Numerak</div>
                        <div className="text-xs text-blue-300/60">UAE E-Invoicing Platform</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] text-emerald-300/80 font-medium">FTA Certified</span>
                        </div>
                      </div>
                    </div>

                    {/* Key metrics row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: '100+', label: 'Clients', gradient: 'from-blue-400 to-blue-500' },
                        { value: '50K+', label: 'Invoices/mo', gradient: 'from-emerald-400 to-emerald-500' },
                        { value: '99.9%', label: 'Uptime', gradient: 'from-violet-400 to-violet-500' },
                      ].map((m) => (
                        <div key={m.label} className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.06] text-center">
                          <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${m.gradient} mx-auto mb-2`} />
                          <div className="text-lg font-bold text-white">{m.value}</div>
                          <div className="text-[10px] text-blue-200/50">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Office locations */}
                    <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-blue-200/60 font-medium">Our Presence</span>
                        <span className="text-[10px] text-blue-200/40">UAE &amp; GCC</span>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { city: 'Dubai', role: 'Headquarters', active: true },
                          { city: 'Abu Dhabi', role: 'Regional Office', active: true },
                          { city: 'Riyadh', role: 'Satellite Office', active: false },
                        ].map((loc) => (
                          <div key={loc.city} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2 h-2 rounded-full ${loc.active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                              <span className="text-sm font-medium text-white">{loc.city}</span>
                            </div>
                            <span className="text-[10px] text-blue-300/50">{loc.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Team / Certifications row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06]">
                        <div className="text-xs text-blue-200/60 font-medium mb-2">Team</div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-2">
                            {['A', 'M', 'K', 'S'].map((initial, i) => (
                              <div
                                key={i}
                                className={`w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#1e4080]`}
                              >
                                {initial}
                              </div>
                            ))}
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-blue-300 ring-2 ring-[#1e4080]">
                              +5
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06]">
                        <div className="text-xs text-blue-200/60 font-medium mb-2">Certified</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-semibold">FTA</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[9px] font-semibold">BIS 3.0</span>
                          <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[9px] font-semibold">UBL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    Since 2020
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

      {/* Stats Strip */}
      <section className="relative -mt-12 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 grid grid-cols-2 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <AnimatedSection key={stat.label} delay={i * 100} direction="up">
                <div className="p-6 lg:p-8 text-center">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-brand-900 to-brand-600 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500 mt-1.5 font-medium">{stat.label}</div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Why E-Numerak
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                {t('about.valuesTitle')}
              </h2>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v, i) => (
              <AnimatedSection key={v.title} delay={i * 120} direction="up">
                <div className="group relative bg-white rounded-2xl border border-gray-200 p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-gray-200/80 hover:border-transparent">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="relative">
                    <div
                      className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${VALUE_GRADIENTS[i]} text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl mb-5`}
                    >
                      {VALUE_ICONS[i]}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{v.title}</h3>
                    <p className="text-[15px] text-gray-500 leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Highlights */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/80 text-emerald-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Platform Capabilities
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                Engineered for Excellence
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                Every feature is built from the ground up to meet UAE regulatory standards while
                delivering a seamless user experience.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {HIGHLIGHTS.map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 100} direction="up">
                <div className="group bg-white rounded-xl border border-gray-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-brand-500/30">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 text-brand-600 mb-4 transition-all duration-300 group-hover:scale-110 group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-100/80 text-purple-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <ScrollText className="h-3.5 w-3.5" />
                Regulatory Journey
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                {t('about.timelineTitle')}
              </h2>
            </div>
          </AnimatedSection>
          <div className="relative">
            <div className="absolute left-0 lg:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-emerald-500 to-purple-500 -translate-x-1/2 hidden lg:block" />
            <div className="space-y-12">
              {timeline.map((item, i) => {
                const isLeft = i % 2 === 0;
                return (
                  <AnimatedSection key={item.year} delay={i * 120} direction="up">
                    <div className="relative lg:flex items-start">
                      <div
                        className={`hidden lg:flex lg:w-1/2 ${isLeft ? 'justify-end pr-12' : 'order-2 justify-start pl-12'}`}
                      >
                        <div
                          className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${TIMELINE_DOTS[i].replace('bg-', 'bg-').replace('shadow-', 'shadow-')} text-white`}
                        >
                          {item.year}
                        </div>
                      </div>
                      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 w-full justify-center">
                        <div
                          className={`w-5 h-5 rounded-full border-4 border-white shadow-md transition-all duration-300 hover:scale-150 ${TIMELINE_DOTS[i]}`}
                        />
                      </div>
                      <div
                        className={`lg:w-1/2 ${isLeft ? 'lg:order-2 pl-0 lg:pl-12' : 'pl-0 lg:pr-12'}`}
                      >
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                          <div className="lg:hidden inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3 bg-brand-900">
                            {item.year}
                          </div>
                          <p className="text-[15px] text-gray-700 leading-relaxed">{item.event}</p>
                        </div>
                      </div>
                    </div>
                  </AnimatedSection>
                );
              })}
            </div>
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
              {t('about.cta.title')}
            </h2>
            <p className="text-blue-200/90 text-[15px] leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('about.cta.subtitle')}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.04] hover:shadow-blue-500/40 active:scale-[0.97]"
            >
              {t('about.cta.button')} <ArrowRight className="h-5 w-5" />
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
