'use client';

import Link from 'next/link';
import { useState, useEffect, type ReactNode } from 'react';
import {
  ArrowRight, CheckCircle2, FileText, Zap,
  Lock, ChevronRight, Building2,
  Percent, Database, Share2, ShieldCheck,
  Send, Upload, Search, Eye,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from './AnimatedSection';
import { useInView } from '@/hooks/useInView';

const FEATURE_ICONS = [
  <FileText key="0" className="h-6 w-6" />,
  <Zap key="1" className="h-6 w-6" />,
  <Lock key="2" className="h-6 w-6" />,
];
const FEATURE_COLORS = ['text-blue-600 bg-blue-50', 'text-amber-600 bg-amber-50', 'text-indigo-600 bg-indigo-50'];
const SERVICE_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-amber-400 to-amber-600',
  'from-indigo-400 to-indigo-600',
];

const VALUE_COLORS = [
  { color: 'border-blue-200 bg-blue-50', heading: 'text-blue-700' },
  { color: 'border-emerald-200 bg-emerald-50', heading: 'text-emerald-700' },
  { color: 'border-purple-200 bg-purple-50', heading: 'text-purple-700' },
];

const VALUE_ICONS = [
  <Eye key="v0" className="h-6 w-6" />,
  <ShieldCheck key="v1" className="h-6 w-6" />,
  <Zap key="v2" className="h-6 w-6" />,
];

const VALUE_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-purple-400 to-purple-600',
];

const STAT_ICONS = [
  <Percent key="s0" className="h-5 w-5" />,
  <Database key="s1" className="h-5 w-5" />,
  <Share2 key="s2" className="h-5 w-5" />,
  <ShieldCheck key="s3" className="h-5 w-5" />,
];

const STAT_BG = [
  'bg-blue-100 text-blue-600',
  'bg-violet-100 text-violet-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
];

const ABOUT_ICONS = [
  <FileText key="a0" className="h-4 w-4" />,
  <ShieldCheck key="a1" className="h-4 w-4" />,
  <CheckCircle2 key="a2" className="h-4 w-4" />,
  <Lock key="a3" className="h-4 w-4" />,
  <Building2 key="a4" className="h-4 w-4" />,
];

const ABOUT_ICON_BG = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-purple-100 text-purple-600',
  'bg-indigo-100 text-indigo-600',
];

const WHY_CARD_ACCENTS = [
  { border: 'border-blue-200 hover:border-blue-300', bg: 'bg-blue-50', icon: 'text-blue-600' },
  { border: 'border-emerald-200 hover:border-emerald-300', bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  { border: 'border-violet-200 hover:border-violet-300', bg: 'bg-violet-50', icon: 'text-violet-600' },
];

const PROCESS_ICONS = [
  <FileText key="p0" className="h-6 w-6" />,
  <CheckCircle2 key="p1" className="h-6 w-6" />,
  <Send key="p2" className="h-6 w-6" />,
  <Upload key="p3" className="h-6 w-6" />,
  <Search key="p4" className="h-6 w-6" />,
];

const PROCESS_COLORS = [
  'bg-blue-50 text-blue-600',
  'bg-emerald-50 text-emerald-600',
  'bg-violet-50 text-violet-600',
  'bg-amber-50 text-amber-600',
  'bg-indigo-50 text-indigo-600',
];

const PROCESS_BADGE_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-indigo-500',
];

const PROCESS_BORDER_COLORS = [
  'border-blue-200 group-hover:border-blue-300',
  'border-emerald-200 group-hover:border-emerald-300',
  'border-violet-200 group-hover:border-violet-300',
  'border-amber-200 group-hover:border-amber-300',
  'border-indigo-200 group-hover:border-indigo-300',
];

