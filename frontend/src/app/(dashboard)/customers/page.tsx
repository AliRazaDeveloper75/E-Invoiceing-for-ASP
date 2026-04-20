'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Building2 } from 'lucide-react';
import type { Customer } from '@/types';

async function fetcher(url: string) {
  const r = await api.get<{ results: Customer[]; pagination: { count: number } }>(url);
  return r.data;
}

const TYPE_LABELS: Record<string, string> = {
  b2b: 'B2B', b2g: 'B2G', b2c: 'B2C',
};

export default function CustomersPage() {
  const { user } = useAuth();
  const { activeId } = useCompany();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);

  // Admin: no company_id needed — backend returns all customers
  // Supplier: requires activeId
  const url = isAdmin
    ? `/customers/?page=${page}`
    : activeId
      ? `/customers/?company_id=${activeId}&page=${page}`
      : null;

  const { data, isLoading } = useSWR(url, fetcher);

  const customers  = data?.results ?? [];
  const totalPages = Math.ceil((data?.pagination?.count ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          {data && (
            <p className="text-gray-500 text-sm mt-0.5">
              {data.pagination?.count ?? 0} total{isAdmin ? ' — all companies' : ''}
            </p>
          )}
        </div>
        {!isAdmin && (
          <Link href="/customers/new">
            <Button><Plus className="h-4 w-4" /> New Customer</Button>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="animate-spin h-6 w-6 rounded-full border-4 border-brand-600 border-t-transparent mx-auto" />
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="font-medium">No customers yet</p>
            <p className="text-sm mt-1">
              {isAdmin ? 'No customers exist on the platform yet.' : 'Add your first customer to start issuing invoices.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                {isAdmin && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TRN</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {(c as Customer & { company_name?: string }).company_name ?? '—'}
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{c.trn || '—'}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={c.customer_type === 'b2b' ? 'info' : c.customer_type === 'b2g' ? 'warning' : 'default'}>
                      {TYPE_LABELS[c.customer_type]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{c.country}</td>
                  <td className="px-5 py-3.5 text-gray-500">{c.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
