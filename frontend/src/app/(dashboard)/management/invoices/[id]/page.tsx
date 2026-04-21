'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { FlowTracker } from '@/components/invoice/FlowTracker';
import type { InvoiceTimeline } from '@/types';
import {
  ArrowLeft, RefreshCw, Send, ShieldCheck, ShieldX,
  Landmark, CheckCircle2, XCircle, Clock, FileText,
  Building2, User, Calendar, Hash, AlertTriangle,
} from 'lucide-react';

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data.data;
}

interface AdminInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  type_display: string;
  status: string;
  status_display: string;
  company_name: string;
  company_trn: string;
  customer_name: string;
  issue_date: string;
  currency: string;
  subtotal: string;
  total_vat: string;
  total_amount: string;
  fta_status: string | null;
  asp_submission_id: string | null;
  created_by_name: string;
  created_at: string;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'text-gray-600',    bg: 'bg-gray-100',    icon: FileText },
  pending:   { label: 'Pending',   color: 'text-blue-600',    bg: 'bg-blue-100',    icon: Clock },
  submitted: { label: 'Submitted', color: 'text-indigo-600',  bg: 'bg-indigo-100',  icon: Send },
  validated: { label: 'Validated', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'text-red-600',     bg: 'bg-red-100',     icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',   bg: 'bg-slate-100',   icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-4 w-4" />
      {cfg.label}
    </span>
  );
}

// ─── Admin actions per status ──────────────────────────────────────────────────

type ActionKey = 'submit' | 'approve' | 'reject' | 'fta';

interface ActionDef {
  key: ActionKey;
  label: string;
  icon: React.ElementType;
  color: string;
  endpoint: string;
  confirm: string;
}

function getActions(invoice: AdminInvoice): ActionDef[] {
  const actions: ActionDef[] = [];
  const num = invoice.invoice_number;

  if (invoice.status === 'draft') {
    actions.push({
      key: 'submit',
      label: 'Submit to ASP',
      icon: Send,
      color: 'bg-orange-500 hover:bg-orange-600 text-white',
      endpoint: `/admin/invoices/${invoice.id}/submit/`,
      confirm: `Submit invoice ${num} to ASP for validation?`,
    });
  }

  if (invoice.status === 'pending' || invoice.status === 'submitted') {
    actions.push({
      key: 'approve',
      label: 'Approve — ASP Validated',
      icon: ShieldCheck,
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      endpoint: `/admin/invoices/${invoice.id}/approve-asp/`,
      confirm: `Mark invoice ${num} as validated by ASP?\n\nThis advances the PEPPOL flow through Corners 2, 3 and 4.`,
    });
    actions.push({
      key: 'reject',
      label: 'Reject — ASP Rejected',
      icon: ShieldX,
      color: 'bg-red-500 hover:bg-red-600 text-white',
      endpoint: `/admin/invoices/${invoice.id}/reject-asp/`,
      confirm: `Reject invoice ${num}? This marks it as rejected by ASP.`,
    });
  }

  if ((invoice.status === 'validated' || invoice.status === 'paid') && invoice.fta_status !== 'reported') {
    actions.push({
      key: 'fta',
      label: 'Report to FTA',
      icon: Landmark,
      color: 'bg-teal-600 hover:bg-teal-700 text-white',
      endpoint: `/admin/invoices/${invoice.id}/report-fta/`,
      confirm: `Report invoice ${num} to the UAE FTA data platform?`,
    });
  }

  return actions;
}

// ─── Status flow steps label ───────────────────────────────────────────────────

