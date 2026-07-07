'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { clsx } from 'clsx';

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

const STATUS_STYLE: Record<string, string> = {
  paid:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  overdue:        'bg-red-50 text-red-700 border-red-200',
  submitted:      'bg-blue-50 text-blue-700 border-blue-200',
  validated:      'bg-green-50 text-green-700 border-green-200',
  pending:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  draft:          'bg-gray-100 text-gray-600 border-gray-200',
  cancelled:      'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid', partially_paid: 'Partial', overdue: 'Overdue', submitted: 'Submitted',
  validated: 'Validated', pending: 'Pending', draft: 'Draft', cancelled: 'Cancelled',
};

export default function CustomerStatementPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { activeId } = useCompany();
  const { data } = useSWR<Statement>(
    activeId ? `/reports/ar/customer/${customerId}/statement/?company_id=${activeId}` : null,
    fetcher,
  );
  const cur = data?.currency ?? 'AED';

  const totalOutstanding = fmt(data?.total_outstanding ?? 0);
  const overdueLines = data?.lines?.filter((l) => l.is_overdue) ?? [];
  const overdueTotal = overdueLines.reduce((s, l) => s + Number(l.balance_due), 0);

  return (
    <div className="space-y-6">

      {/* ── Header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <Link href="/receivables" className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Receivables
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Statement — {data?.customer_name ?? '\u2026'}
                </h1>
                <p className="text-sm text-blue-200/70 mt-1">
                  Outstanding: <span className="font-semibold text-white">{cur} {totalOutstanding}</span>
                </p>
              </div>
              {data && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-xl px-3 py-2.5 border border-white/10 text-center">
                    <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">Total</p>
                    <p className="text-sm font-bold text-white">{cur} {totalOutstanding}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2.5 border border-white/10 text-center">
                    <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">Overdue</p>
                    <p className={clsx('text-sm font-bold', overdueTotal > 0 ? 'text-red-300' : 'text-white')}>
                      {overdueTotal > 0 ? `${cur} ${fmt(overdueTotal)}` : '\u2014'}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2.5 border border-white/10 text-center">
                    <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">Invoices</p>
                    <p className="text-sm font-bold text-white">{data?.lines.length ?? 0}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ── Table ── */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-950 to-indigo-950">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Invoice</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Issue</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Due</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Paid</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Balance</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Running</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!data ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4 animate-spin" /> Loading\u2026
                      </div>
                    </td>
                  </tr>
                ) : data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">All cleared</p>
                      <p className="text-xs text-gray-500 mt-0.5">No outstanding invoices for this customer</p>
                    </td>
                  </tr>
                ) : data.lines.map((l, idx) => (
                  <tr
                    key={l.invoice_id}
                    className={clsx(
                      'transition-all duration-200',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                      'hover:bg-blue-50/30 hover:shadow-inner',
                      l.is_overdue && 'border-l-4 border-l-red-400',
                    )}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/invoices/${l.invoice_id}`}
                        className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {l.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-500 tabular-nums">{l.issue_date}</td>
                    <td className="px-5 py-4 text-gray-500 tabular-nums">
                      {l.due_date || '\u2014'}
                      {l.is_overdue && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200/60 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {l.days_overdue}d
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                        STATUS_STYLE[l.is_overdue ? 'overdue' : l.status] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {l.is_overdue ? 'Overdue' : (STATUS_LABEL[l.status] ?? l.status.replace('_', ' '))}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">{fmt(l.total_amount)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-500">{fmt(l.amount_paid)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900">{fmt(l.balance_due)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-500">{fmt(l.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
