'use client';

export function generateStaticParams() { return []; }

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { FlowTracker } from '@/components/invoice/FlowTracker';
import { InvoiceTimeline } from '@/components/invoice/InvoiceTimeline';
import { Download, FileText, Send, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { AxiosError } from 'axios';
import type { Invoice, InvoiceTimeline as InvoiceTimelineType } from '@/types';

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

// ─── Fetchers ─────────────────────────────────────────────────────────────────

function invoiceFetcher(url: string) {
  return api.get<{ success: boolean; data: Invoice }>(url).then((r) => r.data.data);
}

function timelineFetcher(url: string) {
  return api
    .get<{ success: boolean; data: InvoiceTimelineType }>(url)
    .then((r) => r.data.data);
}

// ─── Auto-refresh interval for transitional statuses ─────────────────────────

const POLLING_STATUSES = new Set(['pending', 'submitted']);

function refreshInterval(invoice: Invoice | undefined): number {
  if (!invoice) return 0;
  return POLLING_STATUSES.has(invoice.status) ? 5000 : 0;
}

// ─── Line Items Table ─────────────────────────────────────────────────────────

function LineItemsTable({ invoice }: { invoice: Invoice }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Description</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Unit</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">VAT</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">VAT Amt</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-3 text-gray-800">{item.description}</td>
              <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
              <td className="px-5 py-3 text-gray-500">{item.unit || '—'}</td>
              <td className="px-5 py-3 text-right">{Number(item.unit_price).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
              <td className="px-5 py-3 text-gray-500">{item.vat_rate_type_display}</td>
              <td className="px-5 py-3 text-right text-gray-600">{Number(item.vat_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
              <td className="px-5 py-3 text-right font-semibold">{Number(item.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50">
            <td colSpan={6} className="px-5 py-3 text-right text-sm font-medium text-gray-600">Subtotal</td>
            <td className="px-5 py-3 text-right font-semibold">{Number(invoice.subtotal).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
          </tr>
          {parseFloat(invoice.discount_amount) > 0 && (
            <tr className="bg-gray-50">
              <td colSpan={6} className="px-5 py-3 text-right text-sm font-medium text-gray-600">Discount</td>
              <td className="px-5 py-3 text-right text-red-600 font-semibold">
                −{Number(invoice.discount_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          )}
          <tr className="bg-gray-50">
            <td colSpan={6} className="px-5 py-3 text-right text-sm font-medium text-gray-600">VAT (5%)</td>
            <td className="px-5 py-3 text-right font-semibold">{Number(invoice.total_vat).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr className="bg-gray-100 text-base">
            <td colSpan={6} className="px-5 py-3 text-right font-bold text-gray-900">
              Total ({invoice.currency})
            </td>
            <td className="px-5 py-3 text-right font-bold text-gray-900">
              {Number(invoice.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);

  const {
    data: invoice,
    isLoading,
    mutate: mutateInvoice,
  } = useSWR<Invoice>(
    `/invoices/${params.id}/`,
    invoiceFetcher,
    { refreshInterval: (data) => refreshInterval(data) },
  );

  const {
    data: timeline,
    mutate: mutateTimeline,
  } = useSWR<InvoiceTimelineType>(
    invoice ? `/integrations/invoices/${params.id}/timeline/` : null,
    timelineFetcher,
    { refreshInterval: invoice ? refreshInterval(invoice) : 0 },
  );

  async function mutateAll() {
    await Promise.all([mutateInvoice(), mutateTimeline()]);
  }

  async function handleSubmit() {
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/submit/`);
      await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Submission failed.');
    } finally { setIsActing(false); }
  }

  async function handleCancel() {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/cancel/`);
      await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Cancellation failed.');
    } finally { setIsActing(false); }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) return <p className="text-gray-500">Invoice not found.</p>;

  const isPolling = POLLING_STATUSES.has(invoice.status);

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
            <span>{invoice.type_display}</span>
            <span>·</span>
            <span>{invoice.transaction_type.toUpperCase()}</span>
            {isPolling && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-brand-600 animate-pulse">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Auto-refreshing…
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadFile(
              `/invoices/${invoice.id}/download-pdf/`,
              `${invoice.invoice_number}.pdf`,
              'application/pdf',
              'PDF could not be generated.',
            )}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
          {invoice.xml_file && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadFile(
                `/invoices/${invoice.id}/download-xml/`,
                `${invoice.invoice_number}.xml`,
                'application/xml',
                'XML file not available yet.',
              )}
            >
              <Download className="h-4 w-4" /> XML
            </Button>
          )}
          {invoice.is_submittable && (
            <Button size="sm" onClick={handleSubmit} loading={isActing}>
              <Send className="h-4 w-4" /> Submit to ASP
            </Button>
          )}
          {invoice.is_cancellable && (
            <Button variant="danger" size="sm" onClick={handleCancel} loading={isActing}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* ── 5-Corner Flow Tracker ───────────────────────────────────────────── */}
      {timeline?.flow && <FlowTracker flow={timeline.flow} />}

      {/* ── Supplier / Buyer cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-1.5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supplier (Corner 1)</h2>
          <p className="font-semibold text-gray-900">{invoice.company_name}</p>
          <p className="text-sm text-gray-500">TRN: <span className="font-mono">{invoice.company_trn}</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-1.5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Buyer (Corner 4)</h2>
          <p className="font-semibold text-gray-900">{invoice.customer_name}</p>
          {invoice.customer_trn && (
            <p className="text-sm text-gray-500">TRN: <span className="font-mono">{invoice.customer_trn}</span></p>
          )}
        </div>
      </div>

      {/* ── Dates ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Issue Date</p>
            <p className="mt-1 font-medium text-gray-800">{invoice.issue_date}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</p>
            <p className="mt-1 font-medium text-gray-800">{invoice.due_date ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Supply Date</p>
            <p className="mt-1 font-medium text-gray-800">{invoice.supply_date ?? '—'}</p>
          </div>
        </div>
        {/* Continuous supply: show period + contract ref */}
        {invoice.invoice_type === 'continuous_supply' && (invoice.supply_date_end || invoice.contract_reference) && (
          <div className="border-t border-gray-100 pt-4 grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Period End Date</p>
              <p className="mt-1 font-medium text-gray-800">{invoice.supply_date_end ?? '—'}</p>
            </div>
            {invoice.contract_reference && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Contract Reference</p>
                <p className="mt-1 font-medium text-gray-800">{invoice.contract_reference}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Line Items ──────────────────────────────────────────────────────── */}
      <LineItemsTable invoice={invoice} />

      {/* ── ASP + FTA Summary ───────────────────────────────────────────────── */}
      {(invoice.asp_submission_id || invoice.asp_submitted_at) && (
        <div className="grid grid-cols-2 gap-4">
          {invoice.asp_submission_id && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-sm space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                ASP Submission (Corner 2)
              </h2>
              <p>
                <span className="text-gray-500 text-xs">Submission ID</span>
                <br />
                <span className="font-mono text-xs break-all">{invoice.asp_submission_id}</span>
              </p>
              {invoice.asp_submitted_at && (
                <p className="text-xs text-gray-500">
                  {new Date(invoice.asp_submitted_at).toLocaleString('en-AE')}
                </p>
              )}
            </div>
          )}

          {/* FTA reference if available — inferred from timeline */}
          {timeline?.events?.find((e) => e.type === 'fta_reported') && (() => {
            const ftaEvent = timeline.events.find((e) => e.type === 'fta_reported');
            const ftaRef = ftaEvent?.data?.fta_reference as string | undefined;
            return ftaRef ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm text-sm space-y-2">
                <h2 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                  FTA Reporting (Corner 5)
                </h2>
                <p>
                  <span className="text-gray-500 text-xs">FTA Reference</span>
                  <br />
                  <span className="font-mono text-xs break-all">{ftaRef}</span>
                </p>
                {ftaEvent?.timestamp && (
                  <p className="text-xs text-gray-500">
                    {new Date(ftaEvent.timestamp).toLocaleString('en-AE')}
                  </p>
                )}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* ── Notes ───────────────────────────────────────────────────────────── */}
      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* ── Event Timeline ───────────────────────────────────────────────────── */}
      {timeline && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Activity Log</h2>
          <InvoiceTimeline events={timeline.events} />
        </div>
      )}
    </div>
  );
}
