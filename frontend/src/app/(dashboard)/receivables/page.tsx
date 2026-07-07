'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { useMemo } from 'react';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Wallet, AlertTriangle, FileText, Clock,
  TrendingUp, ArrowRight, Loader2, Users,
} from 'lucide-react';
import { clsx } from 'clsx';

const fetcher = (url: string) => api.get(url).then((r) => r.data?.data ?? r.data);

const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
function absUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${BACKEND_URL}${url}` : url;
}

interface Summary {
  currency: string; total_receivable: string; total_overdue: string;
  open_invoice_count: number; overdue_invoice_count: number; dso_days: number;
}
interface Aging {
  currency: string; total: string;
  buckets: Record<string, string>; labels: Record<string, string>;
}
interface CustomerRow {
  customer_id: string; customer_name: string; logo?: string | null;
  outstanding: string; overdue: string; invoice_count: number;
}

const CARD_CONFIG = [
  { label: 'Total Receivable',    icon: Wallet,        color: 'blue',    desc: 'open invoices' },
  { label: 'Overdue',             icon: AlertTriangle, color: 'red',     desc: 'overdue' },
  { label: 'Open Invoices',       icon: FileText,      color: 'indigo',  desc: 'outstanding' },
  { label: 'DSO (days)',          icon: Clock,         color: 'amber',   desc: 'Avg. days to collect' },
];

const CARD_STYLES: Record<string, { icon: string; value: string; badge: string }> = {
  blue:   { icon: 'from-blue-500 to-blue-600',   value: 'text-blue-600',   badge: 'bg-blue-50 text-blue-700' },
  red:    { icon: 'from-red-500 to-red-600',     value: 'text-red-600',    badge: 'bg-red-50 text-red-700' },
  indigo: { icon: 'from-indigo-500 to-indigo-600', value: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700' },
  amber:  { icon: 'from-amber-500 to-amber-600', value: 'text-amber-600',  badge: 'bg-amber-50 text-amber-700' },
};

const bucketKeys = ['current', 'd1_15', 'd16_30', 'd31_45', 'd46_60', 'd60_plus'];
const BUCKET_LABELS: Record<string, string> = {
  current: 'Current', d1_15: '1–15', d16_30: '16–30', d31_45: '31–45', d46_60: '46–60', d60_plus: '60+',
};
const BUCKET_COLORS: Record<string, string> = {
  current: 'bg-blue-300',
  d1_15: 'bg-blue-400',
  d16_30: 'bg-blue-500',
  d31_45: 'bg-blue-600',
  d46_60: 'bg-blue-700',
  d60_plus: 'bg-blue-800',
};

export default function ReceivablesPage() {
  const { activeId, activeCompany } = useCompany();
  const q = activeId ? `?company_id=${activeId}` : '';
  const { data: summary } = useSWR<Summary>(activeId ? `/reports/ar/summary/${q}` : null, fetcher);
  const { data: aging }   = useSWR<Aging>(activeId ? `/reports/ar/aging/${q}` : null, fetcher);
  const { data: byCust }  = useSWR<{ customers: CustomerRow[] }>(activeId ? `/reports/ar/by-customer/${q}` : null, fetcher);

  const cur = summary?.currency ?? 'AED';
  const agingTotal = Number(aging?.total ?? 0);
  const isLoading = !summary || !aging;

  const statsValues = useMemo(() => [
    `${cur} ${fmt(summary?.total_receivable ?? 0)}`,
    `${cur} ${fmt(summary?.total_overdue ?? 0)}`,
    String(summary?.open_invoice_count ?? 0),
    String(summary?.dso_days ?? 0),
  ], [summary, cur]);

  const statsSubs = [
    `${summary?.open_invoice_count ?? 0} open invoices`,
    `${summary?.overdue_invoice_count ?? 0} overdue`,
    undefined,
    'Avg. days to collect',
  ];

  return (
    <div className="space-y-6">

      {/* ── Header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Receivables</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Accounts Receivable</h1>
              <p className="text-sm text-blue-200/60 mt-0.5">
                Outstanding invoices, aging and per-customer balances
              </p>
            </div>
            {isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-300 shrink-0" />
            )}
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {CARD_CONFIG.map((cfg, i) => (
              <div key={cfg.label} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">{cfg.label}</p>
                <p className={clsx('text-lg font-bold text-white mt-0.5', CARD_STYLES[cfg.color].value)}>
                  {statsValues[i]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ── Aging ── */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Aging</h2>
                  <p className="text-xs text-gray-500">Outstanding balance by age bracket</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total outstanding</p>
                <p className="text-lg font-bold text-gray-900">{cur} {fmt(aging?.total ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {/* Horizontal stacked bar */}
            {agingTotal > 0 && (
              <div className="mb-7">
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 ring-1 ring-inset ring-black/5">
                  {bucketKeys.map((k) => {
                    const val = Number(aging?.buckets?.[k] ?? 0);
                    const pct = (val / agingTotal) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <div
                        key={k}
                        className={clsx(
                          'transition-all duration-1000 first:rounded-l-full last:rounded-r-full',
                          BUCKET_COLORS[k],
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                  <span>Current</span>
                  <span>60+ days</span>
                </div>
              </div>
            )}

            {/* Bucket grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {bucketKeys.map((k, idx) => {
                const val = Number(aging?.buckets?.[k] ?? 0);
                const pct = agingTotal > 0 ? Math.round((val / agingTotal) * 100) : 0;
                const isOlder = k === 'd46_60' || k === 'd60_plus' || k === 'd31_45';
                const borderColor = isOlder
                  ? 'border-blue-200 hover:border-blue-300'
                  : 'border-gray-200 hover:border-gray-300';
                const topAccent = k === 'd60_plus'
                  ? 'from-blue-800 to-indigo-700'
                  : k === 'd46_60'
                    ? 'from-blue-700 to-blue-800'
                    : k === 'd31_45'
                      ? 'from-blue-600 to-blue-700'
                      : k === 'd16_30'
                        ? 'from-blue-500 to-blue-600'
                        : k === 'd1_15'
                          ? 'from-blue-400 to-blue-500'
                          : 'from-blue-300 to-blue-400';
                return (
                  <div
                    key={k}
                    className={clsx(
                      'relative bg-white rounded-xl border-2 px-4 pt-5 pb-4 text-center',
                      'shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300',
                      borderColor,
                    )}
                    style={{ animationDelay: `${100 + idx * 60}ms` }}
                  >
                    {/* Top accent line */}
                    <div className={clsx(
                      'absolute top-0 left-3 right-3 h-1 rounded-full bg-gradient-to-r',
                      topAccent,
                    )} />
                    {/* Severity dot */}
                    <div className={clsx(
                      'mx-auto mb-2.5 h-2 w-2 rounded-full',
                      BUCKET_COLORS[k],
                      isOlder && 'bg-gradient-to-br from-blue-700 to-indigo-700',
                    )} />
                    <p className="text-xs font-semibold text-gray-800 uppercase tracking-wider">{BUCKET_LABELS[k] ?? aging?.labels?.[k] ?? k}</p>
                    <p className="text-base font-bold text-gray-900 mt-2">{cur} {fmt(val)}</p>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <span className={clsx(
                        'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full',
                        pct >= 30
                          ? 'bg-blue-100 text-blue-700'
                          : pct >= 15
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-gray-100 text-gray-600',
                      )}>
                        {pct}%
                      </span>
                      {/* Mini bar */}
                      <div className="flex-1 max-w-[40px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full', BUCKET_COLORS[k])}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer summary */}
          {agingTotal > 0 && (() => {
            const overduePct = bucketKeys.filter(k => k !== 'current').reduce((sum, k) => {
              return sum + Number(aging?.buckets?.[k] ?? 0);
            }, 0) / agingTotal * 100;
            return (
              <div className="px-6 py-3.5 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-700">{Math.round(overduePct)}%</span> of total is past due
                </span>
                <span className={clsx(
                  'inline-flex items-center gap-1 font-semibold',
                  overduePct > 50 ? 'text-blue-700' : overduePct > 20 ? 'text-indigo-600' : 'text-blue-500',
                )}>
                  <span className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    overduePct > 50 ? 'bg-blue-700' : overduePct > 20 ? 'bg-indigo-500' : 'bg-blue-400',
                  )} />
                  {overduePct > 50 ? 'High risk' : overduePct > 20 ? 'Moderate risk' : 'Low risk'}
                </span>
              </div>
            );
          })()}
        </div>
      </AnimatedSection>

      {/* ── By Customer ── */}
      <AnimatedSection delay={120}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Outstanding by Customer</h2>
          </div>
          {!byCust ? (
            <div className="py-14 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500" />
            </div>
          ) : byCust.customers.length === 0 ? (
            <div className="py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Wallet className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900">All caught up</p>
              <p className="text-xs text-gray-500 mt-1">No outstanding receivables</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {byCust.customers.map((c) => (
                  <div key={c.customer_id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      {c.logo
                        ? <img src={absUrl(c.logo)} alt={c.customer_name} className="h-9 w-9 rounded-lg object-cover border border-gray-200 shadow-sm shrink-0" />
                        : <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-500 font-bold text-xs shrink-0 border border-blue-100/50">
                            {c.customer_name.slice(0, 2).toUpperCase()}
                          </div>}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">{c.customer_name}</p>
                        <p className="text-xs text-gray-500">{c.invoice_count} invoice{c.invoice_count !== 1 ? 's' : ''}</p>
                      </div>
                      {Number(c.overdue) > 0 ? (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200/60 px-2 py-1 rounded-lg shrink-0">
                          {cur} {fmt(c.overdue)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 shrink-0">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Outstanding</p>
                        <p className="text-sm font-bold text-gray-900">{cur} {fmt(c.outstanding)}</p>
                      </div>
                      <Link
                        href={`/receivables/${c.customer_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-100/50 hover:border-blue-200/60 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Statement <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-950 to-indigo-950">
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Customer</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Invoices</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Overdue</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Outstanding</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {byCust.customers.map((c, idx) => (
                      <tr
                        key={c.customer_id}
                        className={clsx(
                          'transition-all duration-200',
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                          'hover:bg-blue-50/30 hover:shadow-inner',
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            {c.logo
                              ? <img src={absUrl(c.logo)} alt={c.customer_name} className="h-8 w-8 rounded-lg object-cover border border-gray-200 shadow-sm shrink-0" />
                              : <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-500 font-bold text-xs shrink-0 border border-blue-100/50">
                                  {c.customer_name.slice(0, 2).toUpperCase()}
                                </div>}
                            <span className="font-semibold text-gray-900">{c.customer_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-gray-500">{c.invoice_count}</td>
                        <td className="px-5 py-4 text-right">
                          {Number(c.overdue) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200/60 px-2.5 py-1 rounded-lg">
                              <AlertTriangle className="h-3 w-3" />
                              {cur} {fmt(c.overdue)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-gray-900 tabular-nums">
                          {cur} {fmt(c.outstanding)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/receivables/${c.customer_id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-100/50 hover:border-blue-200/60 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Statement <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </AnimatedSection>
    </div>
  );
}