function StatCard({ value, label, icon, bg, index }: { value: string; label: string; icon: ReactNode; bg: string; index: number }) {
  const { ref, inView } = useInView({ threshold: 0.3 });
  const [display, setDisplay] = useState('0');

  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  const suffix = value.replace(/[0-9.]/g, '');
  const isValid = !isNaN(num);

  useEffect(() => {
    if (!inView || !isValid) return;
    setDisplay('0');
    const duration = 2000;
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(num * eased);
      setDisplay(current + suffix);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [inView, num, suffix, isValid]);

  return (
    <div
      ref={ref}
      className={`group relative bg-blue-50 rounded-2xl border border-blue-100/80 p-6 lg:p-8 shadow-sm shadow-blue-100/50 hover:shadow-xl hover:shadow-blue-200/60 transition-all duration-700 ease-out ${
  inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >

      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${bg}`}>
        {icon}
      </div>

      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums">
        {isValid ? display : value}
      </div>

      <div className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">
        {label}
      </div>
    </div>
  );
}

export function HomeContent() {
  const { t } = useI18n();

  const stats = t<{ value: string; label: string }[]>('home.stats');
  const heroTrust = t<string[]>('home.hero.trust');
  const aboutList = t<string[]>('home.about.cardList');
  const processSteps = t<{ label: string; desc: string }[]>('home.process.steps');
  const services = t<{ title: string; desc: string }[]>('home.services.items');
  const complianceList = t<string[]>('home.compliance.list');
  const lifecycle = t<{ status: string; desc: string }[]>('home.compliance.lifecycle');
  const whyCards = t<{ label: string; desc: string }[]>('home.why.cards');
  const valueCards = t<{ title: string; body: string }[]>('home.value.cards');

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1b35] via-[#1e3a5f] to-[#1e4080] text-white min-h-[90vh] flex items-center">
        {/* Animated gradient orbs */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── Left: Text content ──────────────────────────────────────────── */}
            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-xs font-medium mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  UAE FTA-Certified Platform
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-5">
                  {t('home.hero.titlePre')}{' '}
                  <span className="bg-gradient-to-r from-blue-300 via-blue-200 to-cyan-200 bg-clip-text text-transparent">
                    {t('home.hero.titleHighlight')}
                  </span>
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={200} direction="up">
                <p className="text-lg sm:text-xl text-blue-200/90 font-medium mb-4">
                  {t('home.hero.subtitle')}
                </p>
              </AnimatedSection>

              <AnimatedSection delay={300} direction="up">
                <p className="text-base text-blue-100/70 leading-relaxed mb-8 max-w-xl">
                  {t('home.hero.body')}
                </p>
              </AnimatedSection>

              <AnimatedSection delay={400} direction="up">
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] group"
                  >
                    {t('home.hero.cta1')}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                  >
                    {t('home.hero.cta2')} <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={500} direction="up">
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2.5">
                  {heroTrust.map((tItem, i) => (
                    <span
                      key={tItem}
                      className="flex items-center gap-1.5 text-xs text-blue-200/70 font-medium"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      {tItem}
                    </span>
                  ))}
                </div>
              </AnimatedSection>
            </div>

            {/* ── Right: Dashboard mockup ─────────────────────────────────────── */}
            <AnimatedSection delay={300} direction="right" className="hidden lg:block">
              <div className="relative">
                {/* Glow behind mockup */}
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
                      e-numerak.com/dashboard
                    </div>
                    <div className="w-14" />
                  </div>

                  {/* Mockup body */}
                  <div className="p-6 space-y-5">
                    {/* Top bar with avatar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-blue-500/30 flex items-center justify-center">
                          <FileText className="h-3 w-3 text-blue-300" />
                        </div>
                        <span className="text-xs text-blue-200/60 font-medium">Dashboard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-white/10" />
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                          A
                        </div>
                      </div>
                    </div>

                    {/* Stat cards row */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { value: 'AED 284K', label: 'Revenue', color: 'from-blue-400 to-blue-500' },
                        { value: '1,247', label: 'Invoices', color: 'from-emerald-400 to-emerald-500' },
                        { value: 'AED 14.2K', label: 'VAT', color: 'from-amber-400 to-amber-500' },
                        { value: '98.5%', label: 'Validated', color: 'from-violet-400 to-violet-500' },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.06] group-hover:bg-white/[0.08] transition-colors">
                          <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${stat.color} mb-2`} />
                          <div className="text-sm font-bold text-white">{stat.value}</div>
                          <div className="text-[10px] text-blue-200/50 mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Chart area */}
                    <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-blue-200/60 font-medium">Revenue Trend</span>
                        <span className="text-[10px] text-blue-200/40">Last 6 months</span>
                      </div>
                      <div className="flex items-end gap-2 h-20">
                        {[35, 55, 42, 72, 60, 85].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group/chart">
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-blue-500/40 to-blue-400/20 transition-all duration-300 group-hover/chart:from-blue-400/60 group-hover/chart:to-blue-300/40"
                              style={{ height: `${h}%` }}
                            />
                            <span className="text-[8px] text-blue-200/30">
                              {['Jan','Feb','Mar','Apr','May','Jun'][i]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini table */}
                    <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
                      <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-white/[0.06] text-[10px] text-blue-200/50 font-medium">
                        <span>Invoice</span>
                        <span>Customer</span>
                        <span>Date</span>
                        <span className="text-right">Amount</span>
                        <span className="text-center">Status</span>
                      </div>
                      {[
                        ['INV-001', 'ACME Corp', '25 Jun', 'AED 12,400', 'paid'],
                        ['INV-002', 'Dubai Tech', '24 Jun', 'AED 8,750', 'paid'],
                        ['INV-003', 'Gulf Traders', '23 Jun', 'AED 21,300', 'pending'],
                      ].map((row, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-white/[0.04] text-[10px] text-blue-100/60 last:border-0"
                        >
                          <span className="text-blue-300/80">{row[0]}</span>
                          <span>{row[1]}</span>
                          <span>{row[2]}</span>
                          <span className="text-right">{row[3]}</span>
                          <span className="text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${
                              row[4] === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {row[4]}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    FTA Certified
                  </div>
                </div>
                <div className="absolute -bottom-3 -left-3 animate-float-delayed">
                  <div className="px-3 py-1.5 rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-300 text-[10px] font-semibold shadow-lg">
                    BIS 3.0 Compliant
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Bottom wave */}
        <svg viewBox="0 0 1440 60" className="absolute bottom-0 w-full" preserveAspectRatio="none">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-b from-white via-blue-50/40 to-white border-b border-gray-100 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #1e3a5f 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {stats.map((s, i) => (
              <StatCard
                key={s.label}
                value={s.value}
                label={s.label}
                icon={STAT_ICONS[i]}
                bg={STAT_BG[i]}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <section className="relative py-20 lg:py-28 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-2/5 h-full bg-gradient-to-l from-blue-50/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-t from-blue-50/30 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* ── Left: Story + highlights ──────────────────────────────────── */}
            <AnimatedSection direction="left" delay={0} className="lg:col-span-7">
              <div>
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {t('home.about.tag')}
                </p>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                  {t('home.about.title')}
                </h2>
                <p className="text-gray-600 leading-relaxed text-[15px] mb-8 max-w-xl">
                  {t('home.about.p1')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aboutList.map((item, i) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 transition-all duration-200 hover:bg-blue-50/80 hover:border-blue-100 hover:-translate-y-0.5"
                    >
                      <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${ABOUT_ICON_BG[i]}`}>
                        {ABOUT_ICONS[i]}
                      </div>
                      <span className="text-sm text-gray-700 font-medium leading-snug pt-0.5">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            {/* ── Right: Platform card ──────────────────────────────────────── */}
            <AnimatedSection direction="right" delay={100} className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 blur-3xl rounded-3xl" />
                <div className="relative bg-gradient-to-br from-[#1e3a5f] via-[#1e4080] to-[#0f2147] rounded-3xl p-8 lg:p-10 text-white border border-white/10 shadow-2xl transition-all duration-500 hover:shadow-[#1e3a5f]/40 hover:-translate-y-1">
                  {/* Logo + title */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                      <FileText className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{t('home.about.cardTitle')}</p>
                      <p className="text-blue-300/60 text-sm mt-0.5">{t('home.about.cardSub')}</p>
                    </div>
                  </div>

                  {/* Description text */}
                  <p className="text-blue-100/80 text-sm leading-relaxed mb-8">
                    {t('home.about.p2')}
                  </p>

                  {/* Capability icons row */}
                  <div className="flex items-center gap-4 mb-8">
                    {[
                      { icon: <ShieldCheck className="h-4 w-4" />, label: 'FTA Compliant' },
                      { icon: <FileText className="h-4 w-4" />, label: 'UBL 2.1' },
                      { icon: <Zap className="h-4 w-4" />, label: 'Real-Time' },
                      { icon: <Building2 className="h-4 w-4" />, label: 'Multi-Company' },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 group/cap">
                        <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-blue-200/70 group-hover/cap:bg-white/20 group-hover/cap:text-white transition-all duration-200">
                          {item.icon}
                        </div>
                        <span className="text-[10px] text-blue-300/50 font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-white transition-colors group"
                  >
                    Learn more about E-Numerak
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </AnimatedSection>

          </div>
        </div>
      </section>

      {/* ── Seamless Process ─────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-gray-50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-3xl mx-auto text-center mb-16">
              <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {t('home.process.tag')}
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
                {t('home.process.title')}
              </h2>
              <div className="space-y-4 text-gray-500 leading-relaxed text-[15px]">
                <p>{t('home.process.p1')}</p>
                <p>{t('home.process.p2')}</p>
              </div>
            </div>
          </AnimatedSection>

          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {processSteps.map((p, i) => (
              <AnimatedSection key={p.label} delay={i * 100} direction="up">
                <div className={`group relative bg-white rounded-2xl border-2 p-6 text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${PROCESS_BORDER_COLORS[i]}`}>
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full ${PROCESS_BADGE_COLORS[i]} text-white flex items-center justify-center text-[10px] font-bold shadow-lg`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 mt-1 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${PROCESS_COLORS[i]}`}>
                    {PROCESS_ICONS[i]}
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{p.label}</h3>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services / Features ──────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-amber-50 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {t('home.services.tag')}
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
                {t('home.services.title')}
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto">
                {t('home.services.subtitle')}
              </p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((f, i) => (
              <AnimatedSection key={f.title} delay={i * 100} direction="up">
                <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl overflow-hidden">
                  <div className={`h-1.5 w-full bg-gradient-to-r ${SERVICE_GRADIENTS[i]}`} />
                  <div className="p-8">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${FEATURE_COLORS[i]}`}>
                      {FEATURE_ICONS[i]}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-gray-50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-0 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-0 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <AnimatedSection direction="left" delay={0}>
              <div>
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {t('home.compliance.tag')}
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
                  {t('home.compliance.title')}
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] mb-8">
                  <p>{t('home.compliance.p1')}</p>
                  <p>{t('home.compliance.p2')}</p>
                  <p>{t('home.compliance.p3')}</p>
                </div>

                <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-r-xl p-4 mb-8">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 shrink-0 mt-0.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                    {t('home.compliance.p4')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {complianceList.map((c) => (
                    <div
                      key={c}
                      className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 hover:shadow-md hover:border-emerald-200 transition-all duration-200"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 leading-snug">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={100}>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white transition-all duration-300 hover:shadow-2xl hover:shadow-[#1e3a5f]/40 hover:-translate-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {t('home.compliance.cardTag')}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-8 leading-tight tracking-tight">
                    {t('home.compliance.cardTitle')}
                  </h3>

                  <div className="relative">
                    {lifecycle.map((step, i) => (
                      <div key={step.status} className="flex items-start gap-4 mb-6 last:mb-0 group/step">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 group-hover/step:scale-110 ${
                            i === 4
                              ? 'bg-red-500/20 border-red-400 text-red-300'
                              : 'bg-white/10 border-white/30 text-white'
                          }`}>
                            {i + 1}
                          </div>
                          {i < lifecycle.length - 1 && (
                            <div className="w-0.5 h-8 bg-gradient-to-b from-white/20 to-transparent mt-1" />
                          )}
                        </div>
                        <div className="pt-1">
                          <span className="text-sm font-bold text-white">{step.status}</span>
                          <p className="text-xs text-blue-200/80 mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-8 text-xs text-blue-300/80 leading-relaxed border-t border-white/10 pt-5">
                    {t('home.compliance.cardFoot')}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Why Choose ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-blue-50 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-1/4 w-72 h-72 bg-violet-50 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <AnimatedSection direction="left" delay={0}>
              <div className="lg:pr-8">
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {t('home.why.tag')}
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
                  {t('home.why.title')}
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                  <p>{t('home.why.p1')}</p>
                  <p>{t('home.why.p2')}</p>
                  <p>{t('home.why.p3')}</p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={100}>
              <div className="space-y-4">
                {whyCards.map((item, i) => (
                  <div
                    key={item.label}
                    className={`group flex items-start gap-5 bg-white rounded-2xl border-2 ${WHY_CARD_ACCENTS[i].border} shadow-sm p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                  >
                    <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${WHY_CARD_ACCENTS[i].bg} shrink-0 transition-all duration-300 group-hover:scale-110`}>
                      <CheckCircle2 className={`h-6 w-6 ${WHY_CARD_ACCENTS[i].icon}`} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <h3 className="font-bold text-gray-900 mb-1">{item.label}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Value of E-Invoicing ─────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-gray-50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-purple-50 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {t('home.value.tag')}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.value.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {valueCards.map((card, i) => (
              <AnimatedSection key={card.title} delay={i * 100} direction="up">
                <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                  <div className={`h-1.5 w-full bg-gradient-to-r ${VALUE_GRADIENTS[i]}`} />
                  <div className="p-7">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${VALUE_COLORS[i].color}`}>
                      {VALUE_ICONS[i]}
                    </div>
                    <h3 className={`font-bold text-lg mb-3 ${VALUE_COLORS[i].heading}`}>{card.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{card.body}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1b35] via-[#1e3a5f] to-[#1e4080] py-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse-glow" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[100px] animate-float" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection direction="up">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {t('home.cta.tag')}
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight mb-6">
              {t('home.cta.title')}
            </h2>
            <div className="space-y-4 text-blue-200/80 text-[15px] leading-relaxed mb-10 max-w-2xl mx-auto">
              <p>{t('home.cta.p1')}</p>
              <p>{t('home.cta.p2')}</p>
            </div>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.04] active:scale-[0.98]"
            >
              {t('home.cta.button')} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-8 text-sm font-semibold text-blue-300/80">
              {t('home.cta.foot')}
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer tagline ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0a1735] py-16">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection direction="up">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl tracking-tight">{t('home.tagline.brand')}</span>
            </div>
            <p className="text-blue-200/70 text-sm leading-relaxed max-w-2xl mx-auto mb-3">
              {t('home.tagline.p1')}
            </p>
            <p className="text-blue-300/50 text-sm leading-relaxed max-w-2xl mx-auto">
              {t('home.tagline.p2')}
            </p>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
