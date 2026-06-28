'use client';

import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, FileText, Zap,
  Lock, ChevronRight, Building2,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

const FEATURE_ICONS = [
  <FileText key="0" className="h-6 w-6" />,
  <Zap key="1" className="h-6 w-6" />,
  <Lock key="2" className="h-6 w-6" />,
];
const FEATURE_COLORS = ['text-blue-600 bg-blue-50', 'text-amber-600 bg-amber-50', 'text-indigo-600 bg-indigo-50'];
const LIFECYCLE_COLORS = ['bg-gray-400', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-red-500'];
const VALUE_COLORS = [
  { color: 'border-blue-200 bg-blue-50', heading: 'text-blue-700' },
  { color: 'border-emerald-200 bg-emerald-50', heading: 'text-emerald-700' },
  { color: 'border-purple-200 bg-purple-50', heading: 'text-purple-700' },
];

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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1e4080] to-[#0f2147] text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-4">
              {t('home.hero.titlePre')}{' '}
              <span className="text-blue-300">{t('home.hero.titleHighlight')}</span>
            </h1>

            <p className="text-lg sm:text-xl text-blue-200 font-medium mb-6">
              {t('home.hero.subtitle')}
            </p>

            <p className="text-base text-blue-100 leading-relaxed mb-10 max-w-2xl">
              {t('home.hero.body')}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-lg transition-all"
              >
                {t('home.hero.cta1')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all"
              >
                {t('home.hero.cta2')} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {heroTrust.map((tItem) => (
                <span key={tItem} className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{tItem}
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
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-[#1e3a5f]">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                {t('home.about.tag')}
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t('home.about.title')}
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                <p>{t('home.about.p1')}</p>
                <p>{t('home.about.p2')}</p>
              </div>
            </div>

            {/* Visual card */}
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm">{t('home.about.cardTitle')}</p>
                  <p className="text-blue-300 text-xs">{t('home.about.cardSub')}</p>
                </div>
              </div>
              {aboutList.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-sm text-blue-100">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Seamless Process ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              {t('home.process.tag')}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">
              {t('home.process.title')}
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] text-start">
              <p>{t('home.process.p1')}</p>
              <p>{t('home.process.p2')}</p>
            </div>
          </div>

          {/* Process steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-10">
            {processSteps.map((p, i, arr) => (
              <div key={p.label} className="relative flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-sm mb-3">
                  {String(i + 1).padStart(2, '0')}
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:block absolute top-6 start-[calc(50%+24px)] end-0 h-0.5 bg-gray-200" />
                )}
                <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services / Features ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              {t('home.services.tag')}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('home.services.title')}
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {t('home.services.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((f, i) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${FEATURE_COLORS[i]}`}>
                  {FEATURE_ICONS[i]}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                {t('home.compliance.tag')}
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-5">
                {t('home.compliance.title')}
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] mb-8">
                <p>{t('home.compliance.p1')}</p>
                <p>{t('home.compliance.p2')}</p>
                <p>{t('home.compliance.p3')}</p>
                <p className="font-semibold text-gray-800">{t('home.compliance.p4')}</p>
              </div>
              <ul className="space-y-3">
                {complianceList.map((c) => (
                  <li key={c} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Invoice Lifecycle */}
            <div>
              <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-2">
                  {t('home.compliance.cardTag')}
                </p>
                <h3 className="text-lg font-bold text-white mb-6">
                  {t('home.compliance.cardTitle')}
                </h3>
                {lifecycle.map((step, i) => (
                  <div key={step.status} className="flex items-start gap-3 mb-4 last:mb-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-3 h-3 rounded-full mt-0.5 ${LIFECYCLE_COLORS[i]}`} />
                      {i < lifecycle.length - 1 && (
                        <div className="w-0.5 h-6 bg-white/20 mt-1" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white">{step.status}</span>
                      <p className="text-xs text-blue-200 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
                <p className="mt-6 text-xs text-blue-300 leading-relaxed">
                  {t('home.compliance.cardFoot')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-8 space-y-4">
              {whyCards.map((item) => (
                <div key={item.label} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                {t('home.why.tag')}
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-5">
                {t('home.why.title')}
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                <p>{t('home.why.p1')}</p>
                <p>{t('home.why.p2')}</p>
                <p>{t('home.why.p3')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value of E-Invoicing ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              {t('home.value.tag')}
            </p>
            <h2 className="text-3xl font-bold text-gray-900">{t('home.value.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {valueCards.map((card, i) => (
              <div
                key={card.title}
                className={`rounded-2xl border p-6 ${VALUE_COLORS[i].color}`}
              >
                <h3 className={`font-bold text-base mb-3 ${VALUE_COLORS[i].heading}`}>{card.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="bg-[#1e3a5f] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
            {t('home.cta.tag')}
          </p>
          <h2 className="text-3xl font-bold text-white mb-5">
            {t('home.cta.title')}
          </h2>
          <div className="space-y-3 text-blue-200 text-[15px] leading-relaxed mb-8 max-w-2xl mx-auto">
            <p>{t('home.cta.p1')}</p>
            <p>{t('home.cta.p2')}</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-lg transition-all"
          >
            {t('home.cta.button')} <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-6 text-sm font-semibold text-blue-200">
            {t('home.cta.foot')}
          </p>
        </div>
      </section>

      {/* ── Footer tagline ───────────────────────────────────────────────────── */}
      <section className="bg-[#0f2147] py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-white font-bold text-lg">{t('home.tagline.brand')}</p>
          <p className="text-blue-300 text-sm leading-relaxed">{t('home.tagline.p1')}</p>
          <p className="text-blue-400 text-sm leading-relaxed">{t('home.tagline.p2')}</p>
        </div>
      </section>
    </>
  );
}
