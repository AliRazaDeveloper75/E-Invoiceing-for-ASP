'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { FlowTracker } from '@/components/invoice/FlowTracker';
import { InvoiceTimeline } from '@/components/invoice/InvoiceTimeline';
import { PDFDownloadButton } from '@/components/invoice/PDFDownloadButton';
import { useCompany } from '@/hooks/useCompany';
import { Download, Send, XCircle, ArrowLeft, RefreshCw, Ban, FileMinus, Wallet } from 'lucide-react';
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

function invoiceFetcher(url: string) {
  return api.get<{ success: boolean; data: Invoice }>(url).then((r) => r.data.data);
}

function timelineFetcher(url: string) {
  return api
    .get<{ success: boolean; data: InvoiceTimelineType }>(url)
    .then((r) => r.data.data);
}

const POLLING_STATUSES = new Set(['pending', 'submitted']);

function refreshInterval(invoice: Invoice | undefined): number {
  if (!invoice) return 0;
  return POLLING_STATUSES.has(invoice.status) ? 5000 : 0;
}

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

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { activeCompany } = useCompany();
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');

  async function handleRecordPayment() {
    if (!payAmount || Number(payAmount) <= 0) { setActionError('Enter a valid payment amount.'); return; }
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/payments/`, {
        amount: payAmount, method: payMethod, payment_date: payDate, reference: payRef,
      });
      setShowPayment(false);
      setPayAmount(''); setPayRef('');
      await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Failed to record payment.');
    } finally { setIsActing(false); }
  }

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
    setIsActing(true); setActionError(''); setSubmitting(true);
    try {
      await api.post(`/invoices/${params.id}/submit/`);
    } catch (e) {
      // The submission is processed asynchronously on the server. A slow gateway
      // can time out the POST even though the backend already accepted it, so we
      // re-check the real status before showing a failure to the user.
      const fresh = await api
        .get<{ data: Invoice }>(`/invoices/${params.id}/`)
        .then((r) => r.data.data)
        .catch(() => null);
      if (!fresh || fresh.status === 'draft') {
        const err = e as AxiosError<{ error?: { message?: string } }>;
        setActionError(err.response?.data?.error?.message ?? 'Submission failed. Please try again.');
      }
    } finally {
      await mutateAll();
      setIsActing(false);
      setSubmitting(false);
    }
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

  async function handleCreditNote() {
    if (!confirm('Issue a credit note for this invoice? A draft credit note will be created that you can review and submit.')) return;
    setIsActing(true); setActionError('');
    try {
      const res = await api.post<{ data: { id: string } }>(`/invoices/${params.id}/credit-note/`);
      const newId = res.data?.data?.id;
      if (newId) router.push(`/invoices/${newId}`);
      else await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Could not create credit note.');
    } finally { setIsActing(false); }
  }

  async function handleDeactivate() {
    if (!deactivateReason.trim()) {
      setActionError('Please provide a reason for deactivation.');
      return;
    }
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/deactivate/`, { reason: deactivateReason.trim() });
      setShowDeactivate(false);
      setDeactivateReason('');
      await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Deactivation failed.');
    } finally { setIsActing(false); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) return <p className="text-gray-500">Invoice not found.</p>;

  const isPolling = POLLING_STATUSES.has(invoice.status);

  // Supplier details: use the active company only when it is the invoice's
  // company (matched by TRN), so we never show the wrong address/logo.
  const co = activeCompany?.trn === invoice.company_trn ? activeCompany : null;
  const supplierAddr = co
    ? [co.street_address,
       [co.city, co.emirate].filter(Boolean).join(', '),
       co.po_box ? `P.O. Box ${co.po_box}` : '',
       co.country || 'United Arab Emirates'].filter(Boolean).join(', ')
    : '';
  const buyerAddr = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_country,
  ].filter(Boolean).join(', ');

  return (
    <div className="max-w-4xl space-y-6">

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
            {Number(invoice.balance_due ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>Balance: <span className="font-semibold text-gray-700">{invoice.currency} {Number(invoice.balance_due).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span></span>
              </>
            )}
            {invoice.is_overdue && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200">
                OVERDUE {invoice.days_overdue}d
              </span>
            )}
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

        <div className="flex gap-2 flex-wrap justify-end">
          <PDFDownloadButton invoice={invoice} company={activeCompany} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadFile(
              `/invoices/${invoice.id}/download-xml/`,
              `${invoice.invoice_number}.xml`,
              'application/xml',
              'XML could not be generated for this invoice.',
            )}
          >
            <Download className="h-4 w-4" /> XML
          </Button>
          {invoice.is_submittable && (
            <Button size="sm" onClick={handleSubmit} loading={isActing}>
              <Send className="h-4 w-4" /> Submit
            </Button>
          )}
          {['submitted', 'validated', 'partially_paid', 'pending'].includes(invoice.status)
            && Number(invoice.balance_due ?? 0) > 0 && (
            <Button size="sm" onClick={() => { setActionError(''); setShowPayment(true); }}>
              <Wallet className="h-4 w-4" /> Record Payment
            </Button>
          )}
          {invoice.invoice_type !== 'credit_note' &&
            ['submitted', 'validated', 'paid', 'partially_paid'].includes(invoice.status) && (
            <Button variant="secondary" size="sm" onClick={handleCreditNote} loading={isActing}>
              <FileMinus className="h-4 w-4" /> Issue Credit Note
            </Button>
          )}
          {invoice.is_cancellable && (
            <Button variant="danger" size="sm" onClick={handleCancel} loading={isActing}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
          {invoice.is_deactivatable && !invoice.is_cancellable && (
            <Button variant="danger" size="sm" onClick={() => { setActionError(''); setShowDeactivate(true); }}>
              <Ban className="h-4 w-4" /> Deactivate
            </Button>
          )}
        </div>
      </div>

      {invoice.status === 'deactivated' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold flex items-center gap-1.5"><Ban className="h-4 w-4" /> This invoice has been deactivated.</p>
          {invoice.deactivation_reason && (
            <p className="mt-1"><span className="font-medium">Reason:</span> {invoice.deactivation_reason}</p>
          )}
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm w-full mx-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <RefreshCw className="h-7 w-7 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Submitting your invoice…</h3>
            <p className="text-sm text-gray-500 mt-1.5">
              Securely transmitting and validating your invoice. This usually takes a few moments —
              please don’t close this window.
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDeactivate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" /> Deactivate invoice
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Provide a reason. The buyer will see the deactivated status and this reason.
            </p>
            <textarea
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Reason for deactivating this invoice…"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDeactivate(false)} disabled={isActing}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeactivate} loading={isActing}>
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-600" /> Record payment
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Balance due: <span className="font-semibold text-gray-900">{invoice.currency} {Number(invoice.balance_due ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Amount</label>
                <input type="number" step="0.01" min="0" value={payAmount} autoFocus
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Reference (optional)</label>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Txn / cheque no."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowPayment(false)} disabled={isActing}>Cancel</Button>
              <Button size="sm" onClick={handleRecordPayment} loading={isActing}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}

      {actionError && !showPayment && !showDeactivate && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {timeline?.flow && <FlowTracker flow={timeline.flow} />}

      <div className="grid grid-cols-2 gap-4">
        {/* Supplier — logo + full company details (from the active company, matched by TRN) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Supplier</h2>
          <div className="flex items-start gap-3">
            {co?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={co.logo_url} alt={`${invoice.company_name} logo`}
                className="w-12 h-12 rounded-lg object-contain border border-gray-200 bg-white shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {(invoice.company_name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-gray-900">{invoice.company_name}</p>
              {co?.legal_name && co.legal_name !== invoice.company_name && (
                <p className="text-xs text-gray-500">{co.legal_name}</p>
              )}
              <p className="text-sm text-gray-500">TRN: <span className="font-mono">{invoice.company_trn}</span></p>
              {(invoice.company_trn_issue_date || invoice.company_trn_expiry_date) && (
                <p className="text-xs text-gray-400">
                  {invoice.company_trn_issue_date && <>TRN issued: {invoice.company_trn_issue_date}</>}
                  {invoice.company_trn_expiry_date && <> · expires: {invoice.company_trn_expiry_date}</>}
                </p>
              )}
              {supplierAddr && <p className="text-xs text-gray-500 leading-relaxed">{supplierAddr}</p>}
              {co?.phone && <p className="text-xs text-gray-500">{co.phone}</p>}
              {co?.email && <p className="text-xs text-gray-500">{co.email}</p>}
            </div>
          </div>
        </div>

        {/* Buyer */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Buyer</h2>
          <div className="flex items-start gap-3">
            {invoice.customer_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invoice.customer_logo} alt={`${invoice.customer_name} logo`}
                className="w-12 h-12 rounded-lg object-contain border border-gray-200 bg-white shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {(invoice.customer_name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-gray-900">{invoice.customer_name}</p>
              {invoice.customer_trn && (
                <p className="text-sm text-gray-500">TRN: <span className="font-mono">{invoice.customer_trn}</span></p>
              )}
              {(invoice.customer_trn_issue_date || invoice.customer_trn_expiry_date) && (
                <p className="text-xs text-gray-400">
                  {invoice.customer_trn_issue_date && <>TRN issued: {invoice.customer_trn_issue_date}</>}
                  {invoice.customer_trn_expiry_date && <> · expires: {invoice.customer_trn_expiry_date}</>}
                </p>
              )}
              {buyerAddr && <p className="text-xs text-gray-500 leading-relaxed">{buyerAddr}</p>}
              {invoice.customer_phone && <p className="text-xs text-gray-500">{invoice.customer_phone}</p>}
              {invoice.customer_email && <p className="text-xs text-gray-500">{invoice.customer_email}</p>}
            </div>
          </div>
        </div>
      </div>

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

      <LineItemsTable invoice={invoice} />

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

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {timeline && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Activity Log</h2>
          <InvoiceTimeline events={timeline.events} />
        </div>
      )}
    </div>
  );
}
