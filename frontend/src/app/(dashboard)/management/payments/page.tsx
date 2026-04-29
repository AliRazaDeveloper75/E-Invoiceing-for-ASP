'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  CreditCard, Search, RefreshCw, Trash2, FileText,
  CheckCircle2, AlertTriangle, ArrowLeft, DollarSign,
  Receipt, X, AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminPayment {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_status: string;
  company_name: string;
  customer_name: string;
  amount: string;
  method: string;
  method_display: string;
  payment_date: string;
  reference: string;
  notes: string;
  recorded_by: string;
  created_at: string;
}

interface PaymentListResponse {
  results: AdminPayment[];
  summary: { total_count: number; total_amount: string };
  pagination: { count: number; next: string | null; previous: string | null };
}

const METHOD_OPTIONS = [
  { value: '',             label: 'All methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'card',          label: 'Card (Stripe)' },
  { value: 'online',        label: 'PayPal / Online' },
  { value: 'other',         label: 'Other' },
];

const METHOD_COLORS: Record<string, string> = {
  bank_transfer: 'bg-blue-100 text-blue-700',
  cash:          'bg-green-100 text-green-700',
  cheque:        'bg-slate-100 text-slate-700',
  card:          'bg-indigo-100 text-indigo-700',
  online:        'bg-cyan-100 text-cyan-700',
  other:         'bg-gray-100 text-gray-700',
};

const INV_STATUS_COLORS: Record<string, string> = {
  paid:           'bg-emerald-100 text-emerald-700',
  partially_paid: 'bg-orange-100 text-orange-700',
  validated:      'bg-green-100 text-green-700',
  submitted:      'bg-blue-100 text-blue-700',
  draft:          'bg-slate-100 text-slate-600',
};

// ─── Void confirmation dialog ─────────────────────────────────────────────────

function VoidDialog({
  payment,
  onConfirm,
  onCancel,
  loading,
}: {
  payment: AdminPayment;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Void Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">This cannot be undone</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice</span>
            <span className="font-semibold text-slate-800">{payment.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-bold text-red-600">AED {parseFloat(payment.amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Method</span>
            <span className="text-slate-700">{payment.method_display}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="text-slate-700">{payment.payment_date}</span>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Voiding this payment will recalculate the invoice status. If no other payments remain, the invoice will revert to <strong>Validated</strong>.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? 'Voiding…' : 'Void Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [search, setSearch]     = useState('');
  const [method, setMethod]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);

  const [voidTarget, setVoidTarget]   = useState<AdminPayment | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (search)   params.set('search', search);
  if (method)   params.set('method', method);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);

  const { data, isLoading, mutate } = useSWR<{ data: PaymentListResponse }>(
    `/admin/payments/?${params}`,
    (url: string) => api.get(url).then(r => r.data),
    { keepPreviousData: true },
  );

  const payments   = data?.data?.results ?? [];
  const summary    = data?.data?.summary;
  const pagination = data?.data?.pagination;
  const totalPages = Math.ceil((pagination?.count ?? 0) / 20);

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleVoid() {
    if (!voidTarget) return;
    setVoidLoading(true);
    try {
      await api.delete(`/admin/payments/${voidTarget.id}/`);
      showToast('success', `Payment voided — invoice ${voidTarget.invoice_number} updated.`);
      mutate();
    } catch {
      showToast('error', 'Failed to void payment. Please try again.');
    } finally {
      setVoidLoading(false);
      setVoidTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/management" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and manage all buyer payments across the platform</p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={Receipt}
          label="Total Payments"
          value={summary?.total_count ?? 0}
          color="bg-blue-100 text-blue-600"
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Collected"
          value={`AED ${parseFloat(summary?.total_amount ?? '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
          color="bg-emerald-100 text-emerald-600"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Showing on Page"
          value={payments.length}
          color="bg-indigo-100 text-indigo-600"
        />
        <SummaryCard
          icon={CreditCard}
          label="Filtered Results"
          value={pagination?.count ?? 0}
          color="bg-violet-100 text-violet-600"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoice, company, customer, reference…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={method}
            onChange={e => { setMethod(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading payments…
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payments found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company / Customer</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recorded By</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/management/invoices/${p.invoice_id}`}
                      className="font-semibold text-blue-600 hover:underline text-sm"
                    >
                      {p.invoice_number}
                    </Link>
                    {p.reference && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.reference}</p>
                    )}
                    {p.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{p.notes}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-800">{p.company_name}</p>
                    <p className="text-xs text-gray-500">{p.customer_name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-bold text-gray-900">
                      AED {parseFloat(p.amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${METHOD_COLORS[p.method] ?? 'bg-gray-100 text-gray-700'}`}>
                      {p.method_display}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm whitespace-nowrap">{p.payment_date}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{p.recorded_by}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${INV_STATUS_COLORS[p.invoice_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.invoice_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setVoidTarget(p)}
                      title="Void payment"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages} ({pagination?.count} total)</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void dialog */}
      {voidTarget && (
        <VoidDialog
          payment={voidTarget}
          onConfirm={handleVoid}
          onCancel={() => setVoidTarget(null)}
          loading={voidLoading}
        />
      )}
    </div>
  );
}
