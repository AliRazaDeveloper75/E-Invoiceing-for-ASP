'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  ArrowLeft, FileText, CreditCard, CheckCircle2,
  Loader2, X, AlertCircle, Calendar, Receipt, Building2,
  ChevronLeft, Ban, ShieldCheck, PenLine, Mail, Phone,
  Globe, MapPin, Clock, Hash, FileSignature,
} from 'lucide-react';
import type { Invoice, Payment, PaymentSummary, PaymentMethod, PaymentConfig } from '@/types';
import { PDFDownloadButton } from '@/components/invoice/PDFDownloadButton';
import SignatureCanvas from '@/components/SignatureCanvas';

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
  draft:            'bg-gray-100 text-gray-700 ring-1 ring-gray-300/50 shadow-sm',
  awaiting_approval:'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 ring-1 ring-amber-300/50 shadow-sm animate-pulse-soft',
  pending:          'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-700 ring-1 ring-yellow-300/50 shadow-sm',
  submitted:        'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 ring-1 ring-blue-300/50 shadow-sm',
  validated:        'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-300/50 shadow-sm',
  rejected:         'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 ring-1 ring-red-300/50 shadow-sm',
  cancelled:        'bg-gradient-to-r from-gray-100 to-gray-100 text-gray-500 ring-1 ring-gray-300/50',
  paid:             'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-300/50 shadow-sm',
  partially_paid:   'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 ring-1 ring-orange-300/50 shadow-sm',
  deactivated:      'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 ring-1 ring-amber-300/50 shadow-sm',
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
                 hover:border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/80
                 transition-all duration-300 text-left group
                 shadow-sm hover:shadow-md hover:shadow-blue-100/50"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100
                      group-hover:from-blue-100 group-hover:to-indigo-100
                      flex items-center justify-center transition-all duration-300 shrink-0 shadow-sm
                      ring-1 ring-slate-200/50 group-hover:ring-blue-300/50">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{title}</p>
          {badge && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 ring-1 ring-emerald-200/50">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 group-hover:text-slate-600 transition-colors">{subtitle}</p>
      </div>
      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 rotate-180 shrink-0 transition-all" />
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
      <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 border border-indigo-200/60 rounded-xl p-5 text-center shadow-sm relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-400 via-blue-400 to-sky-400 rounded-t-xl absolute top-0 left-0 right-0" />
        <div className="pt-3">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-200">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Secure Card Payment via Stripe</p>
          <p className="text-xs text-slate-500 mt-1">
            You will be redirected to Stripe&apos;s secure checkout page.
          </p>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 mt-4">
            {currency} {amountDue.toFixed(2)}
          </p>
        </div>
      </div>

      {error && (
        <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                     text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] shadow-sm"
        >
          Back
        </button>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600
                     hover:from-indigo-700 hover:via-blue-700 hover:to-sky-700 text-white text-sm font-semibold
                     transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2
                     shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/40 active:scale-[0.98] btn-primary"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {loading ? 'Redirecting…' : 'Pay with Card'}
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        <span className="inline-block mr-1">🔒</span> Powered by Stripe — your card details are never stored on our servers.
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
      <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 border border-indigo-200/60 rounded-xl p-4 text-center shadow-sm relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-400 via-blue-400 to-sky-400 rounded-t-xl absolute top-0 left-0 right-0" />
        <div className="pt-3">
          <p className="text-sm text-slate-600">
            Amount: <span className="font-bold text-slate-900 text-lg">{currency} {amountDue.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {sdkError && (
        <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {sdkError}
        </div>
      )}
      {payError && (
        <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
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
        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                   text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all
                   active:scale-[0.98] shadow-sm"
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
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">{currency}</span>
            <input
              type="number" step="0.01" min="0.01" max={amountDue} required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg pl-14 pr-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date" required
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                       outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Method <span className="text-red-500">*</span></label>
        <select
          value={form.method}
          onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all bg-white"
        >
          {MANUAL_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reference / Transaction ID</label>
        <input
          type="text" value={form.reference}
          onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
          placeholder="e.g. TXN-123456 or cheque no."
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all bg-white placeholder:text-slate-400"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
        <textarea
          rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all resize-none bg-white placeholder:text-slate-400"
        />
      </div>

      {error && (
        <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button" onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                     text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] shadow-sm"
        >
          Back
        </button>
        <button
          type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500
                     hover:from-blue-600 hover:via-indigo-600 hover:to-violet-600 text-white text-sm font-semibold
                     transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2
                     shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/40 active:scale-[0.97] btn-primary"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-white">
          <div>
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-700">Pay Invoice</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Remaining: <span className="font-semibold text-indigo-700">{currency} {amountDue.toFixed(2)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/80 hover:text-slate-600 transition-all active:scale-90 ring-1 ring-transparent hover:ring-slate-200">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        {flow === 'select' && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-indigo-400 to-blue-400 rounded-full" />
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
              className="w-full mt-2 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50 active:scale-[0.98]"
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

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 animate-shimmer" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-48 rounded-md bg-slate-200 animate-shimmer" />
                  <div className="h-5 w-20 rounded-full bg-slate-200 animate-shimmer" />
                </div>
                <div className="h-4 w-64 rounded-md bg-slate-200 animate-shimmer" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-lg bg-slate-200 animate-shimmer" />
              <div className="h-9 w-20 rounded-lg bg-slate-200 animate-shimmer" />
              <div className="h-9 w-28 rounded-lg bg-slate-200 animate-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Party cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="h-28 rounded-xl bg-slate-200 animate-shimmer" />
        <div className="h-28 rounded-xl bg-slate-200 animate-shimmer" />
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-96 rounded-xl bg-slate-200 animate-shimmer" />
        </div>
        <div className="space-y-5">
          <div className="h-48 rounded-xl bg-slate-200 animate-shimmer" />
          <div className="h-44 rounded-xl bg-slate-200 animate-shimmer" />
          <div className="h-56 rounded-xl bg-slate-200 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);

  const [signName, setSignName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const { data: invoice, isLoading, mutate } = useSWR(
    id ? `/buyer/invoices/${id}/` : null,
    fetchInvoice,
  );

  const { data: paymentData, mutate: mutatePayments } = useSWR(
    id ? `/buyer/invoices/${id}/payments/` : null,
    fetchPayments,
  );

  const { stripeMsg, clearStripeMsg } = useStripeSuccessHandler(id, mutate, mutatePayments);

  async function downloadXML() {
    try {
      const resp = await api.get(`/buyer/invoices/${id}/download-xml/`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoice_number ?? id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download XML.');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfCompany: any = invoice ? {
    name:           invoice.company_name,
    trn:            invoice.company_trn,
    logo_url:       (invoice as any).company_logo,
    legal_name:     (invoice as any).company_legal_name,
    street_address: (invoice as any).company_street_address,
    city:           (invoice as any).company_city,
    emirate:        (invoice as any).company_emirate,
    po_box:         (invoice as any).company_po_box,
    country:        (invoice as any).company_country,
    phone:          (invoice as any).company_phone,
    email:          (invoice as any).company_email,
    website:        (invoice as any).company_website,
  } : null;

  function handlePaymentSuccess() {
    setShowPayment(false);
    mutate();
    mutatePayments();
  }

  async function handleApprove() {
    if ((!signName.trim() && !signatureImage) || !confirmChecked) {
      setApprovalError('Provide your signature (type your name and/or draw below) and tick the confirmation box to e-sign.');
      return;
    }
    setApproving(true); setApprovalError('');
    try {
      await api.post(`/buyer/invoices/${id}/approve/`, {
        signed_name: signName.trim() || undefined,
        signature_image: signatureImage || undefined,
      });
      await mutate();
    } catch (err: any) {
      setApprovalError(err?.response?.data?.error?.message || 'Could not confirm the order. Please try again.');
    } finally { setApproving(false); }
  }

  async function handleReject() {
    setApproving(true); setApprovalError('');
    try {
      await api.post(`/buyer/invoices/${id}/reject/`, { note: rejectNote.trim() });
      setShowReject(false);
      await mutate();
    } catch (err: any) {
      setApprovalError(err?.response?.data?.error?.message || 'Could not reject the invoice.');
    } finally { setApproving(false); }
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-5 shadow-sm">
          <FileText className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-slate-600 font-semibold text-lg">Invoice not found</p>
        <p className="text-sm text-slate-400 mt-1">The requested invoice could not be loaded.</p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-5 py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700
                     bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shadow-sm active:scale-[0.97]"
        >
          Go back
        </button>
      </div>
    );
  }

  const canPay = ['pending', 'validated', 'submitted', 'partially_paid'].includes(invoice.status);
  const amountPaid = parseFloat(invoice.amount_paid ?? '0');
  const amountDue = parseFloat(invoice.amount_due ?? invoice.total_amount);
  const totalAmount = parseFloat(invoice.total_amount);
  const paidPct = totalAmount > 0 ? Math.min((amountPaid / totalAmount) * 100, 100) : 0;
  const payments = paymentData?.payments ?? [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in-up">
      {/* Stripe result banner */}
      {stripeMsg && (
        <div className={`animate-fade-in-down flex items-center gap-3 px-5 py-4 rounded-xl border ${
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
          <button onClick={clearStripeMsg} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2.5 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-all active:scale-90 bg-slate-50 ring-1 ring-slate-200/50"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{invoice.invoice_number}</h1>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[invoice.status] ?? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'}`}>
                    {invoice.status_display}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Issued {invoice.issue_date}
                  </span>
                  {invoice.due_date && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Due {invoice.due_date}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <PDFDownloadButton invoice={invoice as any} company={pdfCompany as any} />
              {invoice.xml_file && (
                <button
                  onClick={downloadXML}
                  className="group flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                             text-slate-600 border border-slate-200 rounded-lg
                             hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50
                             hover:border-orange-200 hover:text-orange-700
                             transition-all duration-300 active:scale-[0.97]
                             shadow-sm hover:shadow-md hover:shadow-orange-100/50"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                  XML
                </button>
              )}
              {canPay && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold
                             bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500
                             hover:from-blue-600 hover:via-indigo-600 hover:to-violet-600 text-white rounded-lg
                             transition-all duration-300 shadow-md shadow-blue-200/50
                             hover:shadow-lg hover:shadow-indigo-300/40
                             active:scale-[0.97] btn-primary"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay Now
                </button>
              )}
              {invoice.status === 'paid' && (
                <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                                text-emerald-700 bg-gradient-to-r from-emerald-50 to-green-50
                                border border-emerald-200/70 rounded-lg shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Fully Paid
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval / e-signature (awaiting buyer approval) */}
      {invoice.status === 'awaiting_approval' && (
        <div className="rounded-xl border border-blue-200/70 bg-white shadow-xl shadow-blue-100/30 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-5">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-200/50">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xl tracking-tight">Review &amp; confirm this order</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
                  Please review the invoice details above. To confirm this order, provide your
                  signature below — it will be submitted to the tax authority network.
                </p>
              </div>
            </div>

            {!showReject ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-200/50">
                    <PenLine className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Signature options</p>
                    <p className="text-xs text-slate-500">Provide at least one signature method below</p>
                  </div>
                </div>

                <div className="bg-white border border-blue-100/80 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-blue-100/60 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <PenLine className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Type your name</span>
                    <span className="text-[10px] font-medium text-blue-200 ml-auto">(optional)</span>
                  </div>
                  <div className="p-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={signName}
                        onChange={(e) => setSignName(e.target.value)}
                        placeholder="e.g. Ahmed Al Rashid"
                        className="w-full border border-slate-200 rounded-lg pl-3.5 pr-3.5 py-2.5 text-sm
                                   outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400
                                   transition-all bg-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Or</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                </div>

                <div className="bg-white border border-blue-100/80 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-blue-100/60 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <FileSignature className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Draw your signature</span>
                    <span className="text-[10px] font-medium text-blue-200 ml-auto">(optional)</span>
                  </div>
                  <div className="p-4">
                    <SignatureCanvas
                      onSave={(dataUrl) => setSignatureImage(dataUrl)}
                      width={500}
                      height={130}
                    />
                    {signatureImage && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Signature captured successfully
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 shadow-sm">
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="h-4.5 w-4.5 mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 transition-all group-hover:border-blue-400"
                      />
                    </div>
                    <span className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                      I confirm this order is correct and authorise it to be submitted to the tax authority.
                      I understand my typed name and/or drawn signature constitutes my electronic signature.
                    </span>
                  </label>
                </div>

                {approvalError && (
                  <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {approvalError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={handleApprove}
                    disabled={approving || (!signName.trim() && !signatureImage) || !confirmChecked}
                    className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg
                               bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700
                               hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800
                               text-white text-sm font-semibold transition-all duration-300
                               disabled:opacity-40 shadow-md shadow-blue-200/50
                               hover:shadow-lg hover:shadow-blue-300/40
                               active:scale-[0.97] btn-primary"
                  >
                    {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve &amp; Confirm Order
                  </button>
                  <button
                    onClick={() => { setApprovalError(''); setShowReject(true); }}
                    disabled={approving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200
                               text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700
                               text-sm font-medium transition-all duration-200
                               disabled:opacity-40 active:scale-[0.97] shadow-sm hover:shadow-md hover:shadow-red-200/40"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <label className="block text-sm font-semibold text-slate-700">Reason for rejection <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Let the supplier know what needs to change…"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm
                             outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300
                             transition-all resize-none bg-white placeholder:text-slate-400"
                />
                {approvalError && (
                  <div className="animate-fade-in-down bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {approvalError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReject(false)}
                    disabled={approving}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                               text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 active:scale-[0.98] shadow-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                               bg-gradient-to-r from-red-600 to-red-500
                               hover:from-red-700 hover:to-red-600 text-white text-sm font-semibold
                               transition-all duration-300 disabled:opacity-50 shadow-md shadow-red-300/40
                               hover:shadow-lg hover:shadow-red-400/50 active:scale-[0.97] btn-primary"
                  >
                    {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signed confirmation (after approval) */}
      {(invoice.buyer_signed_name || (invoice as any).buyer_signature_image) && invoice.status !== 'awaiting_approval' && (
        <div className="animate-fade-in-up rounded-xl bg-white border border-emerald-200/70 overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-400" />
          <div className="px-5 py-4 flex items-center gap-3 text-sm text-emerald-800">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shrink-0 shadow-sm">
              <FileSignature className="w-4 h-4 text-white" />
            </div>
            <span>
              E-signed
              {invoice.buyer_signed_name ? <> by <strong>{invoice.buyer_signed_name}</strong></> : ''}
              {(invoice as any).buyer_signature_image ? ' (with drawn signature)' : ''}
              {invoice.buyer_signed_at ? ` on ${new Date(invoice.buyer_signed_at).toLocaleString()}` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Deactivated notice (read-only for buyer) */}
      {invoice.status === 'deactivated' && (
        <div className="animate-fade-in-up rounded-xl bg-white border border-amber-200/70 overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold flex items-center gap-1.5">
              <Ban className="w-4 h-4" /> This invoice has been deactivated by the supplier.
            </p>
            {invoice.deactivation_reason && (
              <p className="mt-1.5 ml-6"><span className="font-medium">Reason:</span> {invoice.deactivation_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Payment Progress */}
      {(invoice.status === 'partially_paid' || invoice.status === 'paid') && (
        <div className="bg-white border border-emerald-200/60 rounded-xl overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center ring-1 ring-emerald-200/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Payment Progress
              </span>
              <span className="text-sm font-medium text-emerald-600 bg-emerald-50/60 px-3 py-1 rounded-lg ring-1 ring-emerald-100/50">
                {invoice.currency} {amountPaid.toFixed(2)} / {invoice.currency} {totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="h-3 bg-emerald-100/70 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 rounded-full
                           transition-all duration-1000 ease-out animate-progress-glow"
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2.5 text-sm">
              <span className="font-semibold text-emerald-600">{paidPct.toFixed(0)}% paid</span>
              {amountDue > 0 && (
                <span className="text-slate-500">
                  <span className="font-medium text-slate-600">{invoice.currency} {amountDue.toFixed(2)}</span> remaining
                </span>
              )}
              {amountDue <= 0 && (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Invoice details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Party Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden card-hover shadow-sm hover:shadow-md hover:shadow-blue-100/50 transition-all duration-300"
                 style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center ring-1 ring-blue-200/50 group-hover:ring-blue-300/70 transition-all">
                    <Building2 className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">From (Supplier)</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{invoice.company_name}</p>
                  </div>
                </div>
                {invoice.company_trn && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-100/50">
                    <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="font-medium text-slate-600">TRN:</span>
                    <span className="font-mono text-slate-700">{invoice.company_trn}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden card-hover shadow-sm hover:shadow-md hover:shadow-blue-100/50 transition-all duration-300"
                 style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center ring-1 ring-blue-200/50 group-hover:ring-blue-300/70 transition-all">
                    <Building2 className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">To (Buyer)</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{invoice.customer_name}</p>
                  </div>
                </div>
                {invoice.customer_trn && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-100/50">
                    <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="font-medium text-slate-600">TRN:</span>
                    <span className="font-mono text-slate-700">{invoice.customer_trn}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Line Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">VAT</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id}
                        className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                        style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}>
                      <td className="px-6 py-4 text-slate-800 font-medium">{item.description}</td>
                      <td className="px-6 py-4 text-right text-slate-600 font-mono">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-slate-600 font-mono">{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-600 font-mono">{item.vat_rate_type_display}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-800 font-mono">{parseFloat(item.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 px-6 py-4 space-y-2.5 bg-gradient-to-b from-slate-50 to-white">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">{invoice.currency} {parseFloat(invoice.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-emerald-600 bg-emerald-50/60 px-2 py-0.5 rounded-md">−{invoice.currency} {parseFloat(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT</span>
                <span className="font-medium text-slate-700">{invoice.currency} {parseFloat(invoice.total_vat).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2.5 border-t border-slate-200">
                <span className="text-slate-800">Total</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{invoice.currency} {parseFloat(invoice.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-cyan-400" />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center ring-1 ring-blue-200/50">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Notes</p>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary + Payment History */}
        <div className="space-y-5">
          {/* Invoice Meta */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
               style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center ring-1 ring-blue-200/50">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                </div>
                Invoice Details
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-lg ring-1 ring-blue-100/60">{invoice.type_display}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Currency</span>
                  <span className="font-semibold text-slate-800">{invoice.currency}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-between items-center px-3 -mx-3 py-2 rounded-lg bg-amber-50/60 border border-amber-100/50">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-medium text-amber-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      {invoice.due_date}
                    </span>
                  </div>
                )}
                {invoice.purchase_order_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">PO Number</span>
                    <span className="font-medium text-slate-700 font-mono text-xs bg-slate-100/60 px-2.5 py-1 rounded-lg">{invoice.purchase_order_number}</span>
                  </div>
                )}
                {invoice.contract_reference && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Contract Ref</span>
                    <span className="font-medium text-slate-700 font-mono text-xs bg-slate-100/60 px-2.5 py-1 rounded-lg">{invoice.contract_reference}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
               style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
            <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center ring-1 ring-cyan-200/50">
                  <Receipt className="w-3.5 h-3.5 text-cyan-600" />
                </div>
                Amount Summary
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Invoice Total</span>
                  <span className="font-semibold text-slate-800">{invoice.currency} {totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {invoice.currency} {amountPaid.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-slate-100 mt-2">
                  <span className="text-slate-700 font-medium">Balance Due</span>
                  <span className={`text-lg font-bold ${amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {invoice.currency} {amountDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {canPay && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500
                             hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 text-white text-sm font-semibold
                             transition-all duration-300 flex items-center justify-center gap-2
                             shadow-md shadow-emerald-200/50 hover:shadow-lg hover:shadow-emerald-300/40 active:scale-[0.97] btn-primary"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay {invoice.currency} {amountDue.toFixed(2)}
                </button>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
               style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500" />
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center ring-1 ring-indigo-200/50">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                Payment History{payments.length > 0 ? ` (${payments.length})` : ''}
              </p>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-500">No payments recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((p: Payment, idx: number) => (
                    <div key={p.id}
                         className="border border-slate-100 rounded-lg p-3.5 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/30 hover:border-indigo-200/50 transition-all duration-300"
                         style={{ animationDelay: `${0.25 + idx * 0.08}s`, animationFillMode: 'both' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-800">
                          {invoice.currency} {parseFloat(p.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-100/60 px-2 py-0.5 rounded-md">{p.payment_date}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 ring-1 ring-indigo-200/60">
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                        {p.reference && <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{p.reference}</span>}
                      </div>
                      {p.notes && <p className="text-xs text-slate-400 mt-1.5 italic border-t border-slate-50 pt-1.5">{p.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
