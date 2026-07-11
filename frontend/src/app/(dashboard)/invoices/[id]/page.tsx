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
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import { useCompany } from '@/hooks/useCompany';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
import {   Download, Send, XCircle, ArrowLeft, RefreshCw, Ban, FileMinus, Wallet, Building2, User, Calendar, Receipt, Activity, Clock, FileText } from 'lucide-react';
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

const sectionCard = 'bg-white rounded-xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-300/50 transition-all duration-300';

function LineItemsTable({ invoice }: { invoice: Invoice }) {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800">Line Items</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">VAT</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">VAT Amt</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-gray-50">
                <td className="px-6 py-3.5 text-gray-800 font-medium">{item.description}</td>
                <td className="px-6 py-3.5 text-right text-gray-600">{item.quantity}</td>
                <td className="px-6 py-3.5 text-gray-500">{item.unit || '—'}</td>
                <td className="px-6 py-3.5 text-right font-medium text-gray-700">{Number(item.unit_price).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-3.5">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{item.vat_rate_type_display}</span>
                </td>
                <td className="px-6 py-3.5 text-right text-gray-600">{Number(item.vat_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-3.5 text-right font-bold text-gray-900">{Number(item.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Subtotal</td>
              <td className="px-6 py-3 text-right font-semibold text-gray-800">{Number(invoice.subtotal).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
            </tr>
            {parseFloat(invoice.discount_amount) > 0 && (
              <tr className="bg-red-50">
                <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">Discount</td>
                <td className="px-6 py-3 text-right text-red-600 font-semibold">
                  −{Number(invoice.discount_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
            <tr className="bg-gray-50">
              <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-600">VAT (5%)</td>
              <td className="px-6 py-3 text-right font-semibold text-gray-800">{Number(invoice.total_vat).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr className="bg-gradient-to-r from-blue-950 to-indigo-950">
              <td colSpan={6} className="px-6 py-4 text-right font-bold text-blue-300 text-base">
                Total ({invoice.currency})
              </td>
              <td className="px-6 py-4 text-right font-bold text-white text-base">
                {Number(invoice.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function StatChip({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 px-4 py-3 shadow-md shadow-gray-200/50 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { activeCompany } = useCompany();
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showSendApproval, setShowSendApproval] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
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

  function handleSendForApproval() {
    setActionError('');
    setShowSendApproval(true);
  }

  async function confirmSendForApproval() {
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/send-for-approval/`);
      setShowSendApproval(false);
      await mutateAll();
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setActionError(err.response?.data?.error?.message ?? 'Could not send for approval.');
    } finally { setIsActing(false); }
  }

  function handleCancel() {
    setActionError('');
    setShowCancel(true);
  }

  async function confirmCancel() {
    setIsActing(true); setActionError('');
    try {
      await api.post(`/invoices/${params.id}/cancel/`);
      setShowCancel(false);
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
        <div className="animate-spin h-10 w-10 rounded-full border-[3px] border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) return <p className="text-gray-500">Invoice not found.</p>;

  const isPolling = POLLING_STATUSES.has(invoice.status);

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
    <div className="space-y-8">

      {/* ── Page header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-blue-300 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to invoices
            </button>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{invoice.invoice_number}</h1>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-200/80 flex-wrap">
                  <span className="text-blue-200/70">{invoice.type_display}</span>
                  <span className="text-blue-200/40">|</span>
                  <span className="text-blue-200/70">{invoice.transaction_type.toUpperCase()}</span>
                  {Number(invoice.balance_due ?? 0) > 0 && (
                    <>
                      <span className="text-blue-200/40">|</span>
                      <span className="text-blue-200/70">Balance: <span className="font-semibold text-white">{invoice.currency} {Number(invoice.balance_due).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span></span>
                    </>
                  )}
                  {invoice.is_overdue && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-200 bg-red-500/20 border border-red-400/30">
                      OVERDUE {invoice.days_overdue}d
                    </span>
                  )}
                  {isPolling && (
                    <span className="flex items-center gap-1.5 text-blue-200/80 animate-pulse">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Auto-refreshing…
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                <PDFDownloadButton invoice={invoice} company={activeCompany} />
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
                  <Button size="sm" variant="secondary" onClick={handleSendForApproval} loading={isActing}>
                    <Send className="h-4 w-4" /> Send for Buyer Approval
                  </Button>
                )}
                {invoice.is_submittable && (
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500" onClick={handleSubmit} loading={isActing}>
                    <Send className="h-4 w-4" /> Submit
                  </Button>
                )}
                {invoice.status === 'awaiting_approval' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                    <Send className="h-3.5 w-3.5" /> Awaiting buyer approval
                  </span>
                )}
                {['submitted', 'validated', 'partially_paid', 'pending'].includes(invoice.status)
                  && Number(invoice.balance_due ?? 0) > 0 && (
                  <Button size="sm" onClick={() => { setActionError(''); setShowPayment(true); }}>
                    <Wallet className="h-4 w-4" /> Record Payment
                  </Button>
                )}
                {invoice.invoice_type !== 'credit_note' &&
                  ['submitted', 'validated', 'paid', 'partially_paid'].includes(invoice.status) && (
                  <Button variant="secondary" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={handleCreditNote} loading={isActing}>
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
          </div>
        </div>
      </AnimatedSection>

      {/* ── Stat chips row ── */}
      <AnimatedSection delay={80}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <StatChip label="Subtotal" value={`${invoice.currency} ${Number(invoice.subtotal).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`} icon={<Receipt className="h-5 w-5 text-white" />} color="bg-gradient-to-br from-blue-600 to-blue-700" />
          <StatChip label="VAT (5%)" value={`${invoice.currency} ${Number(invoice.total_vat).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`} icon={<Activity className="h-5 w-5 text-white" />} color="bg-gradient-to-br from-blue-500 to-indigo-600" />
          <StatChip label="Total Due" value={`${invoice.currency} ${Number(invoice.total_amount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`} icon={<Wallet className="h-5 w-5 text-white" />} color="bg-gradient-to-br from-blue-950 to-indigo-950" />
          <StatChip label={invoice.is_overdue ? 'Overdue' : 'Status'} value={invoice.is_overdue ? `${invoice.days_overdue} days` : invoice.status_display || invoice.status} icon={<Clock className="h-5 w-5 text-white" />} color={invoice.is_overdue ? 'bg-gradient-to-br from-red-600 to-red-700' : 'bg-gradient-to-br from-blue-700 to-blue-800'} />
        </div>
      </AnimatedSection>

      {/* ── Deactivated banner ── */}
      {invoice.status === 'deactivated' && (
        <AnimatedSection delay={100}>
          <div className="rounded-xl bg-amber-50 border-2 border-amber-200 px-6 py-4 text-sm text-amber-800 shadow-lg shadow-amber-100/30">
            <p className="font-semibold flex items-center gap-1.5"><Ban className="h-4 w-4" /> This invoice has been deactivated.</p>
            {invoice.deactivation_reason && (
              <p className="mt-1"><span className="font-medium">Reason:</span> {invoice.deactivation_reason}</p>
            )}
          </div>
        </AnimatedSection>
      )}

      {/* ── Submitting overlay ── */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm w-full mx-4 text-center animate-scale-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <RefreshCw className="h-7 w-7 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Submitting your invoice…</h3>
            <p className="text-sm text-gray-500 mt-1.5">
              Securely transmitting and validating your invoice. This usually takes a few moments —
              please don&apos;t close this window.
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate modal ── */}
      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowDeactivate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
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

      {/* ── Send for Approval modal ── */}
      {showSendApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowSendApproval(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" /> Send for buyer approval
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              This invoice will be sent to the buyer for review &amp; e-signature before ASP submission.
            </p>
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <p className="font-medium">What happens next?</p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside text-blue-700">
                <li>The buyer receives an email notification</li>
                <li>They review the invoice and e-sign to approve</li>
                <li>Once approved, the invoice is submitted to ASP</li>
              </ul>
            </div>
            {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowSendApproval(false)} disabled={isActing}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmSendForApproval} loading={isActing}>
                <Send className="h-4 w-4" /> Send for Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel invoice modal ── */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" /> Cancel invoice
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to cancel this invoice? This action cannot be undone.
            </p>
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Warning</p>
              <p className="mt-1 text-red-700">
                Cancelling will permanently void this invoice. The buyer will be notified and the invoice status will change to cancelled.
              </p>
            </div>
            {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCancel(false)} disabled={isActing}>
                Go back
              </Button>
              <Button variant="danger" size="sm" onClick={confirmCancel} loading={isActing}>
                <XCircle className="h-4 w-4" /> Cancel Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" /> Record payment
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Balance due: <span className="font-semibold text-gray-900">{invoice.currency} {Number(invoice.balance_due ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Amount</label>
                <input type="number" step="0.01" min="0" value={payAmount} autoFocus
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
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
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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

      {/* ── Error banner ── */}
      {actionError && !showPayment && !showDeactivate && !showSendApproval && !showCancel && (
        <AnimatedSection delay={100}>
          <div className="rounded-xl bg-red-50 border-2 border-red-200 px-6 py-3.5 text-sm text-red-700 shadow-lg shadow-red-100/20">
            {actionError}
          </div>
        </AnimatedSection>
      )}

      {/* ── Flow tracker ── */}
      {timeline?.flow && (
        <AnimatedSection delay={120}>
          <FlowTracker flow={timeline.flow} />
        </AnimatedSection>
      )}

      {/* ── Main 3-col: Supplier | Buyer | Notes (equal height) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier */}
        <AnimatedSection delay={150} direction="up">
          <div className={`${sectionCard} p-6 h-full`}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Supplier</h2>
              </div>
              <div className="flex items-start gap-4 flex-1">
                {co?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={co.logo_url} alt={`${invoice.company_name} logo`}
                    className="w-14 h-14 rounded-xl object-contain border-2 border-gray-200 bg-white shrink-0 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-700 to-blue-800 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-blue-200/50">
                    {(invoice.company_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-gray-900">{invoice.company_name}</p>
                  {co?.legal_name && co.legal_name !== invoice.company_name && (
                    <p className="text-xs text-gray-500">{co.legal_name}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">TRN</span>
                    <span className="text-xs font-mono font-semibold text-gray-700">{invoice.company_trn}</span>
                  </div>
                  {(invoice.company_trn_issue_date || invoice.company_trn_expiry_date) && (
                    <p className="text-[10px] text-gray-400">
                      {invoice.company_trn_issue_date && <>Issued: {invoice.company_trn_issue_date}</>}
                      {invoice.company_trn_expiry_date && <> · Expires: {invoice.company_trn_expiry_date}</>}
                    </p>
                  )}
                  {supplierAddr && <p className="text-xs text-gray-500 leading-relaxed">{supplierAddr}</p>}
                  {co?.phone && <p className="text-xs text-gray-500">{co.phone}</p>}
                  {co?.email && <p className="text-xs text-gray-500">{co.email}</p>}
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Buyer */}
        <AnimatedSection delay={250} direction="up">
          <div className={`${sectionCard} p-6 h-full`}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Buyer</h2>
              </div>
              <div className="flex items-start gap-4 flex-1">
                {invoice.customer_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invoice.customer_logo.startsWith('/') ? `${BACKEND_URL}${invoice.customer_logo}` : invoice.customer_logo} alt={`${invoice.customer_name} logo`}
                    className="w-14 h-14 rounded-xl object-contain border-2 border-gray-200 bg-white shrink-0 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-indigo-200/50">
                    {(invoice.customer_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-gray-900">{invoice.customer_name}</p>
                  {invoice.customer_trn && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">TRN</span>
                      <span className="text-xs font-mono font-semibold text-gray-700">{invoice.customer_trn}</span>
                    </div>
                  )}
                  {(invoice.customer_trn_issue_date || invoice.customer_trn_expiry_date) && (
                    <p className="text-[10px] text-gray-400">
                      {invoice.customer_trn_issue_date && <>Issued: {invoice.customer_trn_issue_date}</>}
                      {invoice.customer_trn_expiry_date && <> · Expires: {invoice.customer_trn_expiry_date}</>}
                    </p>
                  )}
                  {buyerAddr && <p className="text-xs text-gray-500 leading-relaxed">{buyerAddr}</p>}
                  {invoice.customer_phone && <p className="text-xs text-gray-500">{invoice.customer_phone}</p>}
                  {invoice.customer_email && <p className="text-xs text-gray-500">{invoice.customer_email}</p>}
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Notes */}
        <AnimatedSection delay={350} direction="up">
          <div className={`${sectionCard} p-6 h-full`}>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-sm shadow-amber-200/30">
                  <FileText className="h-[18px] w-[18px] text-white" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Notes</h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">Additional information</p>
                </div>
              </div>
              <div className="flex-1">
                {invoice.notes ? (
                  <div className="bg-amber-50/40 rounded-xl p-5 h-full border border-amber-100/40">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-7">{invoice.notes}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                    <FileText className="h-8 w-8 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-400">No notes</p>
                    <p className="text-[11px] text-gray-300 mt-1">Additional details will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>

      {/* ── Secondary row: Dates + ASP/FTA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnimatedSection delay={200} direction="up">
            <div className={`${sectionCard} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Invoice Dates</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Issue Date</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.issue_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Due Date</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.due_date ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Supply Date</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.supply_date ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Currency</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.currency}</p>
                </div>
              </div>
              {invoice.invoice_type === 'continuous_supply' && (invoice.supply_date_end || invoice.contract_reference) && (
                <div className="border-t border-gray-200 pt-4 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Period End</p>
                    <p className="text-sm font-semibold text-gray-900">{invoice.supply_date_end ?? '—'}</p>
                  </div>
                  {invoice.contract_reference && (
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Contract Reference</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.contract_reference}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AnimatedSection>
        </div>

        <div className="space-y-6">
          {(invoice.asp_submission_id || invoice.asp_submitted_at) && (
            <AnimatedSection delay={350} direction="up">
              <div className={`${sectionCard} p-6`}>
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  ASP Submission (Corner 2)
                </h2>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Submission ID</p>
                    <p className="text-xs font-mono font-semibold text-gray-700 break-all">{invoice.asp_submission_id}</p>
                  </div>
                  {invoice.asp_submitted_at && (
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Submitted At</p>
                      <p className="text-xs text-gray-600">{new Date(invoice.asp_submitted_at).toLocaleString('en-AE')}</p>
                    </div>
                  )}
                </div>
              </div>
            </AnimatedSection>
          )}

          {timeline?.events?.find((e) => e.type === 'fta_reported') && (() => {
            const ftaEvent = timeline.events.find((e) => e.type === 'fta_reported');
            const ftaRef = ftaEvent?.data?.fta_reference as string | undefined;
            return ftaRef ? (
              <AnimatedSection delay={450} direction="up">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-lg shadow-gray-200/50 transition-all duration-300">
                  <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    FTA Reporting (Corner 5)
                  </h2>
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">FTA Reference</p>
                      <p className="text-xs font-mono font-semibold text-gray-700 break-all">{ftaRef}</p>
                    </div>
                    {ftaEvent?.timestamp && (
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Reported At</p>
                        <p className="text-xs text-gray-600">{new Date(ftaEvent.timestamp).toLocaleString('en-AE')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </AnimatedSection>
            ) : null;
          })()}
        </div>
      </div>

      {/* ── Line Items (full width below the 3-col layout) ── */}
      <AnimatedSection delay={300} direction="up">
        <LineItemsTable invoice={invoice} />
      </AnimatedSection>

      {/* ── Activity Log ── */}
      {timeline && (
        <AnimatedSection delay={500} direction="up">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-lg shadow-gray-200/50">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Activity Log</h2>
                <p className="text-[10px] text-gray-500">Event history and status changes</p>
              </div>
            </div>
            <InvoiceTimeline events={timeline.events} />
          </div>
        </AnimatedSection>
      )}
    </div>
  );
}
