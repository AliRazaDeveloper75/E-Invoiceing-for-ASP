'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  CheckCircle2, XCircle, AlertTriangle, Info, ChevronLeft,
  Clock, FileText, User, RefreshCw,
  Mail, ShieldCheck, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Observation {
  id: string;
  rule_code: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  field_name: string;
  message: string;
  suggestion: string;
  line_number: number | null;
  included_in_email: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  from_status: string;
  to_status: string;
  event: string;
}

interface InboundDetail {
  id: string;
  supplier: {
    id: string; name: string; trn: string; email: string; phone: string;
  };
  company_name: string;
  channel: string;
  received_at: string;
  status: string;
  supplier_invoice_number: string;
  invoice_type: string;
  transaction_type: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: string;
  total_vat: string;
  total_amount: string;
  purchase_order_ref: string;
  notes: string;
  validation_score: number | null;
  has_critical_errors: boolean;
  observation_count: number;
  observation_sent_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reviewer_notes: string;
  fta_submission_id: string;
  fta_submitted_at: string | null;
  fta_response: unknown;
  items: Array<{
    id: string; line_number: number; description: string;
    quantity: string; unit: string; unit_price: string;
    vat_rate: string; subtotal: string; total_amount: string;
  }>;
  observations: Observation[];
  audit_log: AuditEntry[];
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: { icon: XCircle,       color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200' },
  high:     { icon: AlertTriangle, color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  medium:   { icon: AlertCircle,   color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  info:     { icon: Info,          color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
};

const STATUS_LABEL: Record<string, string> = {
  received:          'Received',
  validating:        'Validating',
  validation_failed: 'Validation Failed',
  pending_review:    'Pending Review',
  approved:          'Approved',
  rejected:          'Rejected',
  fta_submitted:     'FTA Submitted',
  fta_accepted:      'FTA Accepted',
  fta_rejected:      'FTA Rejected',
};

const STATUS_COLOR: Record<string, string> = {
  received:          'text-blue-700 bg-blue-50 border-blue-200',
  validating:        'text-yellow-700 bg-yellow-50 border-yellow-200',
  validation_failed: 'text-red-700 bg-red-50 border-red-200',
  pending_review:    'text-orange-700 bg-orange-50 border-orange-200',
  approved:          'text-emerald-700 bg-emerald-50 border-emerald-200',
  rejected:          'text-red-700 bg-red-50 border-red-200',
  fta_submitted:     'text-indigo-700 bg-indigo-50 border-indigo-200',
  fta_accepted:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  fta_rejected:      'text-red-700 bg-red-50 border-red-200',
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <Icon className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  );
}

function fetcher(url: string) {
  return api.get(url).then((r) => r.data);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InboundDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, mutate } = useSWR(`/inbound/${id}/`, fetcher);
  const invoice: InboundDetail | null = data?.data ?? null;

  const [approveNotes, setApproveNotes]   = useState('');
  const [rejectNotes, setRejectNotes]     = useState('');
  const [customMsg, setCustomMsg]         = useState('');
  const [submitting, setSubmitting]       = useState<string | null>(null);

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2 });