const FLOW_STEPS = ['draft', 'pending', 'submitted', 'validated', 'fta'];
const FLOW_LABELS: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', submitted: 'Submitted', validated: 'Validated', fta: 'FTA Reported',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInvoiceDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const { data: invoice, isLoading: invLoading, mutate: mutateInv } =
    useSWR<AdminInvoice>(`/admin/invoices/${id}/`, fetcher);

  const { data: timeline, isLoading: tlLoading, mutate: mutateTl } =
    useSWR<InvoiceTimeline>(`/admin/invoices/${id}/timeline/`, fetcher);

  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [lastMessage, setLastMessage]     = useState<string | null>(null);
  const [lastError, setLastError]         = useState<string | null>(null);

  const actions = invoice ? getActions(invoice) : [];

  const handleAction = async (action: ActionDef) => {
    if (!confirm(action.confirm)) return;
    setActionLoading(action.key);
    setLastMessage(null);
    setLastError(null);
    try {
      const res = await api.post(action.endpoint);
      setLastMessage(res.data.message ?? 'Done.');
      await Promise.all([mutateInv(), mutateTl()]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Action failed.';
      setLastError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = invLoading || tlLoading;

  // Current position in the simplified flow steps
  const currentStep = invoice?.fta_status === 'reported'
    ? 'fta'
    : invoice?.status ?? 'draft';

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {invoice?.invoice_number ?? '…'}
          </h1>
          {invoice && <StatusBadge status={invoice.status} />}
          {invoice?.fta_status === 'reported' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
              <CheckCircle2 className="h-3 w-3" /> FTA Reported
            </span>
          )}
        </div>
        <button
          onClick={() => { mutateInv(); mutateTl(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {/* ── Feedback banners ───────────────────────────────────────────── */}
          {lastMessage && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {lastMessage}
            </div>
          )}
          {lastError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {lastError}
            </div>
          )}

          {/* ── Admin Action Panel ─────────────────────────────────────────── */}
          {actions.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-blue-100 p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin Actions — Advance PEPPOL Flow
              </p>

              {/* Progress stepper */}
              <div className="flex items-center gap-0">
                {FLOW_STEPS.map((step, i) => {
                  const stepIdx    = FLOW_STEPS.indexOf(currentStep);
                  const isDone     = i < stepIdx || (step === 'fta' && invoice?.fta_status === 'reported');
                  const isCurrent  = step === currentStep;
                  return (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                          ${isDone    ? 'bg-emerald-500 border-emerald-500 text-white' :
                            isCurrent ? 'bg-blue-500 border-blue-500 text-white' :
                                        'bg-white border-gray-200 text-gray-400'}`}>
                          {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap
                          ${isDone ? 'text-emerald-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                          {FLOW_LABELS[step]}
                        </span>
                      </div>
                      {i < FLOW_STEPS.length - 1 && (
                        <div className={`h-0.5 w-10 mb-4 mx-1 ${i < stepIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      onClick={() => handleAction(action)}
                      disabled={actionLoading !== null}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                                  transition-colors disabled:opacity-50 ${action.color}`}
                    >
                      {actionLoading === action.key
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <Icon className="h-4 w-4" />
                      }
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed banner */}
          {invoice?.status === 'validated' && invoice.fta_status === 'reported' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Full 5-corner PEPPOL flow complete — invoice reported to FTA.
            </div>
          )}

          {/* ── PEPPOL 5-Corner Flow Tracker ───────────────────────────────── */}
          {timeline?.flow && <FlowTracker flow={timeline.flow} />}

          {/* ── Invoice Metadata ───────────────────────────────────────────── */}
          {invoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supplier (Corner 1)</p>
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">{invoice.company_name}</p>
                    {invoice.company_trn && <p className="text-sm text-gray-500">TRN: {invoice.company_trn}</p>}
                  </div>
                </div>
                {invoice.created_by_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <User className="h-4 w-4 shrink-0" />
                    Created by {invoice.created_by_name}
                  </div>
                )}
              </div>

              {/* Buyer */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Buyer (Corner 4)</p>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <p className="font-semibold text-gray-900">{invoice.customer_name || '—'}</p>
                </div>
              </div>

              {/* Invoice details */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Invoice #</span>
                    <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Type</span>
                    <span className="text-gray-700">{invoice.type_display}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Issue Date</span>
                    <span className="text-gray-700">
                      {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-AE') : '—'}
                    </span>
                  </div>
                  {invoice.asp_submission_id && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 shrink-0">ASP ID</span>
                      <span className="font-mono text-xs text-gray-600 text-right truncate">{invoice.asp_submission_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Financials</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700">
                      {invoice.currency} {parseFloat(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT</span>
                    <span className="text-gray-700">
                      {invoice.currency} {parseFloat(invoice.total_vat).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">
                      {invoice.currency} {parseFloat(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Event Log ──────────────────────────────────────────────────── */}
          {timeline?.events && timeline.events.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Event Log</p>
              <div className="space-y-3">
                {[...timeline.events].reverse().map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      event.status === 'complete'   ? 'bg-emerald-500' :
                      event.status === 'processing' ? 'bg-blue-500' :
                      event.status === 'error'      ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <span className="text-xs text-gray-400">
                          Corner {event.corner}
                          {event.timestamp && ` · ${new Date(event.timestamp).toLocaleString('en-AE')}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
