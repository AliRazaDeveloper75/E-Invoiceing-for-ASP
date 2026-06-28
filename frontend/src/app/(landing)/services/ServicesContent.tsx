'use client';

import Link from 'next/link';
import { ArrowRight, FileText, BarChart3, Shield, Download, Zap, Users } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

const ICONS = [
  <FileText key="0" className="h-7 w-7" />,
  <Shield key="1" className="h-7 w-7" />,
  <Zap key="2" className="h-7 w-7" />,
  <Download key="3" className="h-7 w-7" />,
  <BarChart3 key="4" className="h-7 w-7" />,
  <Users key="5" className="h-7 w-7" />,
];

const COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose', 'indigo'];

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-600 bg-blue-50 border-blue-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  amber: 'text-amber-600 bg-amber-50 border-amber-100',
  purple: 'text-purple-600 bg-purple-50 border-purple-100',
  rose: 'text-rose-600 bg-rose-50 border-rose-100',
  indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
};

const TAG_COLOR: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

export function ServicesContent() {
  const { t } = useI18n();

  const cards = t<{ title: string; desc: string; tags: string[] }[]>('servicesPage.cards');
  const vatFields = t<string[]>('servicesPage.faf.vatFields');
  const exciseFields = t<string[]>('servicesPage.faf.exciseFields');

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">{t('servicesPage.hero.tag')}</p>
            <h1 className="text-4xl font-bold mb-4">{t('servicesPage.hero.title')}</h1>
            <p className="text-blue-100 text-lg leading-relaxed">{t('servicesPage.hero.body')}</p>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((s, i) => {
              const color = COLORS[i];
              return (
                <div key={s.title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-5 ${COLOR_MAP[color]}`}>
                    {ICONS[i]}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4">{s.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.tags.map((tag) => (
                      <span key={tag} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TAG_COLOR[color]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAF compliance table */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('servicesPage.faf.title')}</h2>
          <p className="text-gray-500 text-sm mb-8">{t('servicesPage.faf.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: t('servicesPage.faf.vatTitle'), color: 'border-blue-200 bg-blue-50', fields: vatFields },
              { title: t('servicesPage.faf.exciseTitle'), color: 'border-orange-200 bg-orange-50', fields: exciseFields },
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
        <h2 className="text-2xl font-bold text-white mb-4">{t('servicesPage.cta.title')}</h2>
        <p className="text-blue-200 mb-8">{t('servicesPage.cta.subtitle')}</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-colors">
          {t('servicesPage.cta.button')} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
