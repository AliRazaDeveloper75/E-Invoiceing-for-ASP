'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, ArrowRight, ChevronLeft, ChevronRight, Inbox, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import type { InvoiceListItem, APIPaginated, InvoiceStatus } from '@/types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',                  label: 'All' },
  { value: 'awaiting_approval', label: 'Needs Approval' },
  { value: 'validated',         label: 'Unpaid' },
  { value: 'submitted',         label: 'Submitted' },
  { value: 'partially_paid',    label: 'Partial' },
  { value: 'paid',              label: 'Paid' },
  { value: 'rejected',          label: 'Rejected' },
];

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-gray-400',
  awaiting_approval: 'bg-amber-500',
  pending: 'bg-yellow-500',
  submitted: 'bg-blue-500',
  validated: 'bg-sky-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-gray-400',
  paid: 'bg-emerald-500',
  partially_paid: 'bg-orange-500',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_approval: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  pending: 'bg-yellow-50 text-yellow-700',
  submitted: 'bg-blue-50 text-blue-700',
  validated: 'bg-sky-50 text-sky-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  paid: 'bg-emerald-50 text-emerald-700',
  partially_paid: 'bg-orange-50 text-orange-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', submitted: 'Submitted',
  validated: 'Unpaid', rejected: 'Rejected', cancelled: 'Cancelled',
  paid: 'Paid', partially_paid: 'Partial', awaiting_approval: 'Needs Approval',
};

function StatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function BuyerInvoiceListPage() {
  const searchParams = useSearchParams();
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

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-soft" />
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Invoices</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Invoices</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          {pagination.count} invoice{pagination.count !== 1 ? 's' : ''}
          {statusFilter && <span className="text-gray-400"> &middot; filtered</span>}
        </p>
        <div className="mt-4 h-px bg-gradient-to-r from-blue-200 via-gray-200 to-transparent" />
      </div>

      {/* ── Filter pills ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Filter by status</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(opt => {
            const isActive = statusFilter === opt.value;
            const isApproval = opt.value === 'awaiting_approval';
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
                  isActive
                    ? isApproval
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Invoice list ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '200ms' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500">No invoices found</p>
            <p className="text-sm text-gray-400 mt-1">
              {statusFilter ? 'Try selecting a different filter' : 'Invoices from your suppliers will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoices.map((inv, idx) => {
              const needsApproval = inv.status === 'awaiting_approval';
              return (
                <Link
                  key={inv.id}
                  href={`/buyer/invoices/${inv.id}`}
                  className={`group block transition-all duration-150 relative ${
                    needsApproval
                      ? 'bg-amber-50/50 hover:bg-amber-50'
                      : 'hover:bg-gray-50'
                  }`}
                  style={{ animationDelay: `${300 + idx * 40}ms` }}
                >
                  {/* Left accent bar */}
                  <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-all duration-200 z-10 ${
                    needsApproval
                      ? 'bg-amber-400'
                      : 'bg-transparent group-hover:bg-blue-500 group-hover:scale-y-100 scale-y-0'
                  }`} />

                  {/* ── Desktop row (lg+) ── */}
                  <div className="hidden lg:grid grid-cols-7 items-center gap-2 px-5 py-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      needsApproval
                        ? 'bg-amber-100 border border-amber-200'
                        : 'bg-gray-50 border border-gray-200 group-hover:border-blue-200 group-hover:bg-blue-50'
                    }`}>
                      {needsApproval ? (
                        <ShieldCheck className="w-4.5 h-4.5 text-amber-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors duration-150 truncate">
                          {inv.invoice_number}
                        </p>
                        {needsApproval && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                            Action needed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{inv.type_display}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Issued</p>
                      <p className="text-xs text-gray-600 whitespace-nowrap">{formatDate(inv.issue_date)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Due</p>
                      <p className="text-xs text-gray-600 whitespace-nowrap">
                        {inv.due_date ? formatDate(inv.due_date) : '—'}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-gray-800 text-center whitespace-nowrap">
                      {inv.currency} {parseFloat(inv.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex justify-center">
                      <StatusPill status={inv.status} />
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </div>

                  {/* ── Mobile / Tablet card (default – <lg) ── */}
                  <div className="lg:hidden p-3.5">
                    <div className={`flex items-start gap-3 rounded-xl p-3.5 transition-all duration-200 ${
                      needsApproval
                        ? 'bg-amber-50 border border-amber-200/60'
                        : 'bg-gray-50/80 border border-gray-100'
                    }`}>
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                        needsApproval
                          ? 'bg-amber-100 border border-amber-200'
                          : 'bg-white border border-gray-200 group-hover:border-blue-200 group-hover:bg-blue-50 shadow-sm'
                      }`}>
                        {needsApproval ? (
                          <ShieldCheck className="w-5 h-5 text-amber-600" />
                        ) : (
                          <FileText className="w-4.5 h-4.5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Top row: invoice number + arrow */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors duration-150 truncate">
                              {inv.invoice_number}
                            </p>
                            {needsApproval && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap shrink-0">
                                Action needed
                              </span>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-150" />
                        </div>

                        {/* Amount + Status row */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-base font-bold text-gray-900 whitespace-nowrap">
                            {inv.currency} {parseFloat(inv.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                          </p>
                          <StatusPill status={inv.status} />
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            {inv.type_display}
                          </span>
                          <span className="text-gray-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            {formatDate(inv.issue_date)}
                          </span>
                          {inv.due_date && (
                            <>
                              <span className="text-gray-200">|</span>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                Due {formatDate(inv.due_date)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-3 shadow-sm animate-fade-in" style={{ animationDelay: '400ms' }}>
          <p className="text-xs sm:text-sm text-gray-500">
            Page <span className="font-semibold text-gray-700">{pagination.current_page}</span> of{' '}
            <span className="font-semibold text-gray-700">{pagination.total_pages}</span>
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pagination.total_pages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
