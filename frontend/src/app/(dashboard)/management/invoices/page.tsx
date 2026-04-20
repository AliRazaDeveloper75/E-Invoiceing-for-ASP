'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  FileText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  Send, CheckCircle2, XCircle, Clock, Building2, User, Eye,
  Landmark,
} from 'lucide-react';

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
  draft:     { label: 'Draft',     color: 'text-gray-600',    bg: 'bg-gray-100',    icon: FileText },
  pending:   { label: 'Pending',   color: 'text-blue-600',    bg: 'bg-blue-100',    icon: Clock },
  submitted: { label: 'Submitted', color: 'text-indigo-600',  bg: 'bg-indigo-100',  icon: Send },
  validated: { label: 'Validated', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'text-red-600',     bg: 'bg-red-100',     icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',   bg: 'bg-slate-100',   icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText };
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
                     bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 transition-colors"
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
                     bg-teal-100 text-teal-700 hover:bg-teal-200 disabled:opacity-50 transition-colors"
        >
          {loading === 'fta' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Landmark className="h-3 w-3" />}
          Report FTA
        </button>
      )}
      {invoice.fta_status === 'reported' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-600">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View and manage invoices across all companies
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Invoice #, customer, company…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
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
                                     bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
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
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>{count} invoices total</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
