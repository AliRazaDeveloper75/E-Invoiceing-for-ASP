'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { FlowTracker } from '@/components/invoice/FlowTracker';
import { PDFDownloadButton } from '@/components/invoice/PDFDownloadButton';
import type { InvoiceTimeline } from '@/types';
import {
  ArrowLeft, RefreshCw, Send, ShieldCheck, ShieldX,
  Landmark, CheckCircle2, XCircle, Clock, FileText,
  Building2, User, Calendar, Hash, AlertTriangle, Download, Ban,
} from 'lucide-react';

async function downloadFile(url: string, filename: string, mimeType: string) {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    alert('File could not be downloaded.');
  }
}

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
  xml_file: string | null;
  deactivation_reason?: string;
  created_by_name: string;
  created_at: string;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:       { label: 'Draft',       color: 'text-gray-600',    bg: 'bg-gradient-to-r from-gray-100 to-gray-50',      icon: FileText },
  pending:     { label: 'Pending',     color: 'text-blue-600',    bg: 'bg-gradient-to-r from-blue-100 to-blue-50',      icon: Clock },
  submitted:   { label: 'Submitted',   color: 'text-indigo-600',  bg: 'bg-gradient-to-r from-indigo-100 to-indigo-50',    icon: Send },
  validated:   { label: 'Validated',   color: 'text-emerald-600', bg: 'bg-gradient-to-r from-emerald-100 to-emerald-50',   icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    color: 'text-red-600',     bg: 'bg-gradient-to-r from-red-100 to-red-50',       icon: XCircle },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500',   bg: 'bg-gradient-to-r from-slate-100 to-slate-50',     icon: XCircle },
  deactivated: { label: 'Deactivated', color: 'text-amber-700',   bg: 'bg-gradient-to-r from-amber-100 to-amber-50',     icon: Ban },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gradient-to-r from-gray-100 to-gray-50', icon: FileText };
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
      color: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-sm',
      endpoint: `/admin/invoices/${invoice.id}/submit/`,
      confirm: `Submit invoice ${num} to ASP for validation?`,
    });
  }

  if (invoice.status === 'pending' || invoice.status === 'submitted') {
    actions.push({
      key: 'approve',
      label: 'Approve — ASP Validated',
      icon: ShieldCheck,
      color: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-sm',
      endpoint: `/admin/invoices/${invoice.id}/approve-asp/`,
      confirm: `Mark invoice ${num} as validated by ASP?\n\nThis advances the E-Invoice flow through Corners 2, 3 and 4.`,
    });
    actions.push({
      key: 'reject',
      label: 'Reject — ASP Rejected',
      icon: ShieldX,
      color: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-sm',
      endpoint: `/admin/invoices/${invoice.id}/reject-asp/`,
      confirm: `Reject invoice ${num}? This marks it as rejected by ASP.`,
    });
  }

  if ((invoice.status === 'validated' || invoice.status === 'paid') && invoice.fta_status !== 'reported') {
    actions.push({
      key: 'fta',
      label: 'Report to FTA',
      icon: Landmark,
      color: 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white shadow-sm',
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

  // Full invoice (with items + company) for the premium client-side PDF,
  // so the admin PDF matches the supplier/buyer PDF exactly.
  const { data: fullInvoice } = useSWR(id ? `/invoices/${id}/` : null, fetcher);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfCompany: any = fullInvoice ? {
    name:           fullInvoice.company_name,
    legal_name:     fullInvoice.company_legal_name,
    trn:            fullInvoice.company_trn,
    logo_url:       fullInvoice.company_logo,
    street_address: fullInvoice.company_street_address,
    city:           fullInvoice.company_city,
    emirate:        fullInvoice.company_emirate,
    po_box:         fullInvoice.company_po_box,
    country:        fullInvoice.company_country,
    phone:          fullInvoice.company_phone,
    email:          fullInvoice.company_email,
    website:        fullInvoice.company_website,
  } : null;

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

      {/* ── Gradient Card Header ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-2xl p-6 shadow-[0_8px_30px_-8px_rgba(59,130,246,0.15)] border border-blue-100/70 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-gray-200/80 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200/60 transition-all shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.12em]">Invoice Detail</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {invoice?.invoice_number ?? '…'}
              </h1>
              {invoice && <StatusBadge status={invoice.status} />}
              {invoice?.fta_status === 'reported' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-teal-100 to-teal-50 text-teal-700">
                  <CheckCircle2 className="h-3 w-3" /> FTA Reported
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fullInvoice && (
              // Premium client-side PDF — identical to the supplier/buyer download.
              <PDFDownloadButton invoice={fullInvoice} company={pdfCompany} />
            )}
            {invoice && (
              <button
                onClick={() => downloadFile(
                  `/invoices/${invoice.id}/download-xml/`,
                  `${invoice.invoice_number}.xml`,
                  'application/xml',
                )}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all duration-200"
              >
                <Download className="h-3.5 w-3.5" /> XML
              </button>
            )}
            <button
              onClick={() => { mutateInv(); mutateTl(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200/60 transition-all shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {/* ── Feedback banners ───────────────────────────────────────────── */}
          {lastMessage && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/80 border border-emerald-200 text-emerald-700 text-sm font-medium shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {lastMessage}
            </div>
          )}
          {lastError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-red-50 to-red-50/80 border border-red-200 text-red-700 text-sm font-medium shadow-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {lastError}
            </div>
          )}
          {invoice?.status === 'deactivated' && (
            <div className="rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/80 border border-amber-200 px-4 py-3 text-sm text-amber-800 shadow-sm">
              <p className="font-semibold flex items-center gap-1.5"><Ban className="h-4 w-4" /> This invoice has been deactivated.</p>
              {invoice.deactivation_reason && (
                <p className="mt-1"><span className="font-medium">Reason:</span> {invoice.deactivation_reason}</p>
              )}
            </div>
          )}

          {/* ── Admin Action Panel — 3D card ───────────────────────────────── */}
          {actions.length > 0 && (
            <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-4 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin Actions — Advance E-Invoice Flow
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
                          ${isDone    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-500 text-white shadow-sm' :
                            isCurrent ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-500 text-white shadow-sm' :
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
                                  transition-all duration-200 disabled:opacity-50 ${action.color}`}
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
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-50 to-teal-50/80 border border-teal-200 text-teal-700 text-sm font-medium shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Full 5-corner E-Invoice flow complete — invoice reported to FTA.
            </div>
          )}

          {/* ── 5-Corner Flow Tracker ───────────────────────────────── */}
          {timeline?.flow && <FlowTracker flow={timeline.flow} />}

          {/* ── Invoice Metadata — 3D cards ────────────────────────────────── */}
          {invoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-3 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supplier</p>
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
              <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-3 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Buyer</p>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <p className="font-semibold text-gray-900">{invoice.customer_name || '—'}</p>
                </div>
              </div>

              {/* Invoice details */}
              <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-3 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
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
              <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-3 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
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
                  <div className="flex justify-between border-t border-blue-100/40 pt-2">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">
                      {invoice.currency} {parseFloat(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Event Log — 3D card ────────────────────────────────────────── */}
          {timeline?.events && timeline.events.length > 0 && (
            <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] space-y-4 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Log</p>
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
