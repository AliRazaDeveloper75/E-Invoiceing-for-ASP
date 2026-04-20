'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Inbox, Search, RefreshCw, AlertTriangle } from 'lucide-react';

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

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">All invoices you have submitted</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200
                     text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Inbox className="h-10 w-10 mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No invoices found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
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
        )}

        {pagination.count > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{pagination.count} invoice{pagination.count !== 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button disabled={!pagination.previous} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Previous
              </button>
              <button disabled={!pagination.next} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