  const handleApprove = async () => {
    setSubmitting('approve');
    try {
      await api.post(`/inbound/${id}/approve/`, { reviewer_notes: approveNotes });
      mutate();
    } finally { setSubmitting(null); }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) { alert('Please provide a rejection reason.'); return; }
    setSubmitting('reject');
    try {
      await api.post(`/inbound/${id}/reject/`, { reviewer_notes: rejectNotes });
      mutate();
    } finally { setSubmitting(null); }
  };

  const handleResendObs = async () => {
    setSubmitting('resend');
    try {
      await api.post(`/inbound/${id}/resend-observation/`, { custom_message: customMsg });
      alert('Observation email sent to supplier.');
      mutate();
    } finally { setSubmitting(null); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <AlertTriangle className="h-8 w-8 mb-3" />
        <p>Invoice not found.</p>
      </div>
    );
  }

  const criticalObs = invoice.observations.filter((o) => o.severity === 'critical');
  const otherObs    = invoice.observations.filter((o) => o.severity !== 'critical');

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/inbound')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Inbound
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900 font-mono">
            {invoice.supplier_invoice_number}
          </span>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLOR[invoice.status] ?? 'text-gray-700 bg-gray-50 border-gray-200'}`}>
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </span>
      </div>

      {/* Critical alert banner */}
      {invoice.has_critical_errors && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              This invoice has {criticalObs.length} critical issue{criticalObs.length !== 1 ? 's' : ''} — cannot be approved until resolved.
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              An observation email has been or should be sent to the supplier to request a corrected resubmission.
            </p>
          </div>
        </div>
      )}

      {invoice.validation_score !== null && !invoice.has_critical_errors && invoice.observations.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800">
            Invoice passed validation with a score of <strong>{invoice.validation_score}/100</strong>.
            There are {invoice.observations.length} warning(s) — review before approving.
          </p>
        </div>
      )}

      {invoice.status === 'pending_review' && !invoice.has_critical_errors && invoice.observations.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Invoice passed all validation checks — score {invoice.validation_score}/100. Ready for approval.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: invoice info */}
        <div className="lg:col-span-2 space-y-5">

          {/* Invoice Details */}
          <Section title="Invoice Details" icon={FileText}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <Row label="Invoice Number"   value={<span className="font-mono">{invoice.supplier_invoice_number}</span>} />
                <Row label="Invoice Type"     value={invoice.invoice_type.replace('_', ' ')} />
                <Row label="Transaction Type" value={invoice.transaction_type.toUpperCase()} />
                <Row label="Issue Date"       value={invoice.issue_date} />
                <Row label="Due Date"         value={invoice.due_date ?? '—'} />
              </div>
              <div>
                <Row label="Currency"         value={invoice.currency} />
                <Row label="Subtotal"         value={`${fmtAmt(invoice.subtotal)} ${invoice.currency}`} />
                <Row label="VAT"              value={`${fmtAmt(invoice.total_vat)} ${invoice.currency}`} />
                <Row label="Total Amount"     value={<span className="font-bold">{fmtAmt(invoice.total_amount)} {invoice.currency}</span>} />
                <Row label="Channel"          value={invoice.channel} />
              </div>
            </div>
          </Section>

          {/* Supplier */}
          <Section title="Supplier" icon={User}>
            <Row label="Name"    value={invoice.supplier.name} />
            <Row label="TRN"     value={<span className="font-mono">{invoice.supplier.trn}</span>} />
            <Row label="Email"   value={invoice.supplier.email} />
            <Row label="Phone"   value={invoice.supplier.phone || '—'} />
          </Section>

          {/* Line Items */}
          <Section title="Line Items" icon={FileText}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-semibold">#</th>
                  <th className="text-left pb-2 font-semibold">Description</th>
                  <th className="text-right pb-2 font-semibold">Qty</th>
                  <th className="text-right pb-2 font-semibold">Unit Price</th>
                  <th className="text-right pb-2 font-semibold">VAT %</th>
                  <th className="text-right pb-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-gray-400">{item.line_number}</td>
                    <td className="py-2 text-gray-800">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-2 text-right">{fmtAmt(item.unit_price)}</td>
                    <td className="py-2 text-right">{item.vat_rate}%</td>
                    <td className="py-2 text-right font-semibold">{fmtAmt(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Observations */}
          {invoice.observations.length > 0 && (
            <Section title={`Validation Observations (${invoice.observations.length})`} icon={AlertTriangle}>
              <div className="space-y-2">
                {[...criticalObs, ...otherObs].map((obs) => {
                  const cfg = SEV[obs.severity] ?? SEV.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={obs.id} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${cfg.color}`}>[{obs.severity.toUpperCase()}]</span>
                            <span className="text-xs font-mono text-gray-500">{obs.rule_code}</span>
                            {obs.field_name && (
                              <span className="text-xs text-gray-400">· {obs.field_name}</span>
                            )}
                            {obs.line_number && (
                              <span className="text-xs text-gray-400">· Line {obs.line_number}</span>
                            )}
                            {obs.included_in_email && (
                              <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                Sent to supplier
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 mt-0.5">{obs.message}</p>
                          {obs.suggestion && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">
                              Action: {obs.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Audit Log */}
          <Section title="Audit Trail" icon={Clock}>
            <div className="space-y-2">
              {invoice.audit_log.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-xs">
                  <div className="text-gray-400 shrink-0 w-36">
                    {new Date(entry.timestamp).toLocaleString('en-AE', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-700">{entry.event}</span>
                    {entry.from_status && (
                      <span className="text-gray-400 ml-1">
                        ({entry.from_status} → {entry.to_status})
                      </span>
                    )}
                    <span className="text-gray-400 ml-1">by {entry.actor_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Right column: actions */}
        <div className="space-y-4">

          {/* Validation Score */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Validation Score</p>
            {invoice.validation_score !== null ? (
              <div className="text-center">
                <div className={`text-5xl font-bold mb-1 ${
                  invoice.validation_score >= 80 ? 'text-emerald-500' :
                  invoice.validation_score >= 50 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {invoice.validation_score}
                  <span className="text-xl text-gray-300">/100</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      invoice.validation_score >= 80 ? 'bg-emerald-500' :
                      invoice.validation_score >= 50 ? 'bg-orange-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${invoice.validation_score}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {invoice.observation_count} finding{invoice.observation_count !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">Not yet validated</p>
            )}
          </div>

          {/* Approval actions */}
          {invoice.status === 'pending_review' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Decision</p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Approval notes…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleApprove}
                disabled={submitting === 'approve' || invoice.has_critical_errors}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting === 'approve' ? 'Approving…' : 'Approve Invoice'}
              </button>

              <div className="border-t border-gray-100 pt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Rejection reason *</label>
                <textarea
                  rows={2}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explain why this invoice is rejected…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={handleReject}
                  disabled={submitting === 'reject'}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                             bg-red-50 hover:bg-red-100 text-red-700 border border-red-200
                             text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {submitting === 'reject' ? 'Rejecting…' : 'Reject Invoice'}
                </button>
              </div>
            </div>
          )}

          {/* Resend observation */}
          {['validation_failed', 'pending_review'].includes(invoice.status) &&
            invoice.observations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Observation Email
              </p>
              {invoice.observation_sent_at && (
                <p className="text-xs text-gray-400">
                  Last sent: {new Date(invoice.observation_sent_at).toLocaleString('en-AE')}
                </p>
              )}
              <textarea
                rows={2}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder="Optional custom message to supplier…"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleResendObs}
                disabled={submitting === 'resend'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-[#1e3a5f] hover:bg-[#172f4d] text-white text-sm font-semibold
                           transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {submitting === 'resend' ? 'Sending…' : 'Resend to Supplier'}
              </button>
            </div>
          )}

          {/* Approved / FTA status */}
          {['approved', 'fta_submitted', 'fta_accepted', 'fta_rejected'].includes(invoice.status) && (
            <div className="bg-white rounded-xl border border-emerald-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">
                  {invoice.status === 'approved' ? 'Approved' : 'FTA Submission'}
                </p>
              </div>
              {invoice.reviewed_by_name && (
                <Row label="Reviewed by" value={invoice.reviewed_by_name} />
              )}
              {invoice.reviewed_at && (
                <Row label="Reviewed at"  value={new Date(invoice.reviewed_at).toLocaleString('en-AE')} />
              )}
              {invoice.reviewer_notes && (
                <Row label="Notes" value={invoice.reviewer_notes} />
              )}
              {invoice.fta_submission_id && (
                <Row label="FTA Ref" value={<span className="font-mono text-xs">{invoice.fta_submission_id}</span>} />
              )}
            </div>
          )}

          {/* Rejected info */}
          {invoice.status === 'rejected' && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm font-semibold text-red-800">Rejected</p>
              </div>
              <p className="text-xs text-red-700">{invoice.reviewer_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
