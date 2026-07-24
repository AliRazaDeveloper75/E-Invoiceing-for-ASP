'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import {
  ShieldCheck, Landmark, Send, RefreshCw, Search,
  CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle,
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
  pagination: { count: number; next: string | null; previous: string | null };
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'asp',
    label: 'ASP Verification Queue',
    icon: ShieldCheck,
    color: 'text-blue-600',
    activeBg: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-sm',
    description: 'Draft invoices ready to be submitted to the E-Invoice / ASP network',
    emptyText: 'No draft invoices in the ASP queue',
  },
  {
    id: 'fta',
    label: 'FTA Reporting Queue',
    icon: Landmark,
    color: 'text-blue-600',
    activeBg: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-sm',
    description: 'Validated invoices pending FTA reporting',
    emptyText: 'No invoices pending FTA reporting',
  },
];

// ─── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  tab,
  onRefresh,
  idx = 0,
}: {
  invoice: AdminInvoice;
  tab: string;
  onRefresh: () => void;
  idx?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (tab === 'asp') {
        await api.post(`/admin/invoices/${invoice.id}/submit/`);
      } else {
        await api.post(`/admin/invoices/${invoice.id}/report-fta/`);
      }
      setDone(true);
      setTimeout(onRefresh, 600);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className={`transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/10'} hover:bg-blue-50/40 hover:shadow-[inset_0_1px_0_rgba(59,130,246,0.06)] ${done ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
        <p className="text-xs text-gray-400">{invoice.type_display}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-gray-700 font-medium">{invoice.company_name}</p>
        {invoice.company_trn && <p className="text-xs text-gray-400">TRN: {invoice.company_trn}</p>}
      </td>
      <td className="px-4 py-3 text-gray-600">{invoice.customer_name || '—'}</td>
      <td className="px-4 py-3 text-right">
        <p className="font-semibold text-gray-900">
          {invoice.currency} {parseFloat(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-400">
          VAT {parseFloat(invoice.total_vat).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-AE') : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{invoice.created_by_name || '—'}</td>
      <td className="px-4 py-3">
        {done ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 shadow-sm
              ${tab === 'asp'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white'
                : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white'
              }`}
          >
            {loading
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : tab === 'asp'
                ? <Send className="h-3 w-3" />
                : <Landmark className="h-3 w-3" />
            }
            {tab === 'asp' ? 'Submit to ASP' : 'Report to FTA'}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Mobile card for ASP queue ────────────────────────────────────────────────

function AspMobileCard({
  invoice,
  tab,
  onRefresh,
}: {
  invoice: AdminInvoice;
  tab: string;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (tab === 'asp') {
        await api.post(`/admin/invoices/${invoice.id}/submit/`);
      } else {
        await api.post(`/admin/invoices/${invoice.id}/report-fta/`);
      }
      setDone(true);
      setTimeout(onRefresh, 600);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-4 space-y-2 ${done ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
          <p className="text-xs text-gray-400">{invoice.type_display}</p>
        </div>
        <p className="font-semibold text-gray-900 text-sm shrink-0">
          {invoice.currency} {parseFloat(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
      <p className="text-xs text-gray-500">{invoice.company_name}</p>
      <p className="text-xs text-gray-500">{invoice.customer_name || '\u2014'}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-AE') : '\u2014'}
          {invoice.created_by_name ? ` \u00b7 ${invoice.created_by_name}` : ''}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 shadow-sm
              ${tab === 'asp'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white'
                : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white'
              }`}
          >
            {loading
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : tab === 'asp'
                ? <Send className="h-3 w-3" />
                : <Landmark className="h-3 w-3" />
            }
            {tab === 'asp' ? 'Submit to ASP' : 'Report to FTA'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Queue table ───────────────────────────────────────────────────────────────

function QueueTable({ tab }: { tab: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const pageSize = 20;

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (tab === 'asp') params.set('asp_queue', 'true');
    else               params.set('fta_pending', 'true');
    if (search) params.set('search', search);
    params.set('page', String(page));
    return `/admin/invoices/?${params.toString()}`;
  }, [tab, search, page]);

  const { data, isLoading, mutate } = useSWR<PaginatedResponse>(buildUrl(), fetcher);

  const invoices   = data?.results ?? [];
  const count      = data?.pagination.count ?? 0;
  const totalPages = Math.ceil(count / pageSize);
  const tabInfo    = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <tabInfo.icon className={`h-5 w-5 ${tabInfo.color}`} />
          <div>
            <p className="text-sm font-medium text-gray-700">{tabInfo.description}</p>
            {!isLoading && (
              <p className={`text-xs font-semibold mt-0.5 ${count > 0 ? tabInfo.color : 'text-gray-400'}`}>
                {count} invoice{count !== 1 ? 's' : ''} in queue
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoices…"
              className="w-full sm:w-52 pl-8 pr-3 py-2.5 text-sm border border-gray-200/80 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 shadow-sm"
            />
          </div>
          <button
            onClick={() => mutate()}
            className="p-2 rounded-xl border border-gray-200/80 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200/60 transition-all shadow-sm shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Alert banner with gradient left border */}
      {!isLoading && count > 0 && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-sm border-l-4
          ${tab === 'asp' ? 'bg-orange-50 text-orange-700 border-l-orange-400 border border-orange-200' : 'bg-teal-50 text-teal-700 border-l-teal-400 border border-teal-200'}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {tab === 'asp'
            ? `${count} draft invoice${count !== 1 ? 's' : ''} awaiting ASP submission`
            : `${count} validated invoice${count !== 1 ? 's' : ''} not yet reported to FTA`
          }
        </div>
      )}

      {/* Table — 3D card */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-blue-400" />
            </div>
            <p className="font-medium text-gray-500">{tabInfo.emptyText}</p>
            <p className="text-xs mt-1 text-gray-400">Queue is clear</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-blue-100/40">
              {invoices.map((inv) => (
                <AspMobileCard key={inv.id} invoice={inv} tab={tab} onRefresh={() => mutate()} />
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
                    <th className="text-right px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Created by</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/40">
                  {invoices.map((inv, idx) => (
                    <InvoiceRow key={inv.id} invoice={inv} tab={tab} onRefresh={() => mutate()} idx={idx} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3.5 border-t border-blue-100/40 bg-gradient-to-r from-gray-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 text-xs">{count} invoices</span>
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
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function AspPageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const activeTab    = searchParams.get('tab') ?? 'asp';

  const setTab = (id: string) => {
    router.replace(`/management/asp${id === 'asp' ? '' : '?tab=fta'}`);
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
    <div className="space-y-6">
      {/* Gradient card header */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-2xl p-6 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.15)] border border-blue-100/70 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.12em]">ASP &amp; FTA Queues</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">ASP &amp; FTA Queues</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submit invoices to E-Invoice / ASP and report validated invoices to the FTA
          </p>
        </div>
      </div>

      {/* Tabs — blue theme */}
      <div className="flex flex-col sm:flex-row gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon   = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200
                ${active
                  ? tab.activeBg
                  : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 shadow-sm'
                }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <QueueTable tab={activeTab} />
    </div>
    </RoleGuard>
  );
}

export default function AspPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…</div>}>
      <AspPageInner />
    </Suspense>
  );
}
