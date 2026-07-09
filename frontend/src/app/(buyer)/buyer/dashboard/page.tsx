'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, ArrowRight, Calendar, DollarSign,
  Receipt, Activity, ArrowUpRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { BuyerDashboard, InvoiceListItem } from '@/types';

// ─── Skeleton Loader ─────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded-lg animate-shimmer ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-3">
        <SkeletonBlock className="h-8 w-52" />
        <SkeletonBlock className="h-5 w-80" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-8 w-24" />
                <SkeletonBlock className="h-3 w-28" />
              </div>
              <SkeletonBlock className="w-10 h-10" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <SkeletonBlock className="h-5 w-36" />
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <SkeletonBlock className="w-9 h-9" />
                <div className="space-y-2">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <SkeletonBlock className="h-5 w-16 rounded-full" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────

const statCardConfig = [
  {
    icon: FileText,
    label: 'Total Invoices',
    color: 'bg-blue-50 text-blue-600',
    gradient: 'bg-gradient-to-r from-blue-500 to-blue-400',
    borderHover: 'group-hover:border-blue-200',
  },
  {
    icon: TrendingUp,
    label: 'Total Amount',
    color: 'bg-indigo-50 text-indigo-600',
    gradient: 'bg-gradient-to-r from-indigo-500 to-indigo-400',
    borderHover: 'group-hover:border-indigo-200',
  },
  {
    icon: Clock,
    label: 'Unpaid',
    color: 'bg-amber-50 text-amber-600',
    gradient: 'bg-gradient-to-r from-amber-500 to-amber-400',
    borderHover: 'group-hover:border-amber-200',
  },
  {
    icon: CheckCircle2,
    label: 'Paid',
    color: 'bg-emerald-50 text-emerald-600',
    gradient: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    borderHover: 'group-hover:border-emerald-200',
  },
];

function StatCard({
  icon: Icon, label, value, sub, color, gradient, delay,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; gradient: string; delay: number;
}) {
  return (
    <div
      className="group bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 animate-fade-in hover:shadow-lg hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 group-hover:text-gray-900 transition-colors">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {sub}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={`mt-4 h-1 rounded-full ${gradient} opacity-0 group-hover:opacity-100 transition-all duration-500 scale-x-0 group-hover:scale-x-100 origin-left`} />
    </div>
  );
}

// ─── Status Helpers ──────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft:          'bg-gray-100 text-gray-600',
    pending:        'bg-yellow-100 text-yellow-700',
    submitted:      'bg-blue-100 text-blue-700',
    validated:      'bg-emerald-100 text-emerald-700',
    rejected:       'bg-red-100 text-red-700',
    cancelled:      'bg-gray-100 text-gray-500',
    paid:           'bg-green-100 text-green-700',
    partially_paid: 'bg-orange-100 text-orange-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function statusDot(status: string) {
  const map: Record<string, string> = {
    draft:          'bg-gray-400',
    pending:        'bg-yellow-500',
    submitted:      'bg-blue-500',
    validated:      'bg-emerald-500',
    rejected:       'bg-red-500',
    cancelled:      'bg-gray-400',
    paid:           'bg-green-500',
    partially_paid: 'bg-orange-500',
  };
  return map[status] ?? 'bg-gray-400';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft:          'Draft',
    pending:        'Pending',
    submitted:      'Submitted',
    validated:      'Validated',
    rejected:       'Rejected',
    cancelled:      'Cancelled',
    paid:           'Paid',
    partially_paid: 'Partial',
  };
  return map[status] ?? status;
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function BuyerDashboardPage() {
  const [data, setData] = useState<BuyerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ success: boolean; data: BuyerDashboard }>('/buyer/dashboard/')
      .then(r => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-gray-500 font-medium">{error || 'No data available.'}</p>
        </div>
      </div>
    );
  }

  const stats = [
    { ...statCardConfig[0], value: data.total_invoices },
    {
      ...statCardConfig[1],
      value: `AED ${parseFloat(data.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`,
    },
    {
      ...statCardConfig[2],
      value: data.unpaid_count,
      sub: `AED ${parseFloat(data.unpaid_amount || '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`,
    },
    {
      ...statCardConfig[3],
      value: data.paid_count,
      sub: `AED ${parseFloat(data.paid_amount || '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-soft" />
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back
        </h1>
        <p className="text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
          <span>Viewing invoices for</span>
          <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md text-sm">
            {data.customer_name}
          </span>
          <span>from</span>
          <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md text-sm">
            {data.company_name}
          </span>
        </p>
        <div className="mt-4 h-px bg-gradient-to-r from-blue-200 via-gray-200 to-transparent" />
      </div>

      {/* ── Overdue Alert ─────────────────────────────────────────────── */}
      {data.overdue_count > 0 && (
        <div className="group flex items-center gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200 rounded-xl px-5 py-4 animate-slide-up">
          <div className="relative">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="absolute inset-0 w-5 h-5 rounded-full bg-red-400/20 animate-ping" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {data.overdue_count} overdue invoice{data.overdue_count > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Past due date — please arrange payment.</p>
          </div>
          <Link
            href="/buyer/invoices?status=validated"
            className="text-sm font-medium text-red-700 hover:text-red-800 flex items-center gap-1.5 bg-red-100/50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Stats Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 100} />
        ))}
      </div>

      {/* ── Recent Invoices ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm animate-fade-in" style={{ animationDelay: '400ms' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Recent Invoices</h2>
          </div>
          <Link
            href="/buyer/invoices"
            className="group text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {data.recent_invoices.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-400 font-medium">No invoices yet</p>
            <p className="text-xs text-gray-300 mt-1">Invoices will appear here once received.</p>
          </div>
        ) : (
              <div className="divide-y divide-gray-100">
            {data.recent_invoices.map((inv: InvoiceListItem, idx: number) => (
              <Link
                key={inv.id}
                href={`/buyer/invoices/${inv.id}`}
                className="group flex items-center justify-between px-5 py-4 transition-all duration-200 hover:bg-gray-50 relative overflow-hidden animate-slide-up"
                style={{ animationDelay: `${500 + idx * 80}ms` }}
              >
                {/* Left accent on hover */}
                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top" />

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 flex items-center justify-center group-hover:border-blue-200 group-hover:shadow-sm transition-all duration-200">
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors duration-200">
                      {inv.invoice_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(inv.issue_date).toLocaleDateString('en-AE', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200 ${statusBadge(inv.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(inv.status)}`} />
                    {statusLabel(inv.status)}
                  </span>
                  <p className="text-sm font-bold text-gray-800 tabular-nums">
                    {inv.currency} {parseFloat(inv.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors duration-200">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors duration-200" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
