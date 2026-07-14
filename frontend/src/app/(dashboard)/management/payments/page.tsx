'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  CreditCard, Search, RefreshCw, Trash2, FileText,
  CheckCircle2, AlertTriangle, ArrowLeft, DollarSign,
  Receipt, X, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

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

// ─── Pagination helper ─────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

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
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Void Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5">This cannot be undone</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-blue-50/20 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Invoice</span>
            <span className="font-semibold text-gray-800">{payment.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-red-600">AED {parseFloat(payment.amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Method</span>
            <span className="text-gray-700">{payment.method_display}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-700">{payment.payment_date}</span>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Voiding this payment will recalculate the invoice status. If no other payments remain, the invoice will revert to <strong>Validated</strong>.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? 'Voiding\u2026' : 'Void Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, gradient,
}: {
  icon: React.ElementType; label: string; value: string | number; gradient: string;
}) {
  return (
    <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
      <div className={`p-2 sm:p-2.5 rounded-xl ${gradient}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{value}</p>
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
          ${toast.type === 'success'
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/10'
            : 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-red-500/10'}`}>
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
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/management" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Link>
            <div className="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full hidden sm:block" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Payment Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">View and manage all buyer payments across the platform</p>
            </div>
          </div>
          <button
            onClick={() => mutate()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={Receipt}
          label="Total Payments"
          value={summary?.total_count ?? 0}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20"
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Collected"
          value={`AED ${parseFloat(summary?.total_amount ?? '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Showing on Page"
          value={payments.length}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20"
        />
        <SummaryCard
          icon={CreditCard}
          label="Filtered Results"
          value={pagination?.count ?? 0}
          gradient="bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/20"
        />
      </div>

      {/* Filters */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoice, company, customer, reference…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <CustomSelect
              value={method}
              onChange={(val) => { setMethod(val); setPage(1); }}
              options={METHOD_OPTIONS}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                title="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                title="To date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading payments\u2026
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <div className="p-4 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 inline-flex mb-3">
              <Receipt className="h-10 w-10 text-blue-300" />
            </div>
            <p className="font-medium">No payments found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-gray-100">
              {payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/management/invoices/${p.invoice_id}`}
                        className="font-semibold text-blue-600 hover:underline text-sm">
                        {p.invoice_number}
                      </Link>
                      {p.reference && (
                        <p className="text-[10px] text-gray-400 font-mono">{p.reference}</p>
                      )}
                    </div>
                    <span className="font-bold text-gray-900 text-sm shrink-0">
                      AED {parseFloat(p.amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${METHOD_COLORS[p.method] ?? 'bg-gray-100 text-gray-700'}`}>
                      {p.method_display}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${INV_STATUS_COLORS[p.invoice_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.invoice_status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{p.company_name} — {p.customer_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{p.payment_date}</span>
                    <button onClick={() => setVoidTarget(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-gray-200">
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
              {payments.map((p, idx) => (
                <tr key={p.id} className={`${idx % 2 === 0 ? 'bg-blue-50/10' : ''} hover:bg-blue-50/30 transition-colors`}>
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
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-xl ${METHOD_COLORS[p.method] ?? 'bg-gray-100 text-gray-700'}`}>
                      {p.method_display}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm whitespace-nowrap">{p.payment_date}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{p.recorded_by}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-xl capitalize ${INV_STATUS_COLORS[p.invoice_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.invoice_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setVoidTarget(p)}
                      title="Void payment"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">Page {page} of {totalPages} ({pagination?.count} total)</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-2 text-gray-400">\u2026</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all ${
                      p === page
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20'
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}>
                    {p}
                  </button>
                )
              )}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
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
