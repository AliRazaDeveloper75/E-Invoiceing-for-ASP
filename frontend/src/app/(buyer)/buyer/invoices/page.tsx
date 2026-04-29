'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, Search, Filter, ArrowRight, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { InvoiceListItem, APIPaginated, InvoiceStatus } from '@/types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Invoices' },
  { value: 'validated', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadge(status: InvoiceStatus) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    validated: 'bg-sky-100 text-sky-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    paid: 'bg-emerald-100 text-emerald-700',
    partially_paid: 'bg-orange-100 text-orange-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

function statusLabel(status: InvoiceStatus) {
  const map: Record<string, string> = {
    draft: 'Draft', pending: 'Pending', submitted: 'Submitted',
    validated: 'Unpaid', rejected: 'Rejected', cancelled: 'Cancelled',
    paid: 'Paid', partially_paid: 'Partially Paid',
  };
  return map[status] ?? status;
}

export default function BuyerInvoiceListPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState({ count: 0, total_pages: 1, current_page: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get<APIPaginated<InvoiceListItem>>(`/buyer/invoices/?${params}`);
      setInvoices(r.data.results);
      setPagination({
        count: r.data.pagination.count,
        total_pages: r.data.pagination.total_pages,
        current_page: r.data.pagination.current_page,
      });
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  function handleStatusChange(val: string) {
    setStatusFilter(val);
    setPage(1);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Invoices</h1>
          <p className="text-slate-500 mt-1">{pagination.count} invoice{pagination.count !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No invoices found</p>
            <p className="text-sm mt-1">Try changing the filter above</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Invoice</span>
              <span>Date</span>
              <span>Due</span>
              <span>Amount</span>
              <span>Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <Link
                  key={inv.id}
                  href={`/buyer/invoices/${inv.id}`}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-400">{inv.type_display}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600">
                    {new Date(inv.issue_date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>

                  <p className="text-sm text-slate-600">
                    {inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </p>

                  <p className="text-sm font-bold text-slate-800">
                    {inv.currency} {parseFloat(inv.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                  </p>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusBadge(inv.status)}`}>
                      {statusLabel(inv.status)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            Page {pagination.current_page} of {pagination.total_pages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pagination.total_pages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
