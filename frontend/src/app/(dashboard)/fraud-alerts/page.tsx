'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX, CheckCircle, RefreshCw, Eye, X } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FraudFlag {
  code: string;
  description: string;
  severity: number;
  category: string;
}

interface FraudAlert {
  id: string;
  invoice_id: string;
  invoice_number: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  auto_action: string;
  is_flagged: boolean;
  flags: FraudFlag[];
  duplicate_invoice_ids: string[];
  ai_explanation: string;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_note: string;
  analyzed_at: string | null;
  created_at: string;
}

// ─── Risk config ────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:    { label: 'Low Risk',    color: 'bg-green-100 text-green-700',  border: 'border-green-200',  icon: ShieldCheck, bar: 'bg-green-500' },
  medium: { label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200', icon: ShieldAlert, bar: 'bg-yellow-500' },
  high:   { label: 'High Risk',   color: 'bg-red-100 text-red-700',     border: 'border-red-200',    icon: ShieldX,    bar: 'bg-red-500' },
};

const CATEGORY_COLORS: Record<string, string> = {
  duplicate: 'bg-red-100 text-red-700',
  amount:    'bg-orange-100 text-orange-700',
  vat:       'bg-yellow-100 text-yellow-700',
  supplier:  'bg-blue-100 text-blue-700',
  pattern:   'bg-purple-100 text-purple-700',
  timing:    'bg-gray-100 text-gray-700',
};

// ─── Resolve Modal ─────────────────────────────────────────────────────────────

function ResolveModal({ alert, onClose, onResolved }: {
  alert: FraudAlert;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setLoading(true);
    setError(null);
    try {
      await api.put(`/invoices/${alert.invoice_id}/fraud/resolve/`, { resolution_note: note });
      onResolved();
      onClose();
    } catch {
      setError('Failed to resolve alert. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent">
        <div className="flex items-center justify-between px-6 py-5 border-b border-blue-100/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resolve Fraud Alert</h2>
              <p className="text-sm text-gray-500 mt-0.5">Invoice {alert.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Add a resolution note explaining your decision (optional).
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Verified with supplier — legitimate invoice."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={resolve}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onResolve, onViewInvoice }: {
  alert: FraudAlert;
  onResolve: (a: FraudAlert) => void;
  onViewInvoice: (id: string) => void;
}) {
  const cfg = RISK_CONFIG[alert.risk_level];
  const RiskIcon = cfg.icon;
  const scorePct = Math.round(alert.risk_score * 100);

  return (
    <div className={`group relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border ${cfg.border} shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] p-5 space-y-4 hover:shadow-[0_12px_40px_-8px_rgba(59,130,246,0.2),0_2px_6px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-[3px] transition-all duration-300 before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.color}`}>
            <RiskIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{alert.invoice_number}</p>
            <p className="text-xs text-gray-400">{new Date(alert.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
          {alert.is_resolved && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Resolved
            </span>
          )}
        </div>
      </div>

      {/* Risk score bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Risk Score</span>
          <span className="font-semibold text-gray-800">{scorePct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${scorePct}%` }} />
        </div>
      </div>

      {/* Flags */}
      {alert.flags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">Detected Issues</p>
          <div className="flex flex-wrap gap-1.5">
            {alert.flags.map((flag, i) => (
              <span
                key={i}
                title={flag.description}
                className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[flag.category] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {flag.code.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI explanation */}
      {alert.ai_explanation && (
        <div className="bg-gray-50/80 rounded-xl p-3 text-xs text-gray-700 leading-relaxed border border-gray-100/60">
          <span className="font-medium text-gray-500 mr-1">AI:</span>
          {alert.ai_explanation}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onViewInvoice(alert.invoice_id)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> View Invoice
        </button>
        {!alert.is_resolved && (
          <button
            onClick={() => onResolve(alert)}
            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Resolve
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => api.get(url).then(r => r.data.data);

export default function FraudAlertsPage() {
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [resolveAlert, setResolveAlert] = useState<FraudAlert | null>(null);

  const params = new URLSearchParams();
  if (filter !== 'all') params.set('risk_level', filter);
  params.set('is_resolved', showResolved ? 'true' : 'false');
  const { data, isLoading } = useSWR(`/fraud/alerts/?${params}`, fetcher, { refreshInterval: 30000 });

  const alerts: FraudAlert[] = data?.results ?? [];

  const stats = {
    high:   alerts.filter(a => a.risk_level === 'high').length,
    medium: alerts.filter(a => a.risk_level === 'medium').length,
    low:    alerts.filter(a => a.risk_level === 'low').length,
    total:  alerts.length,
  };

  function handleViewInvoice(invoiceId: string) {
    window.open(`/invoices/${invoiceId}`, '_blank');
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-950 to-indigo-950 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300/70 uppercase tracking-[0.12em]">Fraud Detection</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Fraud Detection</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">
              AI-powered invoice anomaly detection. Alerts are generated automatically for all submitted invoices.
            </p>
          </div>
          <button
            onClick={() => mutate(`/fraud/alerts/?${params}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-950 hover:bg-blue-50 px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 shrink-0"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts',   value: stats.total,  icon: ShieldAlert, gradient: 'from-blue-500 to-blue-600',   shadow: 'shadow-blue-500/25', textColor: 'text-gray-900' },
          { label: 'High Risk',      value: stats.high,   icon: ShieldX,    gradient: 'from-red-500 to-red-600',     shadow: 'shadow-red-500/25',  textColor: 'text-red-600' },
          { label: 'Medium Risk',    value: stats.medium, icon: ShieldAlert, gradient: 'from-yellow-500 to-yellow-600', shadow: 'shadow-yellow-500/25', textColor: 'text-yellow-600' },
          { label: 'Low Risk',       value: stats.low,    icon: ShieldCheck, gradient: 'from-green-500 to-green-600', shadow: 'shadow-green-500/25', textColor: 'text-green-600' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_-8px_rgba(59,130,246,0.2),0_2px_6px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-[3px] transition-all duration-300 before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg ${s.shadow}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${s.textColor}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex bg-blue-50/60 rounded-xl p-1 gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
                filter === f ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-blue-600'
              }`}
            >
              {f === 'all' ? 'All' : `${f.charAt(0).toUpperCase() + f.slice(1)}`}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowResolved(r => !r)}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl border transition-all ${
            showResolved
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {showResolved ? 'Showing Resolved' : 'Show Resolved'}
        </button>
      </div>

      {/* ── Alert grid ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] py-20 flex items-center justify-center text-gray-400 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] py-16 text-center relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-blue-400" />
          </div>
          <p className="text-base font-semibold text-gray-900">No fraud alerts found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filter !== 'all' ? 'Try changing the filter above.' : 'AI analysis runs automatically on all submitted invoices.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={setResolveAlert}
              onViewInvoice={handleViewInvoice}
            />
          ))}
        </div>
      )}

      {/* ── Resolve Modal ────────────────────────────────────── */}
      {resolveAlert && (
        <ResolveModal
          alert={resolveAlert}
          onClose={() => setResolveAlert(null)}
          onResolved={() => mutate(`/fraud/alerts/?${params}`)}
        />
      )}
    </div>
  );
}
