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
  BarChart3, ShieldAlert, ShieldCheck, AlertCircle,
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
const BUCKET_ACCENT: Record<string, string> = {
  current: 'from-blue-300 to-blue-400',
  d1_15: 'from-blue-400 to-blue-500',
  d16_30: 'from-blue-500 to-blue-600',
  d31_45: 'from-amber-400 to-amber-500',
  d46_60: 'from-orange-400 to-orange-500',
  d60_plus: 'from-red-400 to-red-500',
};
const BUCKET_3D_BG: Record<string, string> = {
  current: 'from-blue-50 via-blue-50/60 to-blue-100/50',
  d1_15: 'from-blue-50 via-blue-100/40 to-blue-100/60',
  d16_30: 'from-blue-100/60 via-blue-100/40 to-blue-200/30',
  d31_45: 'from-amber-50 via-amber-100/40 to-amber-100/50',
  d46_60: 'from-orange-50 via-orange-100/40 to-orange-100/50',
  d60_plus: 'from-red-50 via-red-100/40 to-red-100/50',
};
const BUCKET_3D_SHADOW: Record<string, string> = {
  current: 'shadow-blue-200/40',
  d1_15: 'shadow-blue-200/50',
  d16_30: 'shadow-blue-300/50',
  d31_45: 'shadow-amber-200/50',
  d46_60: 'shadow-orange-200/50',
  d60_plus: 'shadow-red-200/50',
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
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none" />
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
        <div className="rounded-2xl overflow-hidden shadow-xl shadow-gray-200/50 border border-gray-200">
          {/* ── Dark header ── */}
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.18),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.12),transparent_50%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <BarChart3 className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-blue-100">Aging Analysis</h2>
                  <p className="text-xs text-blue-300/60">Outstanding balance by age bracket</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {agingTotal > 0 && (() => {
                  const overduePct = bucketKeys.filter(k => k !== 'current').reduce((sum, k) => {
                    return sum + Number(aging?.buckets?.[k] ?? 0);
                  }, 0) / agingTotal * 100;
                  return (
                    <div className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                      overduePct > 50
                        ? 'bg-red-500/15 text-red-300 border-red-400/20'
                        : overduePct > 20
                          ? 'bg-amber-500/15 text-amber-300 border-amber-400/20'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
                    )}>
                      {overduePct > 50 ? (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      ) : overduePct > 20 ? (
                        <AlertCircle className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      {overduePct > 50 ? 'High Risk' : overduePct > 20 ? 'Moderate' : 'Healthy'}
                    </div>
                  );
                })()}
                <div className="text-right">
                  <p className="text-[11px] text-blue-300/50 uppercase tracking-wider font-medium">Total Outstanding</p>
                  <p className="text-xl font-bold text-white tracking-tight">{cur} {fmt(aging?.total ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="bg-white px-6 py-6 space-y-6">
            {/* Stacked bar */}
            {agingTotal > 0 && (
              <div className="space-y-2.5">
                <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 ring-1 ring-inset ring-black/5 shadow-inner">
                  {bucketKeys.map((k) => {
                    const val = Number(aging?.buckets?.[k] ?? 0);
                    const pct = (val / agingTotal) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <div
                        key={k}
                        className={clsx(
                          'relative transition-all duration-1000 ease-out group/bar cursor-default',
                          'first:rounded-l-full last:rounded-r-full',
                          BUCKET_COLORS[k],
                          'hover:brightness-110 hover:z-10',
                        )}
                        style={{ width: `${pct}%` }}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 bg-white/30" />
                        <div className="absolute -top-11 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 pointer-events-none z-20">
                          <div className="bg-gray-900 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-xl border border-white/10 whitespace-nowrap">
                            {BUCKET_LABELS[k]}: {cur} {fmt(val)} ({Math.round(pct)}%)
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between px-1">
                  <span className="text-[10px] text-gray-400 font-medium">Current</span>
                  <span className="text-[10px] text-gray-400 font-medium">60+ days</span>
                </div>
              </div>
            )}

            {/* Bucket cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {bucketKeys.map((k, idx) => {
                const val = Number(aging?.buckets?.[k] ?? 0);
                const pct = agingTotal > 0 ? Math.round((val / agingTotal) * 100) : 0;
                const isOlder = k === 'd60_plus' || k === 'd46_60' || k === 'd31_45';
                const isCritical = k === 'd60_plus' && pct > 10;
                return (
                  <div
                    key={k}
                    className={clsx(
                      'group relative rounded-2xl px-4 pt-5 pb-4 text-center cursor-default',
                      'bg-gradient-to-b border border-gray-200/70',
                      'transition-all duration-300 ease-out',
                      'hover:-translate-y-1 hover:scale-[1.02]',
                      BUCKET_3D_BG[k],
                      BUCKET_3D_SHADOW[k],
                      isOlder
                        ? 'shadow-[0_4px_14px_-2px_rgba(0,0,0,0.1),0_2px_6px_-2px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.8)] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.15),0_4px_10px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)]'
                        : 'shadow-[0_2px_10px_-2px_rgba(0,0,0,0.07),0_1px_4px_-1px_rgba(0,0,0,0.04),inset_0_1px_0_0_rgba(255,255,255,0.8)] hover:shadow-[0_10px_24px_-4px_rgba(0,0,0,0.12),0_3px_8px_-2px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.9)]',
                      isCritical && 'ring-1 ring-red-200/60',
                    )}
                    style={{ animationDelay: `${100 + idx * 60}ms` }}
                  >
                    {/* 3D top highlight edge */}
                    <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
                    {/* Top accent bar */}
                    <div className={clsx(
                      'absolute top-0 left-5 right-5 h-[3px] rounded-full bg-gradient-to-r',
                      BUCKET_ACCENT[k],
                      'shadow-sm',
                    )} />
                    {/* Bottom inner shadow for depth */}
                    <div className="absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-black/[0.03] to-transparent pointer-events-none" />

                    <div className="flex items-center justify-center gap-1.5 mb-2.5">
                      <div className={clsx(
                        'h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm',
                        BUCKET_COLORS[k],
                        isCritical && 'animate-pulse',
                      )} />
                      {isCritical && (
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400/40 animate-ping absolute" />
                      )}
                    </div>

                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {BUCKET_LABELS[k] ?? aging?.labels?.[k] ?? k}
                    </p>
                    <p className="text-base font-bold text-gray-900 mt-1.5 tracking-tight">
                      {cur} {fmt(val)}
                    </p>

                    <div className="flex items-center justify-center gap-2 mt-2.5">
                      <span className={clsx(
                        'text-[10px] font-bold px-2.5 py-0.5 rounded-full',
                        pct >= 30
                          ? 'bg-red-100/80 text-red-600 ring-1 ring-red-200/50'
                          : pct >= 15
                            ? 'bg-amber-100/80 text-amber-600 ring-1 ring-amber-200/50'
                            : 'bg-emerald-100/80 text-emerald-600 ring-1 ring-emerald-200/50',
                      )}>
                        {pct}%
                      </span>
                      <div className="w-8 h-1.5 rounded-full bg-gray-200/60 overflow-hidden shadow-inner">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-1000 ease-out', BUCKET_COLORS[k])}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Footer ── */}
          {agingTotal > 0 && (() => {
            const overduePct = bucketKeys.filter(k => k !== 'current').reduce((sum, k) => {
              return sum + Number(aging?.buckets?.[k] ?? 0);
            }, 0) / agingTotal * 100;
            const overdueAmt = bucketKeys.filter(k => k !== 'current').reduce((sum, k) => {
              return sum + Number(aging?.buckets?.[k] ?? 0);
            }, 0);
            return (
              <div className="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    overduePct > 50
                      ? 'bg-red-50'
                      : overduePct > 20
                        ? 'bg-amber-50'
                        : 'bg-emerald-50',
                  )}>
                    {overduePct > 50 ? (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    ) : overduePct > 20 ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{Math.round(overduePct)}%</span> of total is past due
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{cur} {fmt(overdueAmt)} overdue</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Healthy &lt;20%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>Moderate 20–50%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span>High &gt;50%</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </AnimatedSection>

      {/* ── By Customer ── */}
      <AnimatedSection delay={120}>
        <div className="rounded-2xl overflow-hidden shadow-lg shadow-gray-200/50 border border-gray-200">
          {/* ── Header ── */}
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.18),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.12),transparent_50%)] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Users className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-blue-100">Outstanding by Customer</h2>
                <p className="text-xs text-blue-300/50">
                  {byCust ? `${byCust.customers.length} customer${byCust.customers.length !== 1 ? 's' : ''}` : 'Loading...'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="bg-white">
            {!byCust ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  </div>
                  <p className="text-sm text-gray-400">Loading customers...</p>
                </div>
              </div>
            ) : byCust.customers.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center shadow-sm">
                    <Wallet className="h-7 w-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">All caught up</p>
                    <p className="text-xs text-gray-500 mt-0.5">No outstanding receivables</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {byCust.customers.map((c) => {
                  const hasOverdue = Number(c.overdue) > 0;
                  return (
                    <Link
                      key={c.customer_id}
                      href={`/receivables/${c.customer_id}`}
                      className="group flex items-center gap-5 px-6 py-4 hover:bg-blue-50/30 transition-colors duration-200"
                    >
                      {/* Avatar */}
                      {c.logo
                        ? <img src={absUrl(c.logo)} alt={c.customer_name} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-gray-100 shrink-0" />
                        : <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-md shadow-blue-500/20">
                            {c.customer_name.slice(0, 2).toUpperCase()}
                          </div>}

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">
                          {c.customer_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.invoice_count} invoice{c.invoice_count !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Amounts */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {cur} {fmt(c.outstanding)}
                        </p>
                        {hasOverdue ? (
                          <p className="text-[11px] font-semibold text-red-500 tabular-nums">
                            {cur} {fmt(c.overdue)} overdue
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400 tabular-nums">
                            No overdue
                          </p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors duration-200">
                        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
