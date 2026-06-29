'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Server,
  Network,
  Building2,
  ShieldCheck,
  Radio,
  FileCode2,
  Sparkles,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '../AnimatedSection';

const CORNER_GRADIENTS = [
  'from-blue-600 to-blue-400 shadow-blue-500/25',
  'from-indigo-600 to-indigo-400 shadow-indigo-500/25',
  'from-purple-600 to-purple-400 shadow-purple-500/25',
  'from-emerald-500 to-emerald-400 shadow-emerald-500/25',
  'from-teal-500 to-teal-400 shadow-teal-500/25',
];

const CORNER_ICONS = [
  <Server key="c0" className="h-5 w-5" />,
  <Radio key="c1" className="h-5 w-5" />,
  <Network key="c2" className="h-5 w-5" />,
  <Building2 key="c3" className="h-5 w-5" />,
  <ShieldCheck key="c4" className="h-5 w-5" />,
];

const CORNER_BG = [
  'bg-blue-50 border-blue-100',
  'bg-indigo-50 border-indigo-100',
  'bg-purple-50 border-purple-100',
  'bg-emerald-50 border-emerald-100',
  'bg-teal-50 border-teal-100',
];

const CORNER_TAG = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
];

const CARD_GRADIENTS = [
  'from-blue-600 to-blue-400 shadow-blue-500/25',
  'from-indigo-600 to-indigo-400 shadow-indigo-500/25',
  'from-purple-600 to-purple-400 shadow-purple-500/25',
];

