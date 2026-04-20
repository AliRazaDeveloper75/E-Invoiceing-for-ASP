'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import type { DashboardStats, InvoiceListItem, InvoiceStatus } from '@/types';

function statFetcher(url: string) {
  return api.get<{ success: boolean; data: DashboardStats }>(url).then((r) => r.data.data);
}

function invoiceFetcher(url: string) {
  return api.get<{ success: boolean; results: InvoiceListItem[] }>(url).then((r) => r.data.results ?? []);
}

const STATUS_ORDER: InvoiceStatus[] = [
  'draft', 'pending', 'submitted', 'validated', 'rejected', 'cancelled', 'paid'
];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { activeId, activeCompany } = useCompany();

  const { data: stats } = useSWR<DashboardStats>(
    activeId ? `/invoices/dashboard/?company_id=${activeId}` : null,
    statFetcher
  );

  const { data: recentInvoices = [] } = useSWR<InvoiceListItem[]>(
    activeId ? `/invoices/?company_id=${activeId}&page_size=5` : null,
    invoiceFetcher
  );

  if (!activeId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg font-medium">No company selected</p>
        <p className="text-sm mt-1">Create or join a company to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">{activeCompany?.name}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Invoices"
          value={stats?.total_invoices ?? '—'}
        />
        <StatCard
          label="Total Revenue"
          value={stats ? `AED ${Number(stats.total_revenue).toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : '—'}
          sub="Validated + Paid"
        />
        <StatCard
          label="VAT Collected"
          value={stats ? `AED ${Number(stats.total_vat).toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : '—'}
        />
        <StatCard
          label="Validated"
          value={stats?.status_breakdown?.validated ?? 0}
          sub="By ASP"
        />
      </div>

      {/* Status breakdown */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h2>
          <div className="flex flex-wrap gap-3">
            {STATUS_ORDER.map((s) => {
              const count = stats.status_breakdown[s] ?? 0;
              if (!count) return null;
              return (
                <div key={s} className="flex items-center gap-2">
                  <InvoiceStatusBadge status={s} />
                  <span className="text-sm text-gray-600 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent Invoices</h2>
          <a href="/invoices" className="text-xs text-brand-600 hover:underline font-medium">
            View all →
          </a>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Number</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <a href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-medium">
                      {inv.invoice_number}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{inv.customer_name}</td>
                  <td className="px-5 py-3 text-gray-500">{inv.issue_date}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    {Number(inv.total_amount).toLocaleString('en-AE', {
                      style: 'currency', currency: inv.currency
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
