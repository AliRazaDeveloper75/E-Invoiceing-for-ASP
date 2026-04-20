'use client';

/**
 * Persists the active company selection across page loads.
 * Company ID is stored in localStorage and exposed via this hook.
 */
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Company } from '@/types';

const STORAGE_KEY = 'active_company_id';

function companiesFetcher() {
  return api.get<{ success: boolean; data: Company[] }>('/companies/').then(
    (r) => r.data.data
  );
}

export function useCompany() {
  const { data: companies = [], isLoading } = useSWR<Company[]>(
    '/companies/',
    companiesFetcher
  );

  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveIdState(stored);
  }, []);

  // Auto-select first company if nothing is stored
  useEffect(() => {
    if (!activeId && companies.length > 0) {
      setActiveId(companies[0].id);
    }
  }, [companies, activeId]);

  function setActiveId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveIdState(id);
  }

  const activeCompany = companies.find((c) => c.id === activeId) ?? null;

  return { companies, activeCompany, activeId, setActiveId, isLoading };
}
