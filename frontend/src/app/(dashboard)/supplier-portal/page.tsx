'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  FileText, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, RefreshCw, Inbox, TrendingUp, PlusCircle,
} from 'lucide-react';

interface PortalStats {
  total: number;
  pending_review: number;
  validation_failed: number;
  approved: number;
  rejected: number;
  fta_accepted: number;
  total_value: string | null;
}

interface RecentInvoice {
  id: string;
  supplier_invoice_number: string;
  invoice_type: string;
  issue_date: string;
  currency: string;
  total_amount: string;
  status: string;
  validation_score: number | null;
  has_critical_errors: boolean;
  received_at: string;
}

interface PortalData {
  supplier: { name: string; trn: string; email: string; api_key_prefix: string; receiving_company_name: string };
  stats: PortalStats;
  recent_invoices: RecentInvoice[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:          { label: 'Received',         color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  validating:        { label: 'Validating',        color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200' },
  validation_failed: { label: 'Validation Failed', color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  pending_review:    { label: 'Pending Review',    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  approved:          { label: 'Approved',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  rejected:          { label: 'Rejected',          color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  fta_submitted:     { label: 'FTA Submitted',     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  fta_accepted:      { label: 'FTA Accepted',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data.data as PortalData;
}

export default function SupplierPortalPage() {
  const { user } = useAuth();
  const { data, isLoading, error, mutate } = useSWR('/inbound/portal/', fetcher);

  const fmtAmt = (v: string | number) =>
    Number(v ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading your portal…
      </div>
    );
  }

  // 404 = no Supplier profile linked to this account (self-registered user)
  if (error || !data?.supplier) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">No supplier profile found</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your account (<span className="font-medium text-gray-700">{user?.email}</span>) is not
          linked to a supplier profile yet.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left space-y-2">
          <p className="font-semibold">What to do next:</p>
          <ol className="list-decimal list-inside space-y-1 text-amber-700">
            <li>Contact the company you are submitting invoices to.</li>
            <li>Ask them to add you as a supplier in their management panel.</li>
            <li>You will receive an activation email with a link to set your password.</li>
            <li>Sign in using the activation link — your portal will be ready.</li>
          </ol>
        </div>
        <p className="text-xs text-gray-400">
          If you already received an activation email, please sign out and use the activation link
          to set up your account.
        </p>
      </div>
    );
  }

  const { supplier, stats, recent_invoices } = data;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.first_name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Supplier Portal — track your submitted invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/supplier-portal/submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white
                       text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" /> Submit Invoice
          </Link>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200
                       text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Supplier profile card */}
      {supplier && (
        <div className="bg-gradient-to-r from-brand-900 to-indigo-900 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Registered As</p>
              <h2 className="text-xl font-bold">{supplier.name}</h2>
              <p className="text-white/60 text-sm mt-1">TRN: {supplier.trn}</p>
              <p className="text-white/60 text-sm">
                Submitting to: <span className="text-white/80 font-medium">{supplier.receiving_company_name}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">API Key Prefix</p>
              <p className="font-mono text-white/80 text-sm">{supplier.api_key_prefix}…</p>
              <p className="text-xs text-white/40 mt-1">Use X-Supplier-Key header to submit</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Submitted', value: stats.total ?? 0,             icon: FileText,     color: 'bg-blue-100 text-blue-600' },
          { label: 'Pending Review',  value: stats.pending_review ?? 0,    icon: Clock,        color: 'bg-orange-100 text-orange-600' },
          { label: 'Failed',          value: stats.validation_failed ?? 0, icon: AlertTriangle,color: 'bg-red-100 text-red-600' },
          { label: 'Approved',        value: stats.approved ?? 0,          icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Rejected',        value: stats.rejected ?? 0,          icon: XCircle,      color: 'bg-red-100 text-red-600' },
          { label: 'FTA Accepted',    value: stats.fta_accepted ?? 0,      icon: TrendingUp,   color: 'bg-indigo-100 text-indigo-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Total value */}
      {stats.total_value && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Invoice Value Submitted</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              AED {fmtAmt(stats.total_value)}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-emerald-400" />
        </div>
      )}

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Invoices</h3>
          <Link
            href="/supplier-portal/invoices"
            className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recent_invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Inbox className="h-10 w-10 mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No invoices submitted yet</p>
            <p className="text-sm mt-1">
              Use your API key with the <code className="bg-gray-100 px-1 rounded">X-Supplier-Key</code> header
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent_invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {inv.supplier_invoice_number}
                    </span>
                    {inv.has_critical_errors && (
                      <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        Critical
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">
                    {fmtAmt(inv.total_amount)} {inv.currency}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {inv.validation_score !== null ? (
                      <span className={`font-bold text-sm ${
                        inv.validation_score >= 80 ? 'text-emerald-600' :
                        inv.validation_score >= 50 ? 'text-orange-500' : 'text-red-600'
                      }`}>
                        {inv.validation_score}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* API submission guide */}
      <div className="bg-gray-900 rounded-2xl p-6 text-white">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" /> Submit an Invoice via API
        </h3>
        <pre className="text-xs text-white/70 leading-relaxed overflow-x-auto">{`curl -X POST http://your-server/api/v1/inbound/submit/ \\
  -H "Content-Type: application/json" \\
  -H "X-Supplier-Key: <your-api-key>" \\
  -d '{
    "supplier_invoice_number": "INV-2024-001",
    "invoice_type": "tax_invoice",
    "transaction_type": "b2b",
    "issue_date": "2024-04-17",
    "currency": "AED",
    "subtotal": 1000.00,
    "total_vat": 50.00,
    "total_amount": 1050.00,
    "items": [{ "line_number": 1, "description": "Services",
                "quantity": 1, "unit_price": 1000, "vat_rate": 5 }]
  }'`}</pre>
      </div>
    </div>
  );
}
