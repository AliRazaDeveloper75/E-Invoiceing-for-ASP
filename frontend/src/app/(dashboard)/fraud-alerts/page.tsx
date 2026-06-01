'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Resolve Fraud Alert</h2>
          <p className="text-sm text-gray-500 mt-0.5">Invoice {alert.invoice_number}</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Add a resolution note explaining your decision (optional).
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Verified with supplier — legitimate invoice."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={resolve}
            disabled={loading}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2"
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
    <div className={`bg-white rounded-2xl border ${cfg.border} p-5 space-y-4`}>
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
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
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
            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fraud Detection</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered invoice anomaly detection. Alerts are generated automatically for all submitted invoices.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts',   value: stats.total,  color: 'text-gray-700',   icon: ShieldAlert },
          { label: 'High Risk',      value: stats.high,   color: 'text-red-600',    icon: ShieldX },
          { label: 'Medium Risk',    value: stats.medium, color: 'text-yellow-600', icon: ShieldAlert },
          { label: 'Low Risk',       value: stats.low,    color: 'text-green-600',  icon: ShieldCheck },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
              ? 'bg-gray-200 text-gray-700 border-gray-300'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {showResolved ? 'Showing Resolved' : 'Show Resolved'}
        </button>

        <button
          onClick={() => mutate(`/fraud/alerts/?${params}`)}
          className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alert grid */}
      {isLoading ? (
        <div className="py-16 flex items-center justify-center text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No fraud alerts found</p>
          <p className="text-xs mt-1 text-gray-400">
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

      {/* Resolve modal */}
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
