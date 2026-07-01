'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '@/context/I18nContext';
import { LOCALES, Locale } from '@/i18n/dictionaries';

interface Props {
  /** 'dark' for use on the dark navbar, 'light' for white backgrounds. */
  variant?: 'dark' | 'light';
  className?: string;
}

export function LanguageSwitcher({ variant = 'dark', className }: Props) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const trigger =
    variant === 'dark'
      ? 'text-blue-200 hover:text-white hover:bg-white/10'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';

  return (
    <div className={clsx('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          trigger,
        )}
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        <span>{current.native}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-40 rounded-xl border border-gray-200 bg-white shadow-lg z-50 py-1">
          {LOCALES.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLocale(l.code as Locale);
                  setOpen(false);
                }}
                className={clsx(
                  'flex items-center justify-between w-full px-3 py-2 text-sm transition-colors',
                  active ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                <span>{l.native}</span>
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
