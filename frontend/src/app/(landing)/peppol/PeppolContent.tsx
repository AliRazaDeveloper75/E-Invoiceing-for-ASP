'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

const CORNER_COLORS = ['bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-emerald-600', 'bg-teal-600'];
const CARD_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500'];

export function PeppolContent() {
  const { t } = useI18n();

  const corners = t<{ label: string; tag: string; desc: string }[]>('peppol.corners');
  const platformCards = t<{ label: string; val: string }[]>('peppol.platformCards');
  const ublElements = t<{ element: string; desc: string }[]>('peppol.ublElements');

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-xs sm:text-sm font-semibold uppercase tracking-widest mb-3">{t('peppol.hero.tag')}</p>
            <h1 className="text-2xl sm:text-4xl font-bold mb-4">{t('peppol.hero.title')}</h1>
            <p className="text-blue-100 text-sm sm:text-lg leading-relaxed">{t('peppol.hero.body')}</p>
          </div>
        </div>
      </section>

      {/* 5 Corners */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{t('peppol.cornersTitle')}</h2>
          <p className="text-gray-500 text-sm mb-10 sm:mb-12 max-w-2xl">{t('peppol.cornersSubtitle')}</p>

          {/* Mobile: vertical timeline */}
          <div className="lg:hidden mb-10">
            {corners.map((corner, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${CORNER_COLORS[i]} text-white font-bold text-sm shrink-0 z-10`}>
                    {i + 1}
                  </div>
                  {i < corners.length - 1 && (
                    <div className="w-0.5 flex-1 min-h-[1.5rem] bg-gray-200 my-1" />
                  )}
                </div>
                <div className={`pt-1 ${i < corners.length - 1 ? 'pb-5' : 'pb-0'}`}>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mb-1 ${CORNER_COLORS[i]}`}>
                    {corner.tag}
                  </span>
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{corner.label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{corner.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: horizontal grid with connecting lines */}
          <div className="hidden lg:grid grid-cols-5 mb-16">
            {corners.map((corner, i) => (
              <div key={i} className="relative flex flex-col items-center text-center px-2">
                {i > 0 && <div className="absolute start-0 end-1/2 top-6 h-0.5 bg-gray-200" />}
                {i < corners.length - 1 && <div className="absolute start-1/2 end-0 top-6 h-0.5 bg-gray-200" />}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full ${CORNER_COLORS[i]} text-white font-bold text-lg mb-4`}>
                  {i + 1}
                </div>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mb-1.5 ${CORNER_COLORS[i]}`}>
                  {corner.tag}
                </span>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{corner.label}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{corner.desc}</p>
              </div>
            ))}
          </div>

          {/* Where our platform sits */}
          <div className="rounded-2xl bg-[#1e3a5f] text-white p-6 sm:p-8">
            <h3 className="font-bold text-base sm:text-lg mb-3">{t('peppol.platformTitle')}</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">{t('peppol.platformBody')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {platformCards.map((c, i) => (
                <div key={c.label} className="flex items-center gap-3 bg-white/10 rounded-xl p-3 sm:p-4">
                  <div className={`w-8 h-8 rounded-full ${CARD_COLORS[i]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {i === 2 ? 5 : i + 1}
                  </div>
                  <div>
                    <p className="text-xs text-blue-300">{c.label}</p>
                    <p className="text-sm font-semibold">{c.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* UBL XML */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{t('peppol.ublTitle')}</h2>
          <p className="text-gray-500 text-sm mb-6 sm:mb-8">{t('peppol.ublSubtitle')}</p>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-[#1e3a5f] text-white">
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">{t('peppol.ublElementHeader')}</th>
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wider">{t('peppol.ublDescHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {ublElements.map((row, i) => (
                  <tr key={row.element} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 sm:px-6 py-3 font-mono text-xs text-blue-700 whitespace-nowrap" dir="ltr">{row.element}</td>
                    <td className="px-4 sm:px-6 py-3 text-gray-600 text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 bg-white border-t border-gray-100 text-center px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">{t('peppol.cta.title')}</h2>
        <p className="text-gray-500 text-sm mb-6 sm:mb-8">{t('peppol.cta.subtitle')}</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white font-semibold text-sm transition-colors">
          {t('peppol.cta.button')} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
