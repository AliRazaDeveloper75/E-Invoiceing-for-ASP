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
  draft:             'bg-slate-100 text-slate-600 border-slate-200',
  awaiting_approval: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  pending:           'bg-amber-50 text-amber-700 border-amber-200',
  submitted:         'bg-blue-50 text-blue-700 border-blue-200',
  validated:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:          'bg-red-50 text-red-700 border-red-200',
  cancelled:         'bg-slate-50 text-slate-500 border-slate-200',
  paid:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid:    'bg-orange-50 text-orange-700 border-orange-200',
  deactivated:       'bg-amber-50 text-amber-700 border-amber-200',
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
      <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 opacity-60 cursor-not-allowed select-none">
        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-500 text-sm">{title}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 uppercase tracking-wide">
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
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200
                 hover:border-blue-300 hover:bg-blue-50/50
                 transition-all duration-200 text-left group
                 shadow-sm hover:shadow-md"
    >
      <div className="w-11 h-11 rounded-xl bg-slate-100
                      group-hover:bg-blue-100
                      flex items-center justify-center transition-colors duration-200 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{title}</p>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
        <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-900">Secure Card Payment via Stripe</p>
        <p className="text-xs text-slate-500 mt-1">
          You will be redirected to Stripe&apos;s secure checkout page.
        </p>
        <p className="text-2xl font-bold text-slate-900 mt-4">
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
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                     text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          Back
        </button>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold
                     transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2
                     shadow-sm hover:shadow-md active:scale-[0.98]"
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-sm text-slate-600">
          Amount: <span className="font-bold text-slate-900 text-lg">{currency} {amountDue.toFixed(2)}</span>
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
        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                   text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
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
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">{currency}</span>
            <input
              type="number" step="0.01" min="0.01" max={amountDue} required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg pl-14 pr-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date" required
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                       outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Method <span className="text-red-500">*</span></label>
        <select
          value={form.method}
          onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white"
        >
          {MANUAL_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Reference / Transaction ID</label>
        <input
          type="text" value={form.reference}
          onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
          placeholder="e.g. TXN-123456 or cheque no."
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white placeholder:text-slate-400"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Notes</label>
        <textarea
          rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none bg-white placeholder:text-slate-400"
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
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                     text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          Back
        </button>
        <button
          type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold
                     transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2
                     shadow-sm hover:shadow-md active:scale-[0.98]"
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pay Invoice</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Remaining: <span className="font-semibold text-slate-900">{currency} {amountDue.toFixed(2)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        {flow === 'select' && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Choose payment method
            </p>

            <MethodCard
              icon={<CreditCard className="w-5 h-5 text-slate-400" />}
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="h-1 bg-slate-100" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-48 rounded-lg bg-slate-100 animate-pulse" />
                  <div className="h-6 w-24 rounded-full bg-slate-100 animate-pulse" />
                </div>
                <div className="h-4 w-64 rounded-lg bg-slate-100 animate-pulse" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-24 rounded-lg bg-slate-100 animate-pulse" />
              <div className="h-10 w-20 rounded-lg bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Section Card Wrapper ─────────────────────────────────────────────────────

function SectionCard({
  children,
  className = '',
  header,
}: {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}>
      {header}
      {children}
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
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-700 font-semibold text-lg">Invoice not found</p>
        <p className="text-sm text-slate-400 mt-1">The requested invoice could not be loaded.</p>
        <button
          onClick={() => router.back()}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700
                     bg-blue-50 hover:bg-blue-100 rounded-xl transition-all active:scale-[0.97]"
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

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
          <button onClick={clearStripeMsg} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <SectionCard>
        <div className="bg-gradient-to-r from-blue-950 to-indigo-950 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-white/80" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{invoice.invoice_number}</h1>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[invoice.status] ?? 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                    {invoice.status_display}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-blue-200/70">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-300/60" />
                    Issued {invoice.issue_date}
                  </span>
                  {invoice.due_date && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-300/60" />
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
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                             text-white/80 border border-white/15 rounded-lg
                             hover:bg-white/10 hover:text-white
                             transition-all active:scale-[0.97]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  XML
                </button>
              )}
              {canPay && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold
                             bg-white text-blue-950 hover:bg-blue-50 rounded-lg
                             transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay Now
                </button>
              )}
              {invoice.status === 'paid' && (
                <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                                text-emerald-300 bg-emerald-500/15 border border-emerald-400/20 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Fully Paid
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── Approval / e-signature (awaiting buyer approval) ────────────── */}
      {invoice.status === 'awaiting_approval' && (
        <SectionCard className="border-blue-200 shadow-lg shadow-blue-100/40">
          <div className="bg-gradient-to-r from-blue-950 to-indigo-950 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Review &amp; confirm this order</h3>
                <p className="text-sm text-blue-200/70 mt-0.5">
                  Please review the invoice details above. Provide your signature to confirm and submit to the tax authority.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {!showReject ? (
              <div className="space-y-6">
                {/* Step indicators */}
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${(signName.trim() || signatureImage) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${(signName.trim() || signatureImage) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {(signName.trim() || signatureImage) ? '✓' : '1'}
                    </span>
                    Signature
                  </span>
                  <span className="w-6 h-px bg-slate-200" />
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${confirmChecked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${confirmChecked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {confirmChecked ? '✓' : '2'}
                    </span>
                    Confirm
                  </span>
                </div>

                {/* Signature: Type name */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2.5">
                    <PenLine className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Type your name</span>
                    <span className="text-xs text-slate-400 ml-auto">optional</span>
                  </div>
                  <div className="p-4">
                    <input
                      type="text"
                      value={signName}
                      onChange={(e) => setSignName(e.target.value)}
                      placeholder="e.g. Ahmed Al Rashid"
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm
                                 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                                 transition-all bg-white placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Signature: Draw */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2.5">
                    <FileSignature className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Draw your signature</span>
                    <span className="text-xs text-slate-400 ml-auto">optional</span>
                  </div>
                  <div className="p-4">
                    <SignatureCanvas
                      onSave={(dataUrl) => setSignatureImage(dataUrl)}
                      width={500}
                      height={130}
                    />
                    {signatureImage && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Signature captured successfully
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmation checkbox */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <span className="text-sm text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                      I confirm this order is correct and authorise it to be submitted to the tax authority.
                      I understand my typed name and/or drawn signature constitutes my electronic signature.
                    </span>
                  </label>
                </div>

                {approvalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {approvalError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={handleApprove}
                    disabled={approving || (!signName.trim() && !signatureImage) || !confirmChecked}
                    className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg
                               bg-slate-900 hover:bg-slate-800
                               text-white text-sm font-semibold transition-all duration-200
                               disabled:opacity-40 shadow-sm
                               hover:shadow-md active:scale-[0.97]"
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
                               disabled:opacity-40 active:scale-[0.97]"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ) : (
              /* ── Reject flow ── */
              <div className="space-y-5">
                <label className="block text-sm font-semibold text-slate-700">Reason for rejection <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Let the supplier know what needs to change…"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm
                             outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                             transition-all resize-none bg-white placeholder:text-slate-400"
                />
                {approvalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {approvalError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReject(false)}
                    disabled={approving}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                               text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                               bg-red-600 hover:bg-red-700 text-white text-sm font-semibold
                               transition-all duration-200 disabled:opacity-50 shadow-sm
                               hover:shadow-md active:scale-[0.97]"
                  >
                    {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ─── Signed confirmation (after approval) ────────────────────────── */}
      {(invoice.buyer_signed_name || (invoice as any).buyer_signature_image) && invoice.status !== 'awaiting_approval' && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <FileSignature className="w-4 h-4 text-emerald-600" />
          </div>
          <span>
            E-signed
            {invoice.buyer_signed_name ? <> by <strong>{invoice.buyer_signed_name}</strong></> : ''}
            {(invoice as any).buyer_signature_image ? ' (with drawn signature)' : ''}
            {invoice.buyer_signed_at ? ` on ${new Date(invoice.buyer_signed_at).toLocaleString()}` : ''}
          </span>
        </div>
      )}

      {/* ─── Deactivated notice ──────────────────────────────────────────── */}
      {invoice.status === 'deactivated' && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <Ban className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">This invoice has been deactivated by the supplier.</p>
            {invoice.deactivation_reason && (
              <p className="mt-1 text-amber-700"><span className="font-medium">Reason:</span> {invoice.deactivation_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Payment Progress ────────────────────────────────────────────── */}
      {(invoice.status === 'partially_paid' || invoice.status === 'paid') && (
        <SectionCard className="border-emerald-200">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Payment Progress
              </span>
              <span className="text-sm font-medium text-slate-600">
                {invoice.currency} {amountPaid.toFixed(2)} / {invoice.currency} {totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="font-medium text-slate-500">{paidPct.toFixed(0)}% paid</span>
              {amountDue > 0 ? (
                <span className="text-slate-500">
                  <span className="font-medium text-slate-700">{invoice.currency} {amountDue.toFixed(2)}</span> remaining
                </span>
              ) : (
                <span className="font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fully Paid
                </span>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ─── Main Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column — Invoice Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Party Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier */}
            <SectionCard>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">From</p>
                    <p className="font-semibold text-slate-900 text-sm">{invoice.company_name}</p>
                  </div>
                </div>
                {invoice.company_trn && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-600">TRN:</span>
                    <span className="font-mono text-slate-700">{invoice.company_trn}</span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Buyer */}
            <SectionCard>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">To</p>
                    <p className="font-semibold text-slate-900 text-sm">{invoice.customer_name}</p>
                  </div>
                </div>
                {invoice.customer_trn && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-600">TRN:</span>
                    <span className="font-mono text-slate-700">{invoice.customer_trn}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Line Items */}
          <SectionCard>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Line Items</h3>
              <span className="text-xs text-slate-400 font-medium ml-auto">{invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">VAT</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                    >
                      <td className="px-6 py-3.5 text-slate-800 font-medium">{item.description}</td>
                      <td className="px-6 py-3.5 text-right text-slate-600 font-mono text-xs">{item.quantity}</td>
                      <td className="px-6 py-3.5 text-right text-slate-600 font-mono text-xs">{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="px-6 py-3.5 text-right text-slate-500 font-mono text-xs">{item.vat_rate_type_display}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-800 font-mono text-xs">{parseFloat(item.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 px-6 py-4 space-y-2 bg-slate-50/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700 font-mono">{invoice.currency} {parseFloat(invoice.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-emerald-600 font-mono">−{invoice.currency} {parseFloat(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT</span>
                <span className="font-medium text-slate-700 font-mono">{invoice.currency} {parseFloat(invoice.total_vat).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2.5 border-t border-slate-200">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900 font-mono">{invoice.currency} {parseFloat(invoice.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </SectionCard>

          {/* Notes */}
          {invoice.notes && (
            <SectionCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</p>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right Column — Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">

          {/* Invoice Meta */}
          <SectionCard>
            <div className="p-5 space-y-3.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Invoice Details
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{invoice.type_display}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Currency</span>
                  <span className="font-semibold text-slate-800">{invoice.currency}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-medium text-slate-700 flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {invoice.due_date}
                    </span>
                  </div>
                )}
                {invoice.purchase_order_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">PO Number</span>
                    <span className="font-medium text-slate-700 font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-lg">{invoice.purchase_order_number}</span>
                  </div>
                )}
                {invoice.contract_reference && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Contract Ref</span>
                    <span className="font-medium text-slate-700 font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-lg">{invoice.contract_reference}</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Amount Summary */}
          <SectionCard>
            <div className="p-5 space-y-3.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5" />
                Amount Summary
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Invoice Total</span>
                  <span className="font-semibold text-slate-800 font-mono">{invoice.currency} {totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-semibold text-emerald-600 font-mono flex items-center gap-1.5">
                    {invoice.currency} {amountPaid.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-t border-slate-200 mt-1">
                  <span className="text-slate-700 font-semibold">Balance Due</span>
                  <span className={`text-lg font-bold font-mono ${amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {invoice.currency} {amountDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {canPay && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold
                             transition-all duration-200 flex items-center justify-center gap-2
                             shadow-sm hover:shadow-md active:scale-[0.98] mt-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay {invoice.currency} {amountDue.toFixed(2)}
                </button>
              )}
            </div>
          </SectionCard>

          {/* Payment History */}
          <SectionCard>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Payment History{payments.length > 0 ? ` (${payments.length})` : ''}
              </p>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400">No payments recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((p: Payment) => (
                    <div key={p.id} className="border border-slate-100 rounded-xl p-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {invoice.currency} {parseFloat(p.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400">{p.payment_date}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                        {p.reference && <span className="text-xs font-mono text-slate-400">{p.reference}</span>}
                      </div>
                      {p.notes && <p className="text-xs text-slate-400 mt-2 italic border-t border-slate-100 pt-2">{p.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
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
