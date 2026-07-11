'use client';

import { useState, Fragment, useRef, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/context/AuthContext';
import {
  Inbox, CheckCircle2, XCircle, AlertTriangle, Clock,
  ChevronRight, ChevronDown, Search, RefreshCw, UserPlus, X, Copy, Eye, EyeOff,
  Info, AlertCircle, Loader2, ChevronLeft, FilterX, SlidersHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Observation {
  id: string;
  rule_code: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  field_name: string;
  message: string;
  suggestion: string;
  line_number: number | null;
}

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
  observations: Observation[];
}

const SEV: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: { icon: XCircle,       color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  high:     { icon: AlertTriangle, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  medium:   { icon: AlertCircle,   color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  info:     { icon: Info,          color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
};

interface InboundStats {
  total: number;
  pending_review: number;
  validation_failed: number;
  approved: number;
  rejected: number;
  fta_accepted: number;
  total_value: string | null;
}

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
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

const STAT_CARDS = [
  { label: 'Total',           key: 'total' as const,             icon: Inbox,         color: 'blue' },
  { label: 'Pending Review',  key: 'pending_review' as const,    icon: Clock,         color: 'orange' },
  { label: 'Failed Val.',     key: 'validation_failed' as const, icon: AlertTriangle, color: 'red' },
  { label: 'Approved',        key: 'approved' as const,          icon: CheckCircle2,  color: 'emerald' },
  { label: 'Rejected',        key: 'rejected' as const,          icon: XCircle,       color: 'rose' },
  { label: 'FTA Accepted',    key: 'fta_accepted' as const,      icon: CheckCircle2,  color: 'indigo' },
];

const STAT_GRADIENTS: Record<string, string> = {
  blue:    'from-blue-400 to-blue-600',
  orange:  'from-orange-400 to-orange-600',
  red:     'from-red-400 to-red-600',
  emerald: 'from-emerald-400 to-emerald-500',
  rose:    'from-rose-400 to-rose-600',
  indigo:  'from-indigo-400 to-indigo-600',
};

const STAT_SHADOWS: Record<string, string> = {
  blue:    'shadow-blue-500/25',
  orange:  'shadow-orange-500/25',
  red:     'shadow-red-500/25',
  emerald: 'shadow-emerald-500/25',
  rose:    'shadow-rose-500/25',
  indigo:  'shadow-indigo-500/25',
};

const STAT_TEXT: Record<string, string> = {
  blue:    'text-blue-600',
  orange:  'text-orange-600',
  red:     'text-red-600',
  emerald: 'text-emerald-600',
  rose:    'text-rose-600',
  indigo:  'text-indigo-600',
};

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent">

        {apiKey ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100/60">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Add Inbound Supplier</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/60 p-4 space-y-2">
                <p className="text-sm font-semibold text-emerald-800">Supplier created successfully!</p>
                <p className="text-xs text-emerald-700">
                  Copy the API key below — it will <strong>not be shown again</strong>.
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">API Key</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xs bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-2.5 truncate select-all">
                    {showKey ? apiKey : '•'.repeat(32)}
                  </div>
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="p-2.5 rounded-xl border border-gray-200/80 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={copyKey}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100/60">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Add Inbound Supplier</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier Name *</label>
                  <input required value={form.name} onChange={set('name')}
                    placeholder="Al Mansouri Trading LLC"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">TRN (15 digits) *</label>
                  <input required value={form.trn} onChange={set('trn')}
                    placeholder="100000000000001" maxLength={15}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={set('phone')}
                    placeholder="+971 50 000 0000"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                  <input required type="email" value={form.email} onChange={set('email')}
                    placeholder="invoices@supplier.ae"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                  <textarea value={form.address} onChange={set('address')}
                    placeholder="Street, City, UAE" rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={set('notes')}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none" />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50/80 border border-red-200/60 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
                  {loading ? 'Creating…' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_DOT_COLORS: Record<string, string> = {
  received:          'bg-blue-500',
  validating:        'bg-yellow-500',
  validation_failed: 'bg-red-500',
  pending_review:    'bg-orange-500',
  approved:          'bg-emerald-500',
  rejected:          'bg-red-500',
  fta_submitted:     'bg-indigo-500',
  fta_accepted:      'bg-emerald-500',
  fta_rejected:      'bg-red-500',
};

function StatusDropdown({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="relative w-full sm:w-52" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full rounded-xl border border-gray-200/80 bg-white pl-3 pr-8 py-2.5 text-sm text-left
                   text-gray-700 cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                   transition-all duration-200 shadow-sm relative"
      >
        <span className={clsx('h-2 w-2 rounded-full shrink-0', STATUS_DOT_COLORS[value] ?? 'bg-gray-400')} />
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={clsx(
          'absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
          open && 'rotate-180',
        )} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-blue-100/70 bg-white shadow-lg shadow-blue-500/10 py-1 overflow-hidden">
          {options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={clsx(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <span className={clsx('h-2 w-2 rounded-full shrink-0', STATUS_DOT_COLORS[opt.value] ?? 'bg-gray-400')} />
                <span>{opt.label}</span>
                {active && (
                  <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

export default function InboundPage() {
  const { activeId, activeCompany } = useCompany();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter]   = useState('');
  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [expanded, setExpanded]           = useState<string | null>(null);

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
  const pagination = listData?.pagination ?? {};
  const stats: InboundStats = statsData?.data ?? {};
  const totalCount = pagination.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasActiveFilters = statusFilter !== '' || search !== '';
  const statValues = [stats.total, stats.pending_review, stats.validation_failed, stats.approved, stats.rejected, stats.fta_accepted];

  return (
    <div className="space-y-6 animate-fade-in">

      {showAddSupplier && activeId && (
        <AddSupplierModal
          companyId={activeId}
          onClose={() => setShowAddSupplier(false)}
          onCreated={() => mutate()}
        />
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-950 to-indigo-950 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300/70 uppercase tracking-[0.12em]">Inbound</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Inbound Invoices</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">
              Supplier-submitted invoices — validate, review, and submit to FTA
              {activeCompany?.name && (
                <><span className="text-blue-300/40 mx-1.5">·</span>{activeCompany.name}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeId && (
              <button
                onClick={() => setShowAddSupplier(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-950 hover:bg-blue-50 px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200"
              >
                <UserPlus className="h-4 w-4" /> Add Supplier
              </button>
            )}
            <button
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.key}
            className={clsx(
              'group relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-4',
              'shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.2)] hover:-translate-y-[1px] transition-all duration-300',
              'before:absolute before:inset-x-2 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent',
            )}
          >
            <div className="flex items-center gap-3">
              <div className={clsx(
                'h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md',
                STAT_GRADIENTS[card.color], STAT_SHADOWS[card.color],
              )}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className={clsx('text-lg font-bold tracking-tight', STAT_TEXT[card.color])}>
                  {statValues[i] ?? 0}
                </p>
                <p className="text-[11px] text-gray-500 font-medium truncate">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by invoice number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-gray-200/80 bg-white pl-9 pr-4 py-2.5 text-sm
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                       transition-all duration-200 shadow-sm"
          />
        </div>
        <StatusDropdown
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />
        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter(''); setSearch(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
          >
            <FilterX className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {/* ── Table Card ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-7 w-7 text-blue-400" />
            </div>
            <p className="text-base font-semibold text-gray-900">
              {hasActiveFilters ? 'No matching invoices' : 'No inbound invoices'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {hasActiveFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Supplier invoices submitted via API will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-blue-100/60">
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/40">
                  {invoices.map((inv, idx) => {
                    const isOpen = expanded === inv.id;
                    const hasFindings = (inv.observations?.length ?? 0) > 0;
                    return (
                      <Fragment key={inv.id}>
                        <tr
                          className={clsx(
                            'transition-all duration-150',
                            idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/10',
                            'hover:bg-blue-50/40 hover:shadow-[inset_0_1px_0_rgba(59,130,246,0.06)]',
                            isOpen && 'bg-blue-50/30',
                          )}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {hasFindings ? (
                                <button
                                  onClick={() => setExpanded(isOpen ? null : inv.id)}
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                  {isOpen
                                    ? <ChevronDown className="h-3.5 w-3.5" />
                                    : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                              ) : (
                                <span className="w-3.5 shrink-0" />
                              )}
                              <Link href={`/inbound/${inv.id}`} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                                {inv.supplier_invoice_number}
                              </Link>
                              {inv.has_critical_errors && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/60 px-1.5 py-0.5 rounded-md">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Critical
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">{inv.supplier_name}</p>
                            <p className="text-[11px] text-gray-400 font-mono">TRN: {inv.supplier_trn}</p>
                          </td>
                          <td className="px-4 py-4 text-gray-600">{inv.issue_date}</td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-semibold text-gray-900 tabular-nums">{fmtAmt(inv.total_amount)} {inv.currency}</p>
                            <p className="text-[11px] text-gray-400">VAT: {fmtAmt(inv.total_vat)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-4 text-center">
                            {inv.validation_score !== null ? (
                              <span className={clsx(
                                'font-bold text-sm',
                                inv.validation_score >= 80 ? 'text-emerald-600' :
                                inv.validation_score >= 50 ? 'text-orange-500' : 'text-red-600',
                              )}>
                                {inv.validation_score}
                                {inv.observation_count > 0 && (
                                  <span className="ml-0.5 text-[10px] text-gray-400 font-medium">({inv.observation_count})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs">
                            {new Date(inv.received_at).toLocaleDateString('en-AE', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/inbound/${inv.id}`}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              Review <ChevronRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>

                        {isOpen && hasFindings && (
                          <tr key={`${inv.id}-obs`}>
                            <td colSpan={8} className="px-4 pb-4 pt-1 bg-blue-50/20">
                              <div className="pl-11 space-y-2">
                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                  Why “{STATUS_CONFIG[inv.status]?.label ?? inv.status}” — {inv.observations.length} finding{inv.observations.length !== 1 ? 's' : ''}
                                </p>
                                {inv.observations.map((obs) => {
                                  const cfg = SEV[obs.severity] ?? SEV.info;
                                  const Icon = cfg.icon;
                                  return (
                                    <div key={obs.id} className={clsx('rounded-xl border p-3', cfg.bg, cfg.border)}>
                                      <div className="flex items-start gap-2.5">
                                        <Icon className={clsx('h-4 w-4 mt-0.5 shrink-0', cfg.color)} />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={clsx('text-[11px] font-bold', cfg.color)}>[{obs.severity.toUpperCase()}]</span>
                                            <span className="text-[11px] font-mono text-gray-500">{obs.rule_code}</span>
                                            {obs.field_name && <span className="text-[11px] text-gray-400">· {obs.field_name}</span>}
                                            {obs.line_number && <span className="text-[11px] text-gray-400">· Line {obs.line_number}</span>}
                                          </div>
                                          <p className="text-xs text-gray-700 mt-0.5">{obs.message}</p>
                                          {obs.suggestion && (
                                            <p className="text-xs text-gray-500 mt-0.5 italic">Action: {obs.suggestion}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3.5 border-t border-blue-100/40 bg-gradient-to-r from-gray-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 text-xs">
                  Page {page} of {totalPages}
                  <span className="text-gray-300 mx-1">·</span>
                  {totalCount} invoice{totalCount !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                      page <= 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60',
                    )}
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
                        className={clsx(
                          'min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all duration-200',
                          page === pageNum
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                      page >= totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/60',
                    )}
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
