'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { ArrowLeft } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((r) => r.data?.data ?? r.data);
const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Line {
  invoice_id: string; invoice_number: string; issue_date: string; due_date: string;
  status: string; total_amount: string; amount_paid: string; balance_due: string;
  running_balance: string; is_overdue: boolean; days_overdue: number;
}
interface Statement {
  currency: string; customer_name: string; total_outstanding: string; lines: Line[];
}

export default function CustomerStatementPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params);
  const { activeId } = useCompany();
  const { data } = useSWR<Statement>(
    activeId ? `/reports/ar/customer/${customerId}/statement/?company_id=${activeId}` : null,
    fetcher,
  );
  const cur = data?.currency ?? 'AED';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/receivables" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-4 w-4" /> Receivables
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Statement — {data?.customer_name ?? '…'}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Total outstanding: <span className="font-semibold text-gray-900">{cur} {fmt(data?.total_outstanding ?? 0)}</span>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Running</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!data ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : data.lines.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No invoices.</td></tr>
            ) : data.lines.map((l) => (
              <tr key={l.invoice_id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <Link href={`/invoices/${l.invoice_id}`} className="font-medium text-blue-600 hover:text-blue-700">
                    {l.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{l.issue_date}</td>
                <td className="px-4 py-3 text-gray-500">
                  {l.due_date || '—'}
                  {l.is_overdue && <span className="ml-1 text-[10px] text-red-600 font-semibold">({l.days_overdue}d)</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.status.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right text-gray-700">{fmt(l.total_amount)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(l.amount_paid)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(l.balance_due)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(l.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
