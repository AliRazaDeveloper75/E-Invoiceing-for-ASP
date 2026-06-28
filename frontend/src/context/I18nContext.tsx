'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dictionaries, Locale } from '@/i18n/dictionaries';

type Dir = 'ltr' | 'rtl';

interface I18nContextValue {
  locale: Locale;
  dir: Dir;
  setLocale: (l: Locale) => void;
  /** Resolve a dotted key (e.g. 'home.hero.title'). Returns string/array/object. */
  t: <T = string>(key: string) => T;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'enumerak_locale';

function resolve(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Load saved preference once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'en' || saved === 'ar') setLocaleState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Reflect locale on the <html> element (lang + dir) for RTL support.
  useEffect(() => {
    const dir: Dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    <T = string,>(key: string): T => {
      const val = resolve(dictionaries[locale], key);
      if (val !== undefined) return val as T;
      const fallback = resolve(dictionaries.en, key);
      return (fallback !== undefined ? fallback : key) as T;
    },
    [locale],
  );

  const dir: Dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, dir, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
