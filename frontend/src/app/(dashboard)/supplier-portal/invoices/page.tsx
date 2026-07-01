'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Inbox, Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Invoice {
  id: string;
  supplier_invoice_number: string;
  invoice_type: string;
  issue_date: string;
  currency: string;
  total_amount: string;
  total_vat: string;
  status: string;
  validation_score: number | null;
  has_critical_errors: boolean;
  observation_count: number;
  received_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:          { label: 'Received',         color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  validating:        { label: 'Validating',        color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200' },
  validation_failed: { label: 'Validation Failed', color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  pending_review:    { label: 'Pending Review',    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  approved:          { label: 'Approved',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  rejected:          { label: 'Rejected',          color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  fta_submitted:     { label: 'FTA Submitted',     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  fta_accepted:      { label: 'FTA Accepted',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'received',          label: 'Received' },
  { value: 'validating',        label: 'Validating' },
  { value: 'validation_failed', label: 'Validation Failed' },
  { value: 'pending_review',    label: 'Pending Review' },
  { value: 'approved',          label: 'Approved' },
  { value: 'rejected',          label: 'Rejected' },
  { value: 'fta_accepted',      label: 'FTA Accepted' },
];

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data;
}

export default function SupplierInvoicesPage() {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    supplier_self: 'true',
    ...(search.trim()    ? { search: search.trim() } : {}),
    ...(statusFilter     ? { status: statusFilter }  : {}),
  });

  const { data, isLoading, mutate } = useSWR(
    `/inbound/?${params}`,
    fetcher,
  );

  const invoices: Invoice[] = data?.results ?? [];
  const pagination = data?.pagination ?? {};

  const PAGE_SIZE = 25;
  const totalPages = pagination.count ? Math.ceil(pagination.count / PAGE_SIZE) : 1;

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-2xl p-6 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.15)] border border-blue-100/70 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.12em]">My Invoices</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Invoices</h1>
            <p className="text-sm text-gray-500 mt-0.5">All invoices you have submitted</p>
          </div>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200/60 transition-all shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-4 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-gray-200/80 bg-white pl-9 pr-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200/80 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 shadow-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4">
              <Inbox className="h-7 w-7 text-blue-400" />
            </div>
            <p className="font-medium text-gray-500">No invoices found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-blue-100/60">
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/40">
                  {invoices.map((inv, idx) => {
                    const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
                    return (
                      <tr key={inv.id} className={`transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/10'} hover:bg-blue-50/40 hover:shadow-[inset_0_1px_0_rgba(59,130,246,0.06)]`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-gray-800">
                            {inv.supplier_invoice_number}
                          </span>
                          {inv.has_critical_errors && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              <AlertTriangle className="h-2.5 w-2.5" /> Critical
                            </span>
                          )}
                          {inv.observation_count > 0 && (
                            <span className="ml-1 text-[10px] text-gray-400">
                              {inv.observation_count} note{inv.observation_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.issue_date}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-gray-900 text-xs">{fmtAmt(inv.total_amount)} {inv.currency}</p>
                          <p className="text-[11px] text-gray-400">VAT: {fmtAmt(inv.total_vat)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inv.validation_score !== null ? (
                            <span className={`font-bold text-sm ${
                              inv.validation_score >= 80 ? 'text-emerald-600' :
                              inv.validation_score >= 50 ? 'text-orange-500' : 'text-red-600'
                            }`}>
                              {inv.validation_score}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(inv.received_at).toLocaleDateString('en-AE', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.count > 0 && (
              <div className="px-4 py-3.5 border-t border-blue-100/40 bg-gradient-to-r from-gray-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 text-xs">
                  Page {page} of {totalPages}
                  <span className="text-gray-300 mx-1">·</span>
                  {pagination.count} invoice{pagination.count !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!pagination.previous}
                    onClick={() => setPage((p) => p - 1)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      !pagination.previous
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60'
                    }`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>

                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                          page === pageNum
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={!pagination.next}
                    onClick={() => setPage((p) => p + 1)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      !pagination.next
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60'
                    }`}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
