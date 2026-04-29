'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  ArrowLeft, Download, FileText, CreditCard, CheckCircle2,
  Loader2, X, AlertCircle, Calendar, Receipt, Building2,
  ChevronLeft,
} from 'lucide-react';
import type { Invoice, Payment, PaymentSummary, PaymentMethod, PaymentConfig } from '@/types';

type InvoiceWithPayment = Invoice & { amount_paid: string; amount_due: string };

async function fetchInvoice(url: string) {
  const r = await api.get<{ data: InvoiceWithPayment }>(url);
  return r.data.data;
}

async function fetchPayments(url: string) {
  const r = await api.get<{ data: PaymentSummary }>(url);
  return r.data.data;
}

async function fetchPaymentConfig(url: string) {
  const r = await api.get<{ data: PaymentConfig }>(url);
  return r.data.data;
}

const STATUS_STYLES: Record<string, string> = {
  draft:          'bg-gray-100 text-gray-600',
  pending:        'bg-yellow-100 text-yellow-700',
  submitted:      'bg-blue-100 text-blue-700',
  validated:      'bg-emerald-100 text-emerald-700',
  rejected:       'bg-red-100 text-red-700',
  cancelled:      'bg-gray-100 text-gray-500',
  paid:           'bg-emerald-100 text-emerald-700',
  partially_paid: 'bg-orange-100 text-orange-700',
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  cheque:        'Cheque',
  card:          'Card (Stripe)',
  online:        'PayPal',
  other:         'Other',
};

// ── Method Selector ───────────────────────────────────────────────────────────

type PaymentFlow = 'select' | 'stripe' | 'paypal' | 'manual';

function MethodCard({
  icon, title, subtitle, onClick, badge, comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  badge?: string;
  comingSoon?: boolean;
}) {
  if (comingSoon) {
    return (
      <div className="w-full flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50 opacity-60 cursor-not-allowed select-none">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-500 text-sm">{title}</p>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
              Coming Soon
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl
                 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-left group"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          {badge && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-blue-400 rotate-180 shrink-0" />
    </button>
  );
}

// ── Stripe Step ────────────────────────────────────────────────────────────────

function StripeStep({ invoiceId, amountDue, currency, onBack }: {
  invoiceId: string;
  amountDue: number;
  currency: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    setLoading(true);
    setError('');
    try {
      const r = await api.post<{ data: { url: string } }>(
        `/buyer/invoices/${invoiceId}/create-stripe-session/`, {}
      );
      window.location.href = r.data.data.url;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not initiate payment. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-5 space-y-5">
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 rounded-xl p-5 text-center">
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
          <CreditCard className="w-6 h-6 text-blue-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Secure Card Payment via Stripe</p>
        <p className="text-xs text-slate-500 mt-1">
          You will be redirected to Stripe&apos;s secure checkout page.
        </p>
        <p className="text-2xl font-bold text-slate-800 mt-4">
          {currency} {amountDue.toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {loading ? 'Redirecting…' : 'Pay with Card'}
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        🔒 Powered by Stripe — your card details are never stored on our servers.
      </p>
    </div>
  );
}

// ── PayPal Step ────────────────────────────────────────────────────────────────

function PayPalStep({ invoiceId, amountDue, currency, clientId, sandbox, onBack, onSuccess }: {
  invoiceId: string;
  amountDue: number;
  currency: string;
  clientId: string;
  sandbox: boolean;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [payError, setPayError] = useState('');
  const rendered = useRef(false);

  const renderButtons = useCallback(() => {
    if (!containerRef.current || rendered.current) return;
    rendered.current = true;

    (window as any).paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
      createOrder: async () => {
        const r = await api.post<{ data: { order_id: string } }>(
          `/buyer/invoices/${invoiceId}/create-paypal-order/`, {}
        );
        return r.data.data.order_id;
      },
      onApprove: async (data: { orderID: string }) => {
        setPayError('');
        await api.post(`/buyer/invoices/${invoiceId}/capture-paypal-order/`, {
          order_id: data.orderID,
        });
        onSuccess();
      },
      onError: () => {
        setPayError('PayPal payment failed. Please try again or choose another method.');
      },
      onCancel: () => {
        setPayError('Payment was cancelled.');
      },
    }).render(containerRef.current);
  }, [invoiceId, onSuccess]);

  useEffect(() => {
    const scriptId = 'paypal-sdk';
    const sdkUrl = `https://www.${sandbox ? 'sandbox.' : ''}paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`;

    function onLoad() {
      setSdkReady(true);
      renderButtons();
    }

    if ((window as any).paypal) {
      setSdkReady(true);
      renderButtons();
      return;
    }

    if (document.getElementById(scriptId)) {
      const existing = document.getElementById(scriptId) as HTMLScriptElement;
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = sdkUrl;
    script.addEventListener('load', onLoad);
    script.addEventListener('error', () => setSdkError('Failed to load PayPal SDK.'));
    document.body.appendChild(script);
    return () => script.removeEventListener('load', onLoad);
  }, [clientId, currency, sandbox, renderButtons]);

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Amount: <span className="font-bold text-slate-800">{currency} {amountDue.toFixed(2)}</span>
        </p>
      </div>

      {sdkError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {sdkError}
        </div>
      )}
      {payError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {payError}
        </div>
      )}

      {!sdkReady && !sdkError && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      <div ref={containerRef} />

      <button
        onClick={onBack}
        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Back
      </button>
    </div>
  );
}

// ── Manual Payment Form ────────────────────────────────────────────────────────

const MANUAL_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'cash',          label: 'Cash' },
  { value: 'other',         label: 'Other' },
];

