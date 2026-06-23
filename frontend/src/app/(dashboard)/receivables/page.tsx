'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Wallet, AlertTriangle, FileText, Clock } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((r) => r.data?.data ?? r.data);

const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Summary {
  currency: string; total_receivable: string; total_overdue: string;
  open_invoice_count: number; overdue_invoice_count: number; dso_days: number;
}
interface Aging {
  currency: string; total: string;
  buckets: Record<string, string>; labels: Record<string, string>;
}
interface CustomerRow {
  customer_id: string; customer_name: string;
  outstanding: string; overdue: string; invoice_count: number;
}

function Card({ icon: Icon, label, value, sub, tone = 'default' }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  tone?: 'default' | 'danger' | 'warn';
}) {
  const tones = {
    default: 'text-brand-600 bg-brand-50',
    danger: 'text-red-600 bg-red-50',
    warn: 'text-amber-600 bg-amber-50',
  } as const;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReceivablesPage() {
  const { activeId } = useCompany();
  const q = activeId ? `?company_id=${activeId}` : '';
  const { data: summary } = useSWR<Summary>(activeId ? `/reports/ar/summary/${q}` : null, fetcher);
  const { data: aging }   = useSWR<Aging>(activeId ? `/reports/ar/aging/${q}` : null, fetcher);
  const { data: byCust }  = useSWR<{ customers: CustomerRow[] }>(activeId ? `/reports/ar/by-customer/${q}` : null, fetcher);

  const cur = summary?.currency ?? 'AED';
  const bucketKeys = ['current', 'd1_15', 'd16_30', 'd31_45', 'd46_60', 'd60_plus'];
  const BUCKET_LABELS: Record<string, string> = {
    current: 'Current', d1_15: '1–15', d16_30: '16–30', d31_45: '31–45', d46_60: '46–60', d60_plus: '60+',
  };
  const agingTotal = Number(aging?.total ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable</h1>
        <p className="text-gray-500 text-sm mt-0.5">Outstanding invoices, aging and per-customer balances</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={Wallet} label="Total Receivable" value={`${cur} ${fmt(summary?.total_receivable ?? 0)}`}
          sub={`${summary?.open_invoice_count ?? 0} open invoices`} />
        <Card icon={AlertTriangle} label="Overdue" tone="danger"
          value={`${cur} ${fmt(summary?.total_overdue ?? 0)}`}
          sub={`${summary?.overdue_invoice_count ?? 0} overdue invoices`} />
        <Card icon={FileText} label="Open Invoices" value={String(summary?.open_invoice_count ?? 0)} />
        <Card icon={Clock} label="DSO (days)" tone="warn" value={String(summary?.dso_days ?? 0)}
          sub="Avg. days to collect" />
      </div>

      {/* Aging */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Aging</h2>
        <div className="grid grid-cols-6 gap-3">
          {bucketKeys.map((k) => {
            const val = Number(aging?.buckets?.[k] ?? 0);
            const pct = agingTotal > 0 ? Math.round((val / agingTotal) * 100) : 0;
            const danger = k === 'd46_60' || k === 'd60_plus';
            return (
              <div key={k} className="text-center">
                <div className="h-24 flex items-end justify-center mb-2">
                  <div className={`w-8 rounded-t ${danger ? 'bg-red-400' : k === 'current' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ height: `${Math.max(pct, 2)}%` }} />
                </div>
                <p className="text-xs font-medium text-gray-700">{BUCKET_LABELS[k] ?? aging?.labels?.[k] ?? k}</p>
                <p className="text-xs text-gray-500">{cur} {fmt(val)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* By customer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-100">Outstanding by Customer</h2>
        {!byCust ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</p>
        ) : byCust.customers.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No outstanding receivables 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Invoices</th>
                <th className="px-5 py-3 text-right">Overdue</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byCust.customers.map((c) => (
                <tr key={c.customer_id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.customer_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{c.invoice_count}</td>
                  <td className="px-5 py-3.5 text-right text-red-600">{Number(c.overdue) > 0 ? `${cur} ${fmt(c.overdue)}` : '—'}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{cur} {fmt(c.outstanding)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/receivables/${c.customer_id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      Statement →
                    </Link>
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
