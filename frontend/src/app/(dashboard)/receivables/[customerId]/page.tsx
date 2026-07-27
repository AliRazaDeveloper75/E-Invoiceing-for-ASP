'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, Wallet, AlertCircle, Loader2,
} from 'lucide-react';
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
  paid:           'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
  partially_paid: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
  overdue:        'bg-red-50 text-red-700 ring-1 ring-red-200/60',
  submitted:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60',
  validated:      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
  pending:        'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
  draft:          'bg-gray-100 text-gray-600 ring-1 ring-gray-200/60',
  cancelled:      'bg-gray-100 text-gray-500 ring-1 ring-gray-200/60',
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
  const paidLines = data?.lines?.filter((l) => l.status === 'paid') ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 rounded-2xl p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.18),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.12),transparent_50%)] pointer-events-none" />
          <div className="relative z-10">
            <Link
              href="/receivables"
              className="inline-flex items-center gap-1.5 text-sm text-blue-300/70 hover:text-white mb-4 sm:mb-5 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Receivables
            </Link>

            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-200/60 uppercase tracking-[0.12em]">Customer Statement</span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {data?.customer_name ?? '...'}
                </h1>
                <p className="text-xs sm:text-sm text-blue-200/50 mt-1.5">
                  Outstanding balance for this customer
                </p>
              </div>

              {data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/[0.08] text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-300/60" />
                      <p className="text-[9px] sm:text-[10px] font-semibold text-blue-200/50 uppercase tracking-wider">Outstanding</p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white">{cur} {totalOutstanding}</p>
                  </div>
                  <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/[0.08] text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-300/60" />
                      <p className="text-[9px] sm:text-[10px] font-semibold text-blue-200/50 uppercase tracking-wider">Overdue</p>
                    </div>
                    <p className={clsx('text-xs sm:text-sm font-bold', overdueTotal > 0 ? 'text-red-300' : 'text-white')}>
                      {overdueTotal > 0 ? `${cur} ${fmt(overdueTotal)}` : '—'}
                    </p>
                  </div>
                  <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/[0.08] text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-300/60" />
                      <p className="text-[9px] sm:text-[10px] font-semibold text-blue-200/50 uppercase tracking-wider">Invoices</p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white">{data.lines.length}</p>
                  </div>
                  <div className="bg-white/[0.07] backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/[0.08] text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-300/60" />
                      <p className="text-[9px] sm:text-[10px] font-semibold text-blue-200/50 uppercase tracking-wider">Paid</p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-emerald-300">{paidLines.length}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ── Table ── */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          {/* Table header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Invoice History</h2>
                <p className="text-xs text-gray-500">{data?.lines.length ?? 0} invoices</p>
              </div>
            </div>
            {data && data.lines.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span>{overdueLines.length} overdue</span>
              </div>
            )}
          </div>

          {/* ── Mobile: card list ── */}
          <div className="sm:hidden">
            {!data ? (
              <div className="py-14 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  </div>
                  <p className="text-sm text-gray-400">Loading statement...</p>
                </div>
              </div>
            ) : data.lines.length === 0 ? (
              <div className="py-14 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">All cleared</p>
                    <p className="text-xs text-gray-500 mt-0.5">No outstanding invoices</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-2.5">
                {data.lines.map((l) => (
                  <Link
                    key={l.invoice_id}
                    href={`/invoices/${l.invoice_id}`}
                    className={clsx(
                      'block rounded-xl border p-4 transition-all duration-200',
                      'hover:shadow-md hover:-translate-y-0.5',
                      l.is_overdue
                        ? 'border-red-200/60 bg-gradient-to-r from-red-50/40 to-white hover:border-red-200 hover:shadow-red-100/40'
                        : 'border-gray-200/60 bg-white hover:border-blue-200 hover:shadow-blue-100/40',
                    )}
                  >
                    {/* Top row: invoice # + status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={clsx(
                          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                          l.is_overdue ? 'bg-red-100' : 'bg-blue-50',
                        )}>
                          <FileText className={clsx('h-4 w-4', l.is_overdue ? 'text-red-500' : 'text-blue-500')} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{l.invoice_number}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Issued {l.issue_date}</p>
                        </div>
                      </div>
                      <span className={clsx(
                        'text-[10px] font-semibold px-2.5 py-1 rounded-full',
                        STATUS_STYLE[l.is_overdue ? 'overdue' : l.status] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {l.is_overdue ? 'Overdue' : (STATUS_LABEL[l.status] ?? l.status.replace('_', ' '))}
                      </span>
                    </div>

                    {/* Amounts row */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50/60 rounded-lg p-2.5">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Total</p>
                        <p className="text-xs font-semibold text-gray-800 tabular-nums">{cur} {fmt(l.total_amount)}</p>
                      </div>
                      <div className="text-center border-x border-gray-200/60">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Paid</p>
                        <p className="text-xs font-semibold text-emerald-600 tabular-nums">{cur} {fmt(l.amount_paid)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Balance</p>
                        <p className={clsx('text-xs font-bold tabular-nums', l.is_overdue ? 'text-red-600' : 'text-gray-900')}>
                          {cur} {fmt(l.balance_due)}
                        </p>
                      </div>
                    </div>

                    {/* Bottom: due date + overdue badge */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>Due {l.due_date || '—'}</span>
                      </div>
                      {l.is_overdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 ring-1 ring-red-200/60 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-3 w-3" />
                          {l.days_overdue} days overdue
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Issue Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Running</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!data ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                        </div>
                        <p className="text-sm text-gray-400">Loading statement...</p>
                      </div>
                    </td>
                  </tr>
                ) : data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">All cleared</p>
                          <p className="text-xs text-gray-500 mt-0.5">No outstanding invoices for this customer</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : data.lines.map((l, idx) => (
                  <tr
                    key={l.invoice_id}
                    className={clsx(
                      'group transition-all duration-200 border-l-2',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                      'hover:bg-blue-50/20',
                      l.is_overdue
                        ? 'border-l-red-400 bg-red-50/15 hover:bg-red-50/25'
                        : 'border-l-transparent hover:border-l-blue-200',
                    )}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/invoices/${l.invoice_id}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {l.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-500 tabular-nums">{l.issue_date}</td>
                    <td className="px-5 py-4 tabular-nums">
                      <span className={clsx(l.is_overdue ? 'text-red-600' : 'text-gray-500')}>
                        {l.due_date || '—'}
                      </span>
                      {l.is_overdue && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-100/80 ring-1 ring-red-200/60 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {l.days_overdue}d
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full',
                        STATUS_STYLE[l.is_overdue ? 'overdue' : l.status] ?? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/60',
                      )}>
                        {l.is_overdue ? 'Overdue' : (STATUS_LABEL[l.status] ?? l.status.replace('_', ' '))}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-600">{cur} {fmt(l.total_amount)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-500">{cur} {fmt(l.amount_paid)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900">{cur} {fmt(l.balance_due)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-gray-500">{cur} {fmt(l.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {data && data.lines.length > 0 && (
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-gray-50/80 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs">
              <span className="text-gray-500">
                Showing <span className="font-semibold text-gray-700">{data.lines.length}</span> invoice{data.lines.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-gray-400">
                  Paid: <span className="font-semibold text-emerald-600">{cur} {fmt(paidLines.reduce((s, l) => s + Number(l.amount_paid), 0))}</span>
                </span>
                <span className="text-gray-400">
                  Balance: <span className="font-semibold text-gray-900">{cur} {totalOutstanding}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </AnimatedSection>
    </div>
  );
}
