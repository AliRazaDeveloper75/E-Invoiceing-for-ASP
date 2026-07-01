'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/context/AuthContext';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import type { DashboardStats, InvoiceListItem, InvoiceStatus } from '@/types';
import {
  FileText, Wallet, Percent, ShieldCheck,
  PlusCircle, ArrowUpRight,
  Receipt, Clock, CheckCircle2, XCircle, Ban, Building2,
  PieChart, ArrowRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';

const statFetcher = (url: string) =>
  api.get<{ success: boolean; data: DashboardStats }>(url).then((r) => r.data.data);

const invoiceFetcher = (url: string) =>
  api.get<{ success: boolean; results: InvoiceListItem[] }>(url).then((r) => r.data.results ?? []);

const STATUS_ORDER: InvoiceStatus[] = [
  'draft', 'pending', 'submitted', 'validated', 'rejected', 'cancelled', 'paid'
];

const STATUS_META: Record<InvoiceStatus, { color: string; light: string; icon: React.ElementType }> = {
  draft:          { color: '#6b7280', light: 'bg-gray-100',  icon: Clock },
  pending:        { color: '#d97706', light: 'bg-amber-100', icon: Clock },
  submitted:      { color: '#6366f1', light: 'bg-indigo-100', icon: ArrowUpRight },
  validated:      { color: '#059669', light: 'bg-emerald-100',icon: CheckCircle2 },
  rejected:       { color: '#dc2626', light: 'bg-red-100',   icon: XCircle },
  cancelled:      { color: '#6b7280', light: 'bg-gray-200',  icon: Ban },
  paid:           { color: '#10b981', light: 'bg-emerald-100',icon: Receipt },
  partially_paid: { color: '#ea580c', light: 'bg-orange-100', icon: Receipt },
  deactivated:    { color: '#92400e', light: 'bg-amber-100', icon: XCircle },
};

const CARD_CONFIG = [
  {
    label: 'Total Invoices',
    icon: FileText,
    color: 'text-blue-600',
    dot: 'bg-blue-500',
    from: 'from-blue-700',
    to: 'to-blue-800',
    light: 'bg-blue-50',
    ring: 'ring-blue-700/20',
  },
  {
    label: 'Total Revenue',
    icon: Wallet,
    color: 'text-emerald-600',
    dot: 'bg-emerald-500',
    from: 'from-blue-700',
    to: 'to-blue-800',
    light: 'bg-blue-50',
    ring: 'ring-blue-700/20',
  },
  {
    label: 'VAT Collected',
    icon: Percent,
    color: 'text-amber-600',
    dot: 'bg-amber-500',
    from: 'from-blue-700',
    to: 'to-blue-800',
    light: 'bg-blue-50',
    ring: 'ring-blue-700/20',
  },
  {
    label: 'Validated by ASP',
    icon: ShieldCheck,
    color: 'text-violet-600',
    dot: 'bg-violet-500',
    from: 'from-blue-700',
    to: 'to-blue-800',
    light: 'bg-blue-50',
    ring: 'ring-blue-700/20',
  },
];

function DonutChart({ breakdown }: { breakdown: Partial<Record<InvoiceStatus, number>> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const entries = STATUS_ORDER.filter((s) => (breakdown[s] ?? 0) > 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 10;
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="150" height="150" viewBox="0 0 150 150" className="shrink-0">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          {entries.map((status) => {
            const pct = (breakdown[status] ?? 0) / total;
            const length = pct * circumference;
            const seg = (
              <circle
                key={status}
                cx="75" cy="75" r={radius}
                fill="none"
                stroke={STATUS_META[status].color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 75 75)"
                className="transition-all duration-1000 ease-out"
              />
            );
            offset += length;
            return seg;
          })}
          <circle cx="75" cy="75" r="27" fill="white" />
          <text x="75" y="68" textAnchor="middle" className="fill-gray-900 font-bold" fontSize="20">
            {total}
          </text>
          <text x="75" y="84" textAnchor="middle" className="fill-gray-400" fontSize="9.5">
            total
          </text>
        </svg>
      </div>
      <div className="mt-5 w-full space-y-2">
        {entries.map((status) => {
          const count = breakdown[status] ?? 0;
          const pct = ((count / total) * 100).toFixed(0);
          return (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[status].color }} />
                <span className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900 tabular-nums">{count}</span>
                <span className="text-[11px] text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBar({ breakdown }: { breakdown: Partial<Record<InvoiceStatus, number>> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const entries = STATUS_ORDER.filter((s) => (breakdown[s] ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100/80">
        {entries.map((status) => {
          const pct = ((breakdown[status] ?? 0) / total) * 100;
          return (
            <div
              key={status}
              style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: STATUS_META[status].color }}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-1000 ease-out"
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {entries.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[status].color }} />
            <span className="text-[10px] text-gray-400 capitalize font-medium">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeId, activeCompany } = useCompany();
  const { user } = useAuth();
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
      <AnimatedSection>
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-5 ring-1 ring-blue-500/10">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">No company selected</h2>
          <p className="mt-1.5 text-sm text-gray-500">Create or join a company to start managing your invoices.</p>
          <a
            href="/companies?new=1"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <PlusCircle className="h-4 w-4" /> Create Company
          </a>
        </div>
      </AnimatedSection>
    );
  }

  const validatedCount = stats?.status_breakdown?.validated ?? 0;

  return (
    <div className="relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-blue-500/[0.03] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-violet-500/[0.03] blur-3xl" />
      </div>

      <div className="relative space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <AnimatedSection>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-blue-950 to-indigo-950 shadow-2xl shadow-blue-900/20 p-6 sm:p-8">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.08)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-dot opacity-[0.04]" />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <span className="text-[10px] font-semibold text-blue-200/80 uppercase tracking-[0.15em]">Dashboard</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Welcome back, {user?.first_name ?? 'User'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-md bg-white/10 flex items-center justify-center">
                        <Building2 className="h-3 w-3 text-blue-200" />
                      </div>
                      <span className="text-sm text-blue-200/90">{activeCompany?.name}</span>
                    </div>
                    {activeCompany?.trn && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-blue-400/30" />
                        <span className="text-xs font-mono text-blue-300/70">TRN: {activeCompany.trn}</span>
                      </>
                    )}
                  </div>
                </div>
                <a
                  href="/invoices/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-800 hover:bg-blue-50 px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/10 hover:shadow-xl transition-all shrink-0 self-start sm:self-auto group/btn"
                >
                  <PlusCircle className="h-4 w-4 group-hover/btn:rotate-90 transition-transform duration-300" /> New Invoice
                </a>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ── Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CARD_CONFIG.map((cfg, i) => {
            const getVal = () => {
              if (i === 0) return stats?.total_invoices ?? '\u2014';
              if (i === 1) return stats ? `AED ${Number(stats.total_revenue).toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : '\u2014';
              if (i === 2) return stats ? `AED ${Number(stats.total_vat).toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : '\u2014';
              return validatedCount || '\u2014';
            };
            const getSub = () => {
              if (i === 1) return { text: 'Validated & paid', up: true };
              return undefined;
            };
            const sub = getSub();
            return (
              <div
                key={cfg.label}
                className="relative group bg-gradient-to-b from-blue-50 to-white rounded-xl border border-blue-200/80 p-5 shadow-[0_2px_8px_-2px_rgba(59,130,246,0.12),0_4px_12px_-2px_rgba(59,130,246,0.06)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.2),0_4px_12px_-2px_rgba(59,130,246,0.1)] hover:-translate-y-1.5 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={clsx('absolute top-0 left-5 right-5 h-0.5 rounded-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300', cfg.from, cfg.to)} />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{cfg.label}</p>
                    <p className={clsx('text-2xl sm:text-3xl font-bold tracking-tight mt-1.5 truncate', cfg.color)}>
                      {getVal()}
                    </p>
                    {sub && (
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <div className={clsx('flex items-center gap-0.5 text-[11px] font-semibold', sub.up ? 'text-emerald-600' : 'text-red-500')}>
                          {sub.up ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {sub.text}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={clsx(
                    'h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300',
                    cfg.from,
                    cfg.to,
                  )}>
                    <cfg.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Status Overview ──────────────────────────────────────── */}
        {stats && (
          <AnimatedSection delay={250}>
            <div className="bg-white rounded-xl border border-blue-200/80 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3.5 mb-6">
                <div className={clsx(
                  'h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/10',
                  'ring-1 ring-blue-500/10',
                )}>
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Status Overview</h2>
                  <p className="text-xs text-gray-400">Invoice volume breakdown by status</p>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                <div className="lg:w-64 xl:w-72">
                  <DonutChart breakdown={stats.status_breakdown} />
                </div>
                <div className="flex-1 space-y-5">
                  <StatusBar breakdown={stats.status_breakdown} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {STATUS_ORDER.filter((s) => (stats.status_breakdown[s] ?? 0) > 0).map((status, idx) => {
                      const count = stats.status_breakdown[status] ?? 0;
                      const t = Object.values(stats.status_breakdown).reduce((a, b) => a + b, 0);
                      const pct = ((count / t) * 100).toFixed(0);
                      const meta = STATUS_META[status];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={status}
                          className="group relative bg-white rounded-xl border border-blue-200/80 p-3.5 transition-all duration-200 hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 animate-slide-up"
                          style={{ animationDelay: `${350 + idx * 70}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={clsx('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110', meta.light)}>
                              <Icon className="h-4 w-4" style={{ color: meta.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-gray-700 capitalize truncate">{status.replace('_', ' ')}</p>
                                <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{count}</span>
                              </div>
                              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${pct}%`, backgroundColor: meta.color }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{pct}% of total</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* ── Recent Invoices ──────────────────────────────────────── */}
        <div
          className="bg-white rounded-xl border border-blue-200/80 shadow-sm overflow-hidden"
        >
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/10">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Recent Invoices</h2>
                <p className="text-xs text-gray-400">Latest 5 invoices</p>
              </div>
            </div>
            <a
              href="/invoices"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors group/link"
            >
              View all <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform duration-200" />
            </a>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-4 ring-1 ring-gray-100">
                <FileText className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No invoices yet</p>
              <p className="mt-1 text-xs text-gray-400">Create your first invoice to get started.</p>
              <a
                href="/invoices/new"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors group/link"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Create your first invoice
              </a>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-gray-50">
                {recentInvoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    className="px-5 py-4 transition-all duration-500 ease-out opacity-100 translate-y-0"
                    style={{ transitionDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <a
                        href={`/invoices/${inv.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-700 text-sm transition-colors"
                      >
                        {inv.invoice_number}
                      </a>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Customer</span>
                        <span className="text-gray-700 font-medium">{inv.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Date</span>
                        <span className="text-gray-600">{inv.issue_date}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-gray-50">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-gray-900 font-bold">
                          {Number(inv.total_amount).toLocaleString('en-AE', { style: 'currency', currency: inv.currency })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        className="group transition-all duration-300 hover:bg-blue-50/30 opacity-100"
                        style={{ transitionDelay: `${idx * 60}ms` }}
                      >
                        <td className="px-6 py-4 border-b border-gray-50/80">
                          <a
                            href={`/invoices/${inv.id}`}
                            className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {inv.invoice_number}
                          </a>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-50/80 text-gray-600 group-hover:text-gray-900 transition-colors duration-200">{inv.customer_name}</td>
                        <td className="px-6 py-4 border-b border-gray-50/80 text-gray-400">{inv.issue_date}</td>
                        <td className="px-6 py-4 border-b border-gray-50/80 text-right font-bold text-gray-900 tabular-nums">
                          {Number(inv.total_amount).toLocaleString('en-AE', { style: 'currency', currency: inv.currency })}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-50/80">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: STATUS_META[inv.status]?.color ?? '#6b7280' }}
                            />
                            <InvoiceStatusBadge status={inv.status} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
