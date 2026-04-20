'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Plus, Download, FileText, Building2 } from 'lucide-react';
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
  const [page, setPage] = useState(1);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          {totalCount > 0 && (
            <p className="text-gray-500 text-sm mt-0.5">
              {totalCount} total{isAdmin ? ' — all companies' : ''}
            </p>
          )}
        </div>
        {!isAdmin && (
          <Link href="/invoices/new">
            <Button>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="animate-spin h-6 w-6 rounded-full border-4 border-brand-600 border-t-transparent mx-auto" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="font-medium">No invoices found</p>
            <p className="text-sm mt-1">
              {isAdmin ? 'No invoices exist on the platform yet.' : 'Create your first invoice to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                {isAdmin && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      href={isAdmin ? `/management/invoices/${inv.id}` : `/invoices/${inv.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {(inv as AdminInvoiceItem).company_name}
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-gray-700">{inv.customer_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{inv.type_display}</td>
                  <td className="px-5 py-3.5 text-gray-500">{inv.issue_date}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                    {Number(inv.total_amount).toLocaleString('en-AE', {
                      style: 'currency', currency: inv.currency,
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!isAdmin && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadFile(
                            `/invoices/${inv.id}/download-pdf/`,
                            `${inv.invoice_number}.pdf`,
                            'application/pdf',
                            'PDF could not be generated.',
                          )}
                          title="Download PDF"
                          className="text-gray-400 hover:text-red-600"
                        >
                          <FileText className="h-4 w-4 inline" />
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
                            className="text-gray-400 hover:text-gray-700"
                          >
                            <Download className="h-4 w-4 inline" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
