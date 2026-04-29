'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, ArrowRight, Calendar, DollarSign,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { BuyerDashboard, InvoiceListItem } from '@/types';

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft:          'bg-slate-100 text-slate-600',
    pending:        'bg-yellow-100 text-yellow-700',
    submitted:      'bg-blue-100 text-blue-700',
    validated:      'bg-emerald-100 text-emerald-700',
    rejected:       'bg-red-100 text-red-700',
    cancelled:      'bg-slate-100 text-slate-500',
    paid:           'bg-green-100 text-green-700',
    partially_paid: 'bg-orange-100 text-orange-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-slate-500">{error || 'No data available.'}</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
        <p className="text-slate-500 mt-1">
          Viewing invoices for <span className="font-semibold text-slate-700">{data.customer_name}</span>
          {' '}from <span className="font-semibold text-slate-700">{data.company_name}</span>
        </p>
      </div>

      {/* Overdue alert */}
      {data.overdue_count > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {data.overdue_count} overdue invoice{data.overdue_count > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Past due date — please arrange payment.</p>
          </div>
          <Link
            href="/buyer/invoices?status=validated"
            className="text-sm font-medium text-red-700 hover:text-red-800 flex items-center gap-1"
          >
            View <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Total Invoices"
          value={data.total_invoices}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={DollarSign}
          label="Total Amount"
          value={`AED ${parseFloat(data.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
          color="bg-slate-100 text-slate-600"
        />
        <StatCard
          icon={Clock}
          label="Unpaid"
          value={data.unpaid_count}
          sub={`AED ${parseFloat(data.unpaid_amount || '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Paid"
          value={data.paid_count}
          sub={`AED ${parseFloat(data.paid_amount || '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Invoices</h2>
          <Link
            href="/buyer/invoices"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {data.recent_invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No invoices yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recent_invoices.map((inv: InvoiceListItem) => (
              <Link
                key={inv.id}
                href={`/buyer/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{inv.invoice_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(inv.issue_date).toLocaleDateString('en-AE')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(inv.status)}`}>
                    {statusLabel(inv.status)}
                  </span>
                  <p className="text-sm font-bold text-slate-800">
                    {inv.currency} {parseFloat(inv.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                  </p>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
