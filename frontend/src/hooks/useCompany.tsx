'use client';

/**
 * Shared company state via React Context.
 * The active company ID is persisted in localStorage and shared across
 * all components — when the Sidebar changes the company, every consumer
 * re-renders and SWR keys update automatically.
 */
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Company } from '@/types';

const STORAGE_KEY = 'active_company_id';

function companiesFetcher() {
  return api.get<{ success: boolean; data: Company[] }>('/companies/').then(
    (r) => r.data.data
  );
}

// ── Context ──────────────────────────────────────────────────────────────────

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  activeId: string | null;
  setActiveId: (id: string) => void;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: companies = [], isLoading } = useSWR<Company[]>(
    '/companies/',
    companiesFetcher,
  );

  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  // If stored value changes in another tab, pick it up.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        setActiveIdState(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-select first company if nothing is stored
  useEffect(() => {
    if (!activeId && companies.length > 0) {
      setActiveId(companies[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, activeId]);

  function setActiveId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveIdState(id);
  }

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeId) ?? null,
    [companies, activeId],
  );

  const value = useMemo(
    () => ({ companies, activeCompany, activeId, setActiveId, isLoading }),
    [companies, activeCompany, activeId, isLoading],
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany must be used within a <CompanyProvider>');
  }
  return ctx;
}
