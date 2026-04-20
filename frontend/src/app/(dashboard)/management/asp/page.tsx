'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  ShieldCheck, Landmark, Send, RefreshCw, Search,
  CheckCircle2, XCircle, Clock, FileText, Building2,
  ChevronLeft, ChevronRight, AlertTriangle,
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
    color: 'text-orange-600',
    activeBg: 'bg-orange-50 border-orange-500',
    description: 'Draft invoices ready to be submitted to the PEPPOL / ASP network',
    emptyText: 'No draft invoices in the ASP queue',
  },
  {
    id: 'fta',
    label: 'FTA Reporting Queue',
    icon: Landmark,
    color: 'text-teal-600',
    activeBg: 'bg-teal-50 border-teal-500',
    description: 'Validated invoices pending FTA reporting',
    emptyText: 'No invoices pending FTA reporting',
  },
];

// ─── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({
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
    <tr className={`hover:bg-gray-50 transition-colors ${done ? 'opacity-40' : ''}`}>
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
              ${tab === 'asp'
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-teal-600 text-white hover:bg-teal-700'
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
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoices…"
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <button
            onClick={() => mutate()}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Alert banner for non-empty queues */}
      {!isLoading && count > 0 && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
          ${tab === 'asp' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {tab === 'asp'
            ? `${count} draft invoice${count !== 1 ? 's' : ''} awaiting ASP submission`
            : `${count} validated invoice${count !== 1 ? 's' : ''} not yet reported to FTA`
          }
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CheckCircle2 className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">{tabInfo.emptyText}</p>
            <p className="text-xs mt-1">Queue is clear</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} tab={tab} onRefresh={() => mutate()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>{count} invoices</p>
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AspPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const activeTab    = searchParams.get('tab') ?? 'asp';

  const setTab = (id: string) => {
    router.replace(`/management/asp${id === 'asp' ? '' : '?tab=fta'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ASP & FTA Queues</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Submit invoices to PEPPOL / ASP and report validated invoices to the FTA
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon   = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all
                ${active
                  ? tab.activeBg + ' ' + tab.color
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
  );
}
