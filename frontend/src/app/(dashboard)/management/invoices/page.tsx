'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import Link from 'next/link';
import {
  FileText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  Send, CheckCircle2, XCircle, Clock, Building2, User, Eye,
  Landmark,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

function fetcher(url: string) {
  return api.get(url).then((r) => r.data.data);
}

interface AdminInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  type_display: string;
  status: string;
  status_display: string;
  company_name: string;
  company_trn: string;
  customer_name: string;
  issue_date: string;
  currency: string;
  subtotal: string;
  total_vat: string;
  total_amount: string;
  fta_status: string | null;
  asp_submission_id: string | null;
  created_by_name: string;
  created_at: string;
}

interface PaginatedResponse {
  results: AdminInvoice[];
  pagination: {
    count: number;
    next: string | null;
    previous: string | null;
  };
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'text-gray-600',    bg: 'bg-gradient-to-r from-gray-100 to-gray-50',    icon: FileText },
  pending:   { label: 'Pending',   color: 'text-blue-600',    bg: 'bg-gradient-to-r from-blue-100 to-blue-50',    icon: Clock },
  submitted: { label: 'Submitted', color: 'text-indigo-600',  bg: 'bg-gradient-to-r from-indigo-100 to-indigo-50',  icon: Send },
  validated: { label: 'Validated', color: 'text-emerald-600', bg: 'bg-gradient-to-r from-emerald-100 to-emerald-50', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'text-red-600',     bg: 'bg-gradient-to-r from-red-100 to-red-50',     icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',   bg: 'bg-gradient-to-r from-slate-100 to-slate-50',   icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gradient-to-r from-gray-100 to-gray-50', icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Action buttons ────────────────────────────────────────────────────────────

function ActionCell({ invoice, onRefresh }: { invoice: AdminInvoice; onRefresh: () => void }) {
  const [loading, setLoading] = useState<'submit' | 'fta' | null>(null);

  const handleSubmit = async () => {
    setLoading('submit');
    try {
      await api.post(`/admin/invoices/${invoice.id}/submit/`);
      onRefresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit';
      alert(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleFta = async () => {
    setLoading('fta');
    try {
      await api.post(`/admin/invoices/${invoice.id}/report-fta/`);
      onRefresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to report';
      alert(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {invoice.status === 'draft' && (
        <button
          onClick={handleSubmit}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                     bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-sm disabled:opacity-50 transition-all duration-200"
        >
          {loading === 'submit' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Submit ASP
        </button>
      )}
      {(invoice.status === 'validated' || invoice.status === 'paid') && !invoice.fta_status && (
        <button
          onClick={handleFta}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                     bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white shadow-sm disabled:opacity-50 transition-all duration-200"
        >
          {loading === 'fta' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Landmark className="h-3 w-3" />}
          Report FTA
        </button>
      )}
      {invoice.fta_status === 'reported' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-teal-50 to-teal-50/80 text-teal-600 border border-teal-200">
          <CheckCircle2 className="h-3 w-3" /> FTA Reported
        </span>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInvoicesPage() {
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]         = useState(1);
  const pageSize = 20;

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (search)       params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    return `/admin/invoices/?${params.toString()}`;
  }, [search, statusFilter, page]);

  const { data, isLoading, mutate } = useSWR<PaginatedResponse>(buildUrl(), fetcher);

  const invoices = data?.results ?? [];
  const count    = data?.pagination.count ?? 0;
  const totalPages = Math.ceil(count / pageSize);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    mutate();
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
    <div className="space-y-6">
      {/* Gradient card header */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-2xl p-6 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.15)] border border-blue-100/70 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.12em]">All Invoices</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">All Invoices</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              View and manage invoices across all companies
            </p>
          </div>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200/60 transition-all shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters — 3D card */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-4 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Invoice #, customer, company…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 shadow-sm bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400 shrink-0" />
            <CustomSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              options={[
                { value: '', label: 'All Statuses' },
                ...Object.entries(STATUS_CONFIG).map(([val, { label }]) => ({ value: val, label })),
              ]}
              className="flex-1 sm:flex-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Search className="h-3.5 w-3.5" /> Search
          </button>
        </form>
      </div>

      {/* Table — 3D card */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-blue-400" />
            </div>
            <p className="font-medium text-gray-500">No invoices found</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-blue-100/40">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400">{inv.type_display}</p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                    <span className="truncate">{inv.company_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <User className="h-3 w-3 text-gray-400 shrink-0" />
                    <span className="truncate">{inv.customer_name || '\u2014'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 text-sm">
                      {inv.currency} {parseFloat(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs text-gray-400">
                      {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-AE') : '\u2014'}
                    </span>
                  </div>
                  {inv.fta_status === 'reported' && (
                    <span className="text-[10px] text-teal-600 font-medium">FTA reported</span>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Link href={`/management/invoices/${inv.id}`}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-sm transition-all">
                      <Eye className="h-3 w-3" /> View
                    </Link>
                    <ActionCell invoice={inv} onRefresh={() => mutate()} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-blue-100/60">
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/40">
                  {invoices.map((inv, idx) => (
                    <tr key={inv.id} className={`transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/10'} hover:bg-blue-50/40 hover:shadow-[inset_0_1px_0_rgba(59,130,246,0.06)]`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-400">{inv.type_display}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-gray-700">{inv.company_name}</p>
                            {inv.company_trn && <p className="text-xs text-gray-400">TRN: {inv.company_trn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-700">{inv.customer_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                        {inv.fta_status === 'reported' && (
                          <span className="block mt-1 text-[10px] text-teal-600 font-medium">FTA ✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">
                          {inv.currency} {parseFloat(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400">
                          VAT: {parseFloat(inv.total_vat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-AE') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/management/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                                       bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white shadow-sm transition-all duration-200"
                          >
                            <Eye className="h-3 w-3" /> View
                          </Link>
                          <ActionCell invoice={inv} onRefresh={() => mutate()} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3.5 border-t border-blue-100/40 bg-gradient-to-r from-gray-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 text-xs">{count} invoices total</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <span className="text-xs text-gray-500 px-2">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60 disabled:text-gray-300 disabled:cursor-not-allowed"
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
    </RoleGuard>
  );
}
