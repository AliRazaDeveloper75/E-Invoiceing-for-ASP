'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import {
  Plus, Download, FileText, Building2, Eye, Search,
  ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal,
  FilterX, Loader2, ArrowUpRight, ReceiptText,
  Clock, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import type { InvoiceListItem, InvoiceStatus } from '@/types';

async function downloadFile(
  url: string,
  filename: string,
  mimeType: string,
  errorMsg: string,
) {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    alert(errorMsg);
  }
}

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'validated', label: 'Validated' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'paid', label: 'Paid' },
];

const STATUS_CHIP_META: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  draft:     { icon: Clock,        bg: 'bg-gray-100',  text: 'text-gray-600' },
  pending:   { icon: Clock,        bg: 'bg-amber-100', text: 'text-amber-700' },
  validated: { icon: CheckCircle2, bg: 'bg-emerald-100', text: 'text-emerald-700' },
  paid:      { icon: ReceiptText,  bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

// ─── Fetchers ──────────────────────────────────────────────────────────────────

// Regular supplier endpoint — returns { results, pagination } at top level
async function supplierFetcher(url: string) {
  const r = await api.get<{ success: boolean; results: InvoiceListItem[]; pagination: { count: number } }>(url);
  return r.data;
}

// Admin endpoint — returns { data: { results, pagination } }
async function adminFetcher(url: string) {
  const r = await api.get<{ success: boolean; data: { results: AdminInvoiceItem[]; pagination: { count: number } } }>(url);
  return r.data.data;
}

interface AdminInvoiceItem {
  id: string;
  invoice_number: string;
  type_display: string;
  status: string;
  company_name: string;
  customer_name: string;
  issue_date: string;
  currency: string;
  total_amount: string;
  total_vat: string;
  fta_status: string | null;
  has_xml?: boolean;
  asp_submission_id: string | null;
  created_by_name: string;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const { activeId } = useCompany();
  const isAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Admin path: use /admin/invoices/ ──────────────────────────────────────
  const adminParams = new URLSearchParams({ page: String(page) });
  if (statusFilter) adminParams.set('status', statusFilter);

  const { data: adminData, isLoading: adminLoading } = useSWR(
    isAdmin ? `/admin/invoices/?${adminParams}` : null,
    adminFetcher,
  );

  // ── Supplier path: use /invoices/?company_id=... ──────────────────────────
  const supplierParams = new URLSearchParams({
    company_id: activeId ?? '',
    page: String(page),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const { data: supplierData, isLoading: supplierLoading } = useSWR(
    !isAdmin && activeId ? `/invoices/?${supplierParams}` : null,
    supplierFetcher,
  );

  const isLoading  = isAdmin ? adminLoading : supplierLoading;
  const invoices   = isAdmin ? (adminData?.results ?? []) : (supplierData?.results ?? []);
  const totalCount = isAdmin ? (adminData?.pagination?.count ?? 0) : (supplierData?.pagination?.count ?? 0);
  const totalPages = Math.ceil(totalCount / 20);

  const filtered = useMemo(() => {
    if (!searchQuery) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter((inv) =>
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q)
    );
  }, [invoices, searchQuery]);

  const statsSummary = useMemo(() => {
    const draft = invoices.filter((i) => i.status === 'draft').length;
    const pending = invoices.filter((i) => i.status === 'pending').length;
    const validated = invoices.filter((i) => i.status === 'validated').length;
    const paid = invoices.filter((i) => i.status === 'paid').length;
    return { draft, pending, validated, paid };
  }, [invoices]);

  const hasActiveFilters = statusFilter !== '' || searchQuery !== '';

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Invoices</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isAdmin ? 'All Invoices' : 'Your Invoices'}
              </h1>
              <p className="text-sm text-blue-200/60 mt-0.5">
                {totalCount > 0 ? `${totalCount} total` : 'Manage your invoices'}
                {isAdmin ? ' \u2014 across all companies' : ''}
              </p>
            </div>
            {!isAdmin && (
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white px-5 py-2.5 text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" /> New Invoice
              </Link>
            )}
          </div>
        </div>
      </AnimatedSection>

        {/* ── Stats chips ──────────────────────────────────────── */}
        {!isAdmin && statsSummary.draft + statsSummary.pending + statsSummary.validated + statsSummary.paid > 0 && (
          <AnimatedSection delay={100}>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'Draft', count: statsSummary.draft, key: 'draft' },
                { label: 'Pending', count: statsSummary.pending, key: 'pending' },
                { label: 'Validated', count: statsSummary.validated, key: 'validated' },
                { label: 'Paid', count: statsSummary.paid, key: 'paid' },
              ].filter((s) => s.count > 0).map((s, i) => {
                const meta = STATUS_CHIP_META[s.key];
                const Icon = meta.icon;
                return (
                  <div
                    key={s.label}
                    className="group flex items-center gap-2.5 bg-white rounded-xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 pl-3 pr-4 py-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <div className={clsx('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110', meta.bg)}>
                      <Icon className={clsx('h-4 w-4', meta.text)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{s.count}</span>
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimatedSection>
        )}

        {/* ── Filters ──────────────────────────────────────────── */}
        <AnimatedSection delay={150}>
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group/search">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by invoice number or customer..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-9 py-2.5 text-sm
                             placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                             shadow-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 hover:scale-110 transition-all duration-200"
                  >
                    <FilterX className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Mobile: chips */}
              <div className="sm:hidden flex gap-1.5 overflow-x-auto pb-1 -mb-1 [&::-webkit-scrollbar]:hidden">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { setStatusFilter(s.value); setPage(1); }}
                    className={clsx(
                      'shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap',
                      statusFilter === s.value
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300 shadow-sm',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {/* Desktop: custom dropdown */}
              <div className="hidden sm:block relative w-48" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => setStatusOpen((o) => !o)}
                  className={clsx(
                    'w-full flex items-center gap-2 rounded-xl border bg-white pl-9 pr-8 py-2.5 text-sm text-left transition-all duration-200 shadow-sm',
                    statusOpen
                      ? 'border-indigo-400 ring-2 ring-indigo-500/30'
                      : 'border-gray-300 hover:border-gray-400',
                  )}
                >
                  <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none shrink-0" />
                  <span className="flex-1 truncate text-gray-700">
                    {STATUSES.find((s) => s.value === statusFilter)?.label ?? 'All statuses'}
                  </span>
                  <ChevronDown className={clsx('h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200', statusOpen && 'rotate-180')} />
                </button>
                {statusOpen && (
                  <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/50 overflow-hidden">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => { setStatusFilter(s.value); setPage(1); setStatusOpen(false); }}
                        className={clsx(
                          'w-full text-left px-3.5 py-2 text-sm transition-colors duration-150',
                          statusFilter === s.value
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setStatusFilter(''); setSearchQuery(''); setPage(1); }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 shrink-0"
                >
                  <FilterX className="h-4 w-4" /> Clear
                </button>
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* ── Content ──────────────────────────────────────────── */}
        {isLoading ? (
          <AnimatedSection>
            <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 py-24 text-center">
              <div className="relative inline-flex">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <div className="absolute -inset-4 rounded-full bg-indigo-500/10 blur-2xl animate-pulse" />
              </div>
              <p className="mt-5 text-sm font-medium text-gray-400 animate-pulse">Loading invoices...</p>
            </div>
          </AnimatedSection>
        ) : filtered.length === 0 ? (
          <AnimatedSection>
            <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-500/20">
                <ReceiptText className="h-8 w-8 text-white" />
              </div>
              <p className="text-base font-semibold text-gray-900">
                {hasActiveFilters ? 'No matching invoices' : 'No invoices yet'}
              </p>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xs mx-auto">
                {hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : isAdmin
                    ? 'No invoices exist on the platform yet.'
                    : 'Create your first invoice to get started.'}
              </p>
              {!isAdmin && !hasActiveFilters && (
                <Link
                  href="/invoices/new"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" /> Create Invoice
                </Link>
              )}
            </div>
          </AnimatedSection>
        ) : (
          <>
            {/* ── Mobile: Cards ────────────────────────────────── */}
            <div className="sm:hidden space-y-3">
              {filtered.map((inv, idx) => (
                <div
                  key={inv.id}
                  className="group bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                >
                    <div className="flex items-start justify-between mb-3">
                    <Link
                      href={isAdmin ? `/management/invoices/${inv.id}` : `/invoices/${inv.id}`}
                      className="font-semibold text-indigo-600 hover:text-indigo-700 text-sm flex items-center gap-1 transition-colors"
                    >
                      {inv.invoice_number}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Customer</span>
                      <span className="font-medium text-gray-800">{inv.customer_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Type</span>
                      <span className="text-gray-600">{inv.type_display}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Date</span>
                      <span className="text-gray-600">{inv.issue_date}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Company</span>
                        <span className="text-gray-600 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          {(inv as AdminInvoiceItem).company_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-400">Amount</span>
                      <span className="font-bold text-gray-900">
                        {Number(inv.total_amount).toLocaleString('en-AE', {
                          style: 'currency', currency: inv.currency,
                        })}
                      </span>
                    </div>
                    {!isAdmin && (inv as InvoiceListItem).buyer_viewed_at && (
                      <div className="flex items-center justify-between">
                        <span />
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                          <Eye className="w-3 h-3" />
                          Viewed
                        </span>
                      </div>
                    )}
                  </div>
                  {!isAdmin && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                      <button
                        onClick={() => downloadFile(
                          `/invoices/${inv.id}/download-pdf/`,
                          `${inv.invoice_number}.pdf`,
                          'application/pdf',
                          'PDF could not be generated.',
                        )}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </button>
                      {(inv as InvoiceListItem).has_xml && (
                        <button
                          onClick={() => downloadFile(
                            `/invoices/${inv.id}/download-xml/`,
                            `${inv.invoice_number}.xml`,
                            'application/xml',
                            'XML file not available yet.',
                          )}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
                        >
                          <Download className="h-3.5 w-3.5" /> XML
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Desktop: Table ────────────────────────────────── */}
            <div className="hidden sm:block bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                      {isAdmin && (
                        <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                      )}
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        className={clsx(
                          'group transition-all duration-200',
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                          'hover:bg-indigo-50/30',
                        )}
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={isAdmin ? `/management/invoices/${inv.id}` : `/invoices/${inv.id}`}
                            className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            {inv.invoice_number}
                          </Link>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{(inv as AdminInvoiceItem).company_name}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-4 text-gray-700 font-medium group-hover:text-gray-900 transition-colors duration-200">{inv.customer_name}</td>
                        <td className="px-5 py-4 text-gray-500">{inv.type_display}</td>
                        <td className="px-5 py-4 text-gray-500">{inv.issue_date}</td>
                        <td className="px-5 py-4 text-right font-semibold text-gray-900 tabular-nums">
                          {Number(inv.total_amount).toLocaleString('en-AE', {
                            style: 'currency', currency: inv.currency,
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                            {!isAdmin && (inv as InvoiceListItem).buyer_viewed_at && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full w-fit">
                                <Eye className="w-3 w-3" />
                                Viewed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!isAdmin && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => downloadFile(
                                  `/invoices/${inv.id}/download-pdf/`,
                                  `${inv.invoice_number}.pdf`,
                                  'application/pdf',
                                  'PDF could not be generated.',
                                )}
                                title="Download PDF"
                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                              {(inv as InvoiceListItem).has_xml && (
                                <button
                                  onClick={() => downloadFile(
                                    `/invoices/${inv.id}/download-xml/`,
                                    `${inv.invoice_number}.xml`,
                                    'application/xml',
                                    'XML file not available yet.',
                                  )}
                                  title="Download XML"
                                  className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Pagination ──────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 text-xs order-2 sm:order-1">
                  Page {page} of {totalPages}
                  <span className="text-gray-200 mx-1.5">|</span>
                  {totalCount} total invoices
                </span>
                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                      page <= 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50',
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
                            'min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all duration-200',
                            page === pageNum
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                              : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50',
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
                        : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50',
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
  );
}
