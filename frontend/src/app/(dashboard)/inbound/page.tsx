'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import {
  Inbox, CheckCircle2, XCircle, AlertTriangle, Clock,
  ChevronRight, Search, RefreshCw, Filter, UserPlus, X, Copy, Eye, EyeOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InboundInvoice {
  id: string;
  supplier_name: string;
  supplier_trn: string;
  supplier_invoice_number: string;
  invoice_type: string;
  issue_date: string;
  currency: string;
  total_amount: string;
  total_vat: string;
  status: string;
  channel: string;
  received_at: string;
  validation_score: number | null;
  has_critical_errors: boolean;
  observation_count: number;
}

interface InboundStats {
  total: number;
  pending_review: number;
  validation_failed: number;
  approved: number;
  rejected: number;
  fta_accepted: number;
  total_value: string | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:          { label: 'Received',        color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  validating:        { label: 'Validating',       color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  validation_failed: { label: 'Validation Failed',color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  pending_review:    { label: 'Pending Review',   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  approved:          { label: 'Approved',         color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  rejected:          { label: 'Rejected',         color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  fta_submitted:     { label: 'FTA Submitted',    color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  fta_accepted:      { label: 'FTA Accepted',     color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  fta_rejected:      { label: 'FTA Rejected',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color,
}: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value ?? 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data;
}

// ─── Add Supplier Modal ───────────────────────────────────────────────────────

interface AddSupplierModalProps {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}

function AddSupplierModal({ companyId, onClose, onCreated }: AddSupplierModalProps) {
  const [form, setForm] = useState({
    name: '', trn: '', email: '', phone: '', address: '', notes: '',
  });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [apiKey, setApiKey]     = useState('');
  const [showKey, setShowKey]   = useState(false);
  const [copied, setCopied]     = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/inbound/suppliers/', {
        ...form,
        receiving_company: companyId,
      });
      setApiKey(res.data.data.api_key);
      onCreated();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message ?? 'Failed to create supplier.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Add Inbound Supplier</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* API Key reveal (after creation) */}
        {apiKey ? (
          <div className="p-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-800">Supplier created successfully!</p>
              <p className="text-xs text-emerald-700">
                Copy the API key below — it will <strong>not be shown again</strong>.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-xs bg-gray-100 rounded-lg px-3 py-2 truncate select-all">
                  {showKey ? apiKey : '•'.repeat(32)}
                </div>
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={copyKey}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier Name *</label>
                <input required value={form.name} onChange={set('name')}
                  placeholder="Al Mansouri Trading LLC"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">TRN (15 digits) *</label>
                <input required value={form.trn} onChange={set('trn')}
                  placeholder="100000000000001" maxLength={15}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input value={form.phone} onChange={set('phone')}
                  placeholder="+971 50 000 0000"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={set('email')}
                  placeholder="invoices@supplier.ae"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                <textarea value={form.address} onChange={set('address')}
                  placeholder="Street, City, UAE" rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={set('notes')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                {loading ? 'Creating…' : 'Create Supplier'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Status filter options ────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboundPage() {
  const { activeId } = useCompany();
  const [statusFilter, setStatusFilter]   = useState('');
  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const listParams = new URLSearchParams({
    page: String(page),
    ...(activeId          ? { company_id: activeId } : {}),
    ...(statusFilter      ? { status: statusFilter } : {}),
    ...(search.trim()     ? { search: search.trim() } : {}),
  });

  const statsParams = activeId ? `?company_id=${activeId}` : '';

  const { data: listData, isLoading, mutate } = useSWR(
    `/inbound/?${listParams}`,
    fetcher,
  );
  const { data: statsData } = useSWR(
    `/inbound/stats/${statsParams}`,
    fetcher,
  );

  const invoices: InboundInvoice[] = listData?.results ?? [];
  const pagination                 = listData?.pagination ?? {};
  const stats: InboundStats        = statsData?.data ?? {};

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">

      {showAddSupplier && activeId && (
        <AddSupplierModal
          companyId={activeId}
          onClose={() => setShowAddSupplier(false)}
          onCreated={() => mutate()}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbound Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Supplier-submitted invoices — validate, review, and submit to FTA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeId && (
            <button
              onClick={() => setShowAddSupplier(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white
                         text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add Supplier
            </button>
          )}
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200
                       text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total"           value={stats.total ?? 0}            icon={Inbox}         color="bg-blue-100 text-blue-600" />
        <StatCard label="Pending Review"  value={stats.pending_review ?? 0}   icon={Clock}         color="bg-orange-100 text-orange-600" />
        <StatCard label="Failed Validation" value={stats.validation_failed ?? 0} icon={AlertTriangle} color="bg-red-100 text-red-600" />
        <StatCard label="Approved"        value={stats.approved ?? 0}         icon={CheckCircle2}  color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Rejected"        value={stats.rejected ?? 0}         icon={XCircle}       color="bg-red-100 text-red-600" />
        <StatCard label="FTA Accepted"    value={stats.fta_accepted ?? 0}     icon={CheckCircle2}  color="bg-indigo-100 text-indigo-600" />
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
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Inbox className="h-10 w-10 mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No inbound invoices found</p>
            <p className="text-sm mt-1">Supplier invoices submitted via API will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
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
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{inv.supplier_name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">TRN: {inv.supplier_trn}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">{fmtAmt(inv.total_amount)} {inv.currency}</p>
                    <p className="text-[11px] text-gray-400">VAT: {fmtAmt(inv.total_vat)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {inv.validation_score !== null ? (
                      <span className={`font-bold text-sm ${
                        inv.validation_score >= 80 ? 'text-emerald-600' :
                        inv.validation_score >= 50 ? 'text-orange-500' : 'text-red-600'
                      }`}>
                        {inv.validation_score}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                    {inv.observation_count > 0 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({inv.observation_count})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(inv.received_at).toLocaleDateString('en-AE', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/inbound/${inv.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-[#1e3a5f]
                                 hover:text-blue-700 transition-colors"
                    >
                      Review <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.count > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              {pagination.count} invoice{pagination.count !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                disabled={!pagination.previous}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40
                           hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={!pagination.next}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40
                           hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