export function PeppolContent() {
  const { t } = useI18n();

  const corners = t<{ label: string; tag: string; desc: string }[]>('peppol.corners');
  const platformCards = t<{ label: string; val: string }[]>('peppol.platformCards');
  const ublElements = t<{ element: string; desc: string }[]>('peppol.ublElements');

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
                  {t('peppol.hero.tag')}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                  {t('peppol.hero.title')}
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  {t('peppol.hero.body')}
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['5-Corner Model', 'BIS 3.0', 'UBL 2.1', 'FTA Network'].map((badge) => (
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

            {/* Right: Network transmission mockup */}
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
                      e-numerak.com/network
                    </div>
                    <div className="w-14" />
                  </div>

                  {/* Mockup body */}
                  <div className="p-6 space-y-4">
                    {/* Network header */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <Network className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">E-Invoice Network</div>
                          <div className="text-[10px] text-blue-300/60">5-Corner Model Active</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-semibold text-emerald-300">Connected</span>
                      </div>
                    </div>

                    {/* 5-Corner node visualization */}
                    <div className="relative flex items-center justify-between px-4 py-5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                      {[
                        { label: 'Supplier', abbr: 'S', color: 'from-blue-400 to-blue-500' },
                        { label: 'Buyer', abbr: 'B', color: 'from-emerald-400 to-emerald-500' },
                        { label: 'Platform', abbr: 'P', color: 'from-violet-400 to-violet-500' },
                        { label: 'FTA', abbr: 'F', color: 'from-amber-400 to-amber-500' },
                        { label: 'Portal', abbr: 'G', color: 'from-cyan-400 to-cyan-500' },
                      ].map((node, i) => (
                        <div key={node.label} className="flex flex-col items-center gap-1.5 z-10">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center text-[11px] font-bold text-white shadow-lg transition-all duration-300 hover:scale-110`}>
                            {node.abbr}
                          </div>
                          <span className="text-[8px] text-blue-300/50 font-medium">{node.label}</span>
                          {i < 4 && (
                            <div className="absolute top-1/2 left-[calc(20%*var(--i,1)+10%)] w-[calc(20%-8px)] h-px bg-gradient-to-r from-white/20 to-white/5 hidden lg:block" />
                          )}
                        </div>
                      ))}
                      {/* Connector lines */}
                      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-cyan-500/30 -translate-y-1/2 mx-8" />
                    </div>

                    {/* Transmission metrics */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { value: '2.4K', label: 'Today TX', gradient: 'from-blue-400 to-blue-500' },
                        { value: '98.7%', label: 'Success Rate', gradient: 'from-emerald-400 to-emerald-500' },
                        { value: '0.8s', label: 'Avg Speed', gradient: 'from-violet-400 to-violet-500' },
                      ].map((m) => (
                        <div key={m.label} className="bg-white/[0.05] rounded-xl p-3 border border-white/[0.06] text-center">
                          <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${m.gradient} mx-auto mb-1.5`} />
                          <div className="text-base font-bold text-white">{m.value}</div>
                          <div className="text-[9px] text-blue-200/50">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Recent transmissions */}
                    <div className="bg-white/[0.03] rounded-xl p-3.5 border border-white/[0.06]">
                      <div className="text-[10px] text-blue-200/50 font-medium mb-2.5">Live Transmissions</div>
                      <div className="space-y-2">
                        {[
                          { ref: 'INV-2406 → FTA', status: 'Delivered', time: 'Just now', ok: true },
                          { ref: 'CN-0891 → Portal', status: 'Routing', time: '30s ago', ok: true },
                          { ref: 'COM-1123 → Buyer', status: 'Pending', time: '2m ago', ok: false },
                        ].map((tx) => (
                          <div key={tx.ref} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${tx.ok ? 'bg-emerald-400' : 'bg-amber-400'} ${tx.ok ? 'animate-pulse' : ''}`} />
                              <span className="text-[11px] text-blue-100/70 font-mono">{tx.ref}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-medium ${tx.ok ? 'text-emerald-300/80' : 'text-amber-300/80'}`}>{tx.status}</span>
                              <span className="text-[9px] text-blue-300/30">{tx.time}</span>
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
                    BIS 3.0 Compliant
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

      {/* 5 Corners */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <Network className="h-3.5 w-3.5" />
                {t('peppol.cornersTitle')}
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                How the 5 Corners Work
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                {t('peppol.cornersSubtitle')}
              </p>
            </div>
          </AnimatedSection>

          {/* Desktop: horizontal flow */}
          <div className="hidden lg:block mb-16">
            <div className="relative grid grid-cols-5 gap-6">
              {corners.map((corner, i) => (
                <AnimatedSection key={corner.label} delay={i * 100} direction="up">
                  <div className="group relative bg-white rounded-2xl border border-gray-200 p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-gray-200/80 hover:border-transparent h-full">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <div className="relative text-center">
                      <div
                        className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${CORNER_GRADIENTS[i]} text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl mb-4 mx-auto`}
                      >
                        {CORNER_ICONS[i]}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-2.5 ${CORNER_TAG[i]}`}
                      >
                        {corner.tag}
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm mb-1.5">{corner.label}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{corner.desc}</p>
                    </div>
                    {i < corners.length - 1 && (
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                        <ArrowRightLeft className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="lg:hidden mb-12 space-y-6">
            {corners.map((corner, i) => (
              <AnimatedSection key={corner.label} delay={i * 100} direction="up">
                <div className={`flex gap-4 p-5 rounded-2xl border ${CORNER_BG[i]}`}>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${CORNER_GRADIENTS[i]} text-white shadow-md shrink-0 mt-0.5`}
                  >
                    {CORNER_ICONS[i]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${CORNER_TAG[i]}`}>
                      {corner.tag}
                    </span>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{corner.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{corner.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Where our platform sits */}
          <AnimatedSection direction="up" delay={200}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-[#1e4080] to-[#0f2147] p-8 lg:p-10">
              <div className="absolute inset-0">
                <div
                  className="absolute inset-0 opacity-[0.05]"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                  }}
                />
              </div>
              <div className="relative">
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[10px] font-semibold uppercase tracking-[0.12em] mb-4">
                  <Sparkles className="h-3 w-3" />
                  Platform Position
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-white mb-3">{t('peppol.platformTitle')}</h3>
                <p className="text-blue-100/80 text-[15px] leading-relaxed mb-6 max-w-2xl">
                  {t('peppol.platformBody')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {platformCards.map((c, i) => (
                    <div
                      key={c.label}
                      className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 transition-all duration-300 hover:bg-white/20"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CARD_GRADIENTS[i]} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg`}
                      >
                        {i === 2 ? 5 : i + 1}
                      </div>
                      <div>
                        <p className="text-[11px] text-blue-300 font-medium">{c.label}</p>
                        <p className="text-sm font-bold text-white">{c.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* UBL XML */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="max-w-2xl mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/80 text-emerald-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <FileCode2 className="h-3.5 w-3.5" />
                Technical Specification
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                {t('peppol.ublTitle')}
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-xl">
                {t('peppol.ublSubtitle')}
              </p>
            </div>
          </AnimatedSection>
          <AnimatedSection direction="up" delay={100}>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-brand-900 via-[#1e4080] to-[#0f2147]">
                    <th className="text-start px-6 py-4 text-xs font-semibold uppercase tracking-wider text-blue-200 whitespace-nowrap">
                      {t('peppol.ublElementHeader')}
                    </th>
                    <th className="text-start px-6 py-4 text-xs font-semibold uppercase tracking-wider text-blue-200">
                      {t('peppol.ublDescHeader')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ublElements.map((row, i) => (
                    <tr
                      key={row.element}
                      className={`transition-colors duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50`}
                    >
                      <td className="px-6 py-3.5 font-mono text-xs text-blue-700 whitespace-nowrap border-b border-gray-100" dir="ltr">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                          {row.element}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 text-xs border-b border-gray-100">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimatedSection>

          <AnimatedSection direction="up" delay={200}>
            <div className="mt-8 flex flex-wrap items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="font-medium">BIS Billing 3.0 compliant</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-blue-200" />
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="font-medium">UBL 2.1 XML auto-generated</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-blue-200" />
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="font-medium">FTA compliant formatting</span>
              </div>
            </div>
          </AnimatedSection>
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
              {t('peppol.cta.title')}
            </h2>
            <p className="text-blue-200/90 text-[15px] leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('peppol.cta.subtitle')}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.04] hover:shadow-blue-500/40 active:scale-[0.97]"
            >
              {t('peppol.cta.button')} <ArrowRight className="h-5 w-5" />
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