function ManualStep({ invoiceId, amountDue, currency, onBack, onSuccess }: {
  invoiceId: string;
  amountDue: number;
  currency: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    amount: amountDue.toFixed(2),
    method: 'bank_transfer' as PaymentMethod,
    payment_date: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError('Enter a valid amount.'); return; }
    if (amount > amountDue + 0.01) {
      setError(`Amount cannot exceed remaining balance (${amountDue.toFixed(2)}).`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/buyer/invoices/${invoiceId}/pay/`, {
        amount: form.amount,
        method: form.method,
        payment_date: form.payment_date,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{currency}</span>
            <input
              type="number" step="0.01" min="0.01" max={amountDue} required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg pl-14 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date" required
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Method <span className="text-red-500">*</span></label>
        <select
          value={form.method}
          onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MANUAL_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference / Transaction ID</label>
        <input
          type="text" value={form.reference}
          onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
          placeholder="e.g. TXN-123456 or cheque no."
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
        <textarea
          rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button" onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  invoiceId, amountDue, currency, onClose, onSuccess,
}: {
  invoiceId: string;
  amountDue: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [flow, setFlow] = useState<PaymentFlow>('select');

  const { data: config } = useSWR('/buyer/payment-config/', fetchPaymentConfig, {
    revalidateOnFocus: false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Pay Invoice</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Remaining: <span className="font-semibold text-slate-700">{currency} {amountDue.toFixed(2)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        {flow === 'select' && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Choose payment method
            </p>

            <MethodCard
              icon={<CreditCard className="w-5 h-5 text-indigo-400" />}
              title="Pay by Card (Stripe)"
              subtitle="Visa, Mastercard, Amex — secured by Stripe"
              comingSoon
            />

            <MethodCard
              icon={<span className="text-[#003087] font-bold text-sm select-none">PP</span>}
              title="Pay with PayPal"
              subtitle="PayPal balance, card, or bank via PayPal"
              comingSoon
            />

            <MethodCard
              icon={<Building2 className="w-5 h-5 text-slate-500" />}
              title="Bank Transfer / Manual"
              subtitle="Record an offline payment: bank transfer, cheque, or cash"
              onClick={() => setFlow('manual')}
            />

            <button
              onClick={onClose}
              className="w-full mt-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {flow === 'stripe' && (
          <StripeStep
            invoiceId={invoiceId}
            amountDue={amountDue}
            currency={currency}
            onBack={() => setFlow('select')}
          />
        )}

        {flow === 'paypal' && config?.paypal_enabled && (
          <PayPalStep
            invoiceId={invoiceId}
            amountDue={amountDue}
            currency={currency}
            clientId={config.paypal_client_id}
            sandbox={config.paypal_sandbox}
            onBack={() => setFlow('select')}
            onSuccess={onSuccess}
          />
        )}

        {flow === 'manual' && (
          <ManualStep
            invoiceId={invoiceId}
            amountDue={amountDue}
            currency={currency}
            onBack={() => setFlow('select')}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </div>
  );
}

// ── Stripe Success Handler ────────────────────────────────────────────────────

function useStripeSuccessHandler(invoiceId: string, mutate: () => void, mutatePayments: () => void) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stripeMsg, setStripeMsg] = useState<{ type: 'success' | 'error' | 'cancelled'; text: string } | null>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    if (payment === 'cancelled') {
      setStripeMsg({ type: 'cancelled', text: 'Payment was cancelled. No charge was made.' });
      router.replace(`/buyer/invoices/${invoiceId}`);
      return;
    }

    if (payment === 'stripe_success' && sessionId && !confirmed.current) {
      confirmed.current = true;
      api.post(`/buyer/invoices/${invoiceId}/confirm-stripe-payment/`, { session_id: sessionId })
        .then(() => {
          setStripeMsg({ type: 'success', text: 'Card payment confirmed! Invoice updated.' });
          mutate();
          mutatePayments();
        })
        .catch(() => {
          setStripeMsg({ type: 'error', text: 'Payment recorded by Stripe but could not be confirmed. Please contact support.' });
        })
        .finally(() => {
          router.replace(`/buyer/invoices/${invoiceId}`);
        });
    }
  }, [searchParams, invoiceId, mutate, mutatePayments, router]);

  return { stripeMsg, clearStripeMsg: () => setStripeMsg(null) };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading, mutate } = useSWR(
    id ? `/buyer/invoices/${id}/` : null,
    fetchInvoice,
  );

  const { data: paymentData, mutate: mutatePayments } = useSWR(
    id ? `/buyer/invoices/${id}/payments/` : null,
    fetchPayments,
  );

  const { stripeMsg, clearStripeMsg } = useStripeSuccessHandler(id, mutate, mutatePayments);

  async function downloadFile(type: 'pdf' | 'xml') {
    try {
      const resp = await api.get(`/buyer/invoices/${id}/download-${type}/`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoice_number ?? id}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Could not download ${type.toUpperCase()}.`);
    }
  }

  function handlePaymentSuccess() {
    setShowPayment(false);
    mutate();
    mutatePayments();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-6 w-6 rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-24 text-slate-500">Invoice not found.</div>;
  }

  const canPay = ['pending', 'validated', 'submitted', 'partially_paid'].includes(invoice.status);
  const amountPaid = parseFloat(invoice.amount_paid ?? '0');
  const amountDue = parseFloat(invoice.amount_due ?? invoice.total_amount);
  const totalAmount = parseFloat(invoice.total_amount);
  const paidPct = totalAmount > 0 ? Math.min((amountPaid / totalAmount) * 100, 100) : 0;
  const payments = paymentData?.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Stripe result banner */}
      {stripeMsg && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
          stripeMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : stripeMsg.type === 'cancelled'
            ? 'bg-slate-50 border-slate-200 text-slate-600'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {stripeMsg.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm font-medium flex-1">{stripeMsg.text}</p>
          <button onClick={clearStripeMsg} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{invoice.invoice_number}</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {invoice.status_display}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Issued {invoice.issue_date}
              {invoice.due_date ? ` · Due ${invoice.due_date}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadFile('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          {invoice.xml_file && (
            <button
              onClick={() => downloadFile('xml')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              XML
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay Now
            </button>
          )}
          {invoice.status === 'paid' && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fully Paid
            </div>
          )}
        </div>
      </div>

      {/* Payment Progress */}
      {(invoice.status === 'partially_paid' || invoice.status === 'paid') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Payment Progress</span>
            <span className="text-sm text-slate-500">
              {invoice.currency} {amountPaid.toFixed(2)} of {invoice.currency} {totalAmount.toFixed(2)}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{paidPct.toFixed(0)}% paid</span>
            {amountDue > 0 && <span>{invoice.currency} {amountDue.toFixed(2)} remaining</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Invoice details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Party Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">From (Supplier)</p>
              <p className="font-semibold text-slate-800">{invoice.company_name}</p>
              {invoice.company_trn && (
                <p className="text-xs text-slate-500 mt-1">TRN: {invoice.company_trn}</p>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">To (Buyer)</p>
              <p className="font-semibold text-slate-800">{invoice.customer_name}</p>
              {invoice.customer_trn && (
                <p className="text-xs text-slate-500 mt-1">TRN: {invoice.customer_trn}</p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">VAT</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-slate-800">{item.description}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{item.quantity}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{item.vat_rate_type_display}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-800">{parseFloat(item.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-slate-100 px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{invoice.currency} {parseFloat(invoice.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Discount</span>
                  <span>−{invoice.currency} {parseFloat(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>VAT</span>
                <span>{invoice.currency} {parseFloat(invoice.total_vat).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>{invoice.currency} {parseFloat(invoice.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Summary + Payment History */}
        <div className="space-y-4">
          {/* Invoice Meta */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice Details</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="font-medium text-slate-700">{invoice.type_display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Currency</span>
                <span className="font-medium text-slate-700">{invoice.currency}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {invoice.due_date}
                  </span>
                </div>
              )}
              {invoice.purchase_order_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500">PO Number</span>
                  <span className="font-medium text-slate-700">{invoice.purchase_order_number}</span>
                </div>
              )}
              {invoice.contract_reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Contract Ref</span>
                  <span className="font-medium text-slate-700">{invoice.contract_reference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Total</span>
                <span className="font-semibold text-slate-800">{invoice.currency} {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-semibold text-emerald-600">{invoice.currency} {amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-700 font-medium">Balance Due</span>
                <span className={`font-bold ${amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {invoice.currency} {amountDue.toFixed(2)}
                </span>
              </div>
            </div>

            {canPay && (
              <button
                onClick={() => setShowPayment(true)}
                className="w-full mt-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay {invoice.currency} {amountDue.toFixed(2)}
              </button>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Payment History{payments.length > 0 ? ` (${payments.length})` : ''}
            </p>
            {payments.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No payments recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((p: Payment) => (
                  <div key={p.id} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">
                        {invoice.currency} {parseFloat(p.amount).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">{p.payment_date}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500">{METHOD_LABELS[p.method] ?? p.method}</span>
                      {p.reference && <span className="text-xs font-mono text-slate-400">{p.reference}</span>}
                    </div>
                    {p.notes && <p className="text-xs text-slate-400 mt-1">{p.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          invoiceId={id}
          amountDue={amountDue}
          currency={invoice.currency}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
