'use client';

import Link from 'next/link';
import { ArrowRight, Target, Users, Shield, Award } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

const VALUE_ICONS = [
  <Target key="0" className="h-5 w-5" />,
  <Users key="1" className="h-5 w-5" />,
  <Shield key="2" className="h-5 w-5" />,
  <Award key="3" className="h-5 w-5" />,
];

export function AboutContent() {
  const { t } = useI18n();

  const values = t<{ title: string; desc: string }[]>('about.values');
  const timeline = t<{ year: string; event: string }[]>('about.timeline');

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">{t('about.hero.tag')}</p>
            <h1 className="text-4xl font-bold mb-4">{t('about.hero.title')}</h1>
            <p className="text-blue-100 text-lg leading-relaxed">{t('about.hero.body')}</p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">{t('about.valuesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <div key={v.title} className="flex gap-4 p-6 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1e3a5f] text-white shrink-0">
                  {VALUE_ICONS[i]}
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

      {/* Timeline */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">{t('about.timelineTitle')}</h2>
          <div className="relative border-s-2 border-[#1e3a5f] ms-4 space-y-8">
            {timeline.map((item) => (
              <div key={item.year} className="relative ps-8">
                <div className="absolute -start-[9px] w-4 h-4 rounded-full bg-[#1e3a5f] border-2 border-white" />
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{item.year}</span>
                <p className="text-sm text-gray-700 mt-1">{item.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('about.cta.title')}</h2>
        <p className="text-gray-500 mb-8">{t('about.cta.subtitle')}</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white font-semibold text-sm transition-colors">
          {t('about.cta.button')} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
