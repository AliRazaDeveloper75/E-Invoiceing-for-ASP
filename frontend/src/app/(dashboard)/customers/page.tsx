'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Plus, Building2, Mail, X, Loader2, CheckCircle2, Search, Eye,
  ChevronLeft, ChevronRight, FilterX, Users, Globe,
  UserPlus, ArrowUpRight, User, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Customer } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
function absUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  return url.startsWith('/') ? `${BACKEND_URL}${url}` : url;
}

async function fetcher(url: string) {
  const r = await api.get<{ results: Customer[]; pagination: { count: number } }>(url);
  return r.data;
}

const TYPE_LABELS: Record<string, string> = {
  b2b: 'B2B', b2g: 'B2G', b2c: 'B2C',
};

const TYPE_PILLS: Record<string, string> = {
  b2b: 'bg-blue-50 text-blue-700 border-blue-200',
  b2g: 'bg-amber-50 text-amber-700 border-amber-200',
  b2c: 'bg-gray-100 text-gray-600 border-gray-200',
};

function InviteBuyerModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(customer.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/buyers/invite/', { customer_id: customer.id, email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send invitation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Invite Buyer</h2>
              <p className="text-xs text-gray-500">{customer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="font-semibold text-gray-900">Invitation Sent!</p>
            <p className="text-sm text-gray-500 mt-1">
              An invite link has been sent to <strong className="text-gray-700">{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-500">
              The buyer will receive an email with a link to create their account and access invoices issued to{' '}
              <strong className="text-gray-700">{customer.name}</strong>.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Buyer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                placeholder="buyer@company.com"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {saving ? 'Sending\u2026' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CustomerDetailModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between gap-4 py-2.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right break-words max-w-[60%]">{value || '\u2014'}</span>
    </div>
  );
  const missing = customer.missing_fields ?? [];
  const pct = customer.completion_percent ?? (customer.is_complete ? 100 : 0);
  const done = customer.is_complete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            {customer.logo
              ? <img src={absUrl(customer.logo)} alt={customer.name} className="h-12 w-12 rounded-xl object-cover border-2 border-gray-100 shadow-sm" />
              : <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
              <span className={clsx('inline-block mt-0.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border', TYPE_PILLS[customer.customer_type])}>
                {TYPE_LABELS[customer.customer_type]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Completion bar */}
          <div className={clsx('rounded-xl border-2 px-5 py-4', done ? 'bg-emerald-50/80 border-emerald-200/60' : 'bg-amber-50/80 border-amber-200/60')}>
            <div className="flex items-center justify-between mb-2">
              <p className={clsx('text-sm font-semibold flex items-center gap-1.5', done ? 'text-emerald-800' : 'text-amber-800')}>
                {done
                  ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Profile complete</>
                  : <><User className="h-4 w-4 text-amber-600" /> Profile not completed</>}
              </p>
              <span className={clsx('text-sm font-bold', done ? 'text-emerald-700' : 'text-amber-700')}>{pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/70 overflow-hidden ring-1 ring-inset ring-black/5">
              <div className={clsx('h-full rounded-full transition-all duration-700', done ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
            </div>
            {!done && missing.length > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-amber-700">Missing: {missing.join(', ')}</p>
                <Link href={`/customers/${customer.id}/edit`}
                  className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                  Complete profile
                </Link>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-xl px-5 py-2">
            <Row label="Legal name" value={customer.legal_name} />
            <Row label="TRN" value={customer.trn} />
            <Row label="TRN issued" value={customer.trn_issue_date} />
            <Row label="TRN expiry" value={customer.trn_expiry_date} />
            <Row label="VAT number" value={customer.vat_number} />
            <Row label="PEPPOL endpoint" value={customer.peppol_endpoint} />
            <Row label="Address" value={customer.formatted_address || [customer.street_address, customer.city, customer.country].filter(Boolean).join(', ')} />
            <Row label="Email" value={customer.email} />
            <Row label="Phone" value={customer.phone} />
          </div>

          {/* Document links */}
          <div className="flex items-center gap-4 pt-1">
            {customer.trn_document && (
              <a href={customer.trn_document} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                <Shield className="h-4 w-4" /> View TRN document <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {customer.logo && (
              <a href={absUrl(customer.logo)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                <Building2 className="h-4 w-4" /> View logo <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { activeId, activeCompany } = useCompany();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [inviteTarget, setInviteTarget] = useState<Customer | null>(null);
  const [viewTarget, setViewTarget]     = useState<Customer | null>(null);

  const qp = new URLSearchParams({ page: String(page) });
  if (search.trim()) qp.set('search', search.trim());
  const url = isAdmin
    ? `/customers/?${qp.toString()}`
    : activeId
      ? `/customers/?company_id=${activeId}&${qp.toString()}`
      : null;

  const { data, isLoading } = useSWR(url, fetcher);

  const dataResults = data?.results;
  const totalCount  = data?.pagination?.count ?? 0;
  const totalPages  = Math.ceil(totalCount / 20);

  const customers = useMemo(() => dataResults ?? [], [dataResults]);

  const statsSummary = useMemo(() => {
    const total = customers.length;
    const b2b = customers.filter((c) => c.customer_type === 'b2b').length;
    const b2g = customers.filter((c) => c.customer_type === 'b2g').length;
    const b2c = customers.filter((c) => c.customer_type === 'b2c').length;
    return { total, b2b, b2g, b2c };
  }, [customers]);

  const hasSearch = search.trim() !== '';

  return (
    <div className="space-y-6">

      {/* ── Header card with stats ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {isAdmin ? 'All Customers' : 'Your Customers'}
                </h1>
                <p className="text-sm text-blue-200/70 mt-1">
                  {totalCount > 0 ? `${totalCount} total` : 'Manage your customers'}
                  {isAdmin ? ' across all companies' : ''}
                </p>
              </div>
              {!isAdmin && (
                <Link
                  href="/customers/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-all shrink-0 self-start sm:self-auto"
                >
                  <UserPlus className="h-4 w-4" /> New Customer
                </Link>
              )}
            </div>

            {/* Stat chips */}
            {statsSummary.total > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">Total</p>
                  <p className="text-lg font-bold text-white mt-0.5">{statsSummary.total}</p>
                </div>
                {[
                  { label: 'B2B', count: statsSummary.b2b, dot: 'bg-blue-400' },
                  { label: 'B2G', count: statsSummary.b2g, dot: 'bg-amber-400' },
                  { label: 'B2C', count: statsSummary.b2c, dot: 'bg-gray-400' },
                ].filter((s) => s.count > 0).map((s) => (
                  <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className={clsx('h-2 w-2 rounded-full', s.dot)} />
                      <p className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider">{s.label}</p>
                    </div>
                    <p className="text-lg font-bold text-white mt-0.5">{s.count}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>

      {/* ── Search ── */}
      <AnimatedSection delay={80}>
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={isAdmin ? 'Search customers by name, TRN, or email\u2026' : 'Search by name, TRN, or email\u2026'}
            className="w-full rounded-xl border-2 border-gray-200 bg-white pl-10 pr-10 py-2.5 text-sm
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                       shadow-sm transition-all"
          />
          {hasSearch && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <FilterX className="h-4 w-4" />
            </button>
          )}
        </div>
      </AnimatedSection>

      {/* ── Content ── */}
      <AnimatedSection delay={120}>
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border-2 border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Users className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-base font-semibold text-gray-900">
                {hasSearch ? 'No matching customers' : 'No customers yet'}
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                {hasSearch
                  ? 'Try adjusting your search criteria.'
                  : isAdmin
                    ? 'No customers exist on the platform yet.'
                    : 'Add your first customer to start issuing invoices.'}
              </p>
              {!isAdmin && !hasSearch && (
                <Link
                  href="/customers/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all"
                >
                  <Plus className="h-4 w-4" /> New Customer
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {customers.map((c, idx) => (
                  <AnimatedSection key={c.id} delay={Math.min(idx * 50, 400)} direction="up" duration={500}>
                    <div className="px-5 py-5 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {c.logo
                            ? <img src={absUrl(c.logo)} alt={c.name} className="h-10 w-10 rounded-xl object-cover border border-gray-200 shadow-sm" />
                            : <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                {c.name.slice(0, 2).toUpperCase()}
                              </div>}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-md border', TYPE_PILLS[c.customer_type])}>
                              {TYPE_LABELS[c.customer_type]}
                            </span>
                          </div>
                        </div>
                        {c.is_complete === false && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">
                            Incomplete
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                        {c.trn && (
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="font-mono">{c.trn}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                        {c.country && (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 text-gray-400 shrink-0" />
                            {c.country}
                          </div>
                        )}
                        {isAdmin && (c as Customer & { company_name?: string }).company_name && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{(c as Customer & { company_name?: string }).company_name}</span>
                          </div>
                        )}
                      </div>
                      {!isAdmin && (
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => setViewTarget(c)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </button>
                          <button
                            onClick={() => setInviteTarget(c)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          >
                            <Mail className="h-3.5 w-3.5" /> Invite
                          </button>
                        </div>
                      )}
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-950 to-indigo-950">
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Name</th>
                      {isAdmin && (
                        <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Company</th>
                      )}
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">TRN</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Country</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Email</th>
                      {!isAdmin && (
                        <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customers.map((c, idx) => (
                      <tr
                        key={c.id}
                        className={clsx(
                          'transition-all duration-200',
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                          'hover:bg-blue-50/30 hover:shadow-inner',
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {c.logo
                              ? <img src={absUrl(c.logo)} alt={c.name} className="h-9 w-9 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0" />
                              : <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </div>}
                            <span className="font-semibold text-gray-900">{c.name}</span>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                              <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{(c as Customer & { company_name?: string }).company_name ?? '\u2014'}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-gray-500 bg-gray-50 border border-gray-200/60 px-2.5 py-1 rounded-lg">
                            {c.trn || '\u2014'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={clsx('inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md border', TYPE_PILLS[c.customer_type])}>
                            {TYPE_LABELS[c.customer_type]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            {c.country || '\u2014'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">{c.email || '\u2014'}</td>
                        {!isAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {c.is_complete === false && (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-1 rounded-md">
                                  Incomplete
                                </span>
                              )}
                              <button
                                onClick={() => setViewTarget(c)}
                                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                title="View customer details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setInviteTarget(c)}
                                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                title="Invite buyer to portal"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                  <span className="text-gray-500 text-xs order-2 sm:order-1">
                    Page {page} of {totalPages}
                    <span className="text-gray-300 mx-1.5">\u00b7</span>
                    {totalCount} total
                  </span>
                  <div className="flex items-center gap-1.5 order-1 sm:order-2">
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

                    <div className="hidden sm:flex items-center gap-1">
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
                              'min-w-[34px] h-8 rounded-lg text-sm font-medium transition-all duration-200',
                              page === pageNum
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <div className="sm:hidden text-xs text-gray-500 font-medium px-2">
                      {page} / {totalPages}
                    </div>

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
      </AnimatedSection>

      {inviteTarget && (
        <InviteBuyerModal
          customer={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}

      {viewTarget && (
        <CustomerDetailModal
          customer={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
}
