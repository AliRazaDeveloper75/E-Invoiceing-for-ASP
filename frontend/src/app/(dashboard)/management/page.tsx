'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  Users, FileText, Building2, CheckCircle2,
  XCircle, Clock, RefreshCw,
  Send, Landmark, ShieldCheck, ArrowRight,
} from 'lucide-react';

function fetcher(url: string) {
  return api.get(url).then((r) => r.data.data);
}

interface AdminStats {
  users: {
    total: number; active: number; inactive: number;
    by_role: Record<string, number>;
  };
  companies: { total: number };
  invoices: {
    total: number;
    by_status: Record<string, number>;
    asp_pending: number;
    fta_pending: number;
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, href,
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {href && <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({
  title, subtitle, count, urgent, href, icon: Icon, color,
}: {
  title: string; subtitle: string; count: number; urgent?: boolean;
  href: string; icon: React.ElementType; color: string;
}) {
  return (
    <Link href={href}>
      <div className={`bg-white rounded-xl border-2 p-5 hover:shadow-md transition-all ${urgent && count > 0 ? 'border-red-300' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          {count > 0 && (
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${urgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {count}
            </span>
          )}
        </div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600">
          Manage <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { data: stats, isLoading, mutate } = useSWR<AdminStats>(
    '/admin/stats/',
    fetcher,
    { refreshInterval: 30000 },
  );

  const inv = stats?.invoices;
  const usr = stats?.users;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Platform management — users, invoices, ASP verification and FTA reporting
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading stats…
        </div>
      ) : (
        <>
          {/* ── Platform stats ──────────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Users"    value={usr?.total ?? 0}             sub={`${usr?.active ?? 0} active`}         icon={Users}      color="bg-blue-100 text-blue-600"    href="/management/users" />
              <StatCard label="Companies"      value={stats?.companies.total ?? 0}  sub="registered"                           icon={Building2}  color="bg-violet-100 text-violet-600" />
              <StatCard label="Total Invoices" value={inv?.total ?? 0}              sub="across all companies"                  icon={FileText}   color="bg-indigo-100 text-indigo-600" href="/management/invoices" />
              <StatCard label="Validated"      value={inv?.by_status?.validated ?? 0} sub="accepted by ASP"                   icon={CheckCircle2} color="bg-emerald-100 text-emerald-600" />
            </div>
          </div>

          {/* ── Invoice status breakdown ─────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Invoice Status Breakdown</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { key: 'draft',     label: 'Draft',       color: 'text-gray-600',   bg: 'bg-gray-100',    icon: FileText },
                { key: 'pending',   label: 'Pending',     color: 'text-blue-600',   bg: 'bg-blue-100',    icon: Clock },
                { key: 'submitted', label: 'Submitted',   color: 'text-indigo-600', bg: 'bg-indigo-100',  icon: Send },
                { key: 'validated', label: 'Validated',   color: 'text-emerald-600',bg: 'bg-emerald-100', icon: CheckCircle2 },
                { key: 'rejected',  label: 'Rejected',    color: 'text-red-600',    bg: 'bg-red-100',     icon: XCircle },
                { key: 'cancelled', label: 'Cancelled',   color: 'text-slate-500',  bg: 'bg-slate-100',   icon: XCircle },
              ].map(({ key, label, color, bg, icon: Icon }) => (
                <div key={key} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${bg} ${color} mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{inv?.by_status?.[key] ?? 0}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Action queues ────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Action Queues</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <QueueCard
                title="User Management"
                subtitle="Create, edit roles, activate/deactivate platform users"
                count={usr?.inactive ?? 0}
                href="/management/users"
                icon={Users}
                color="bg-blue-100 text-blue-600"
              />
              <QueueCard
                title="All Invoices"
                subtitle="View and manage invoices across all companies"
                count={inv?.total ?? 0}
                href="/management/invoices"
                icon={FileText}
                color="bg-indigo-100 text-indigo-600"
              />
              <QueueCard
                title="ASP Verification Queue"
                subtitle="Review draft invoices and submit to PEPPOL / ASP"
                count={inv?.asp_pending ?? 0}
                urgent
                href="/management/asp"
                icon={ShieldCheck}
                color="bg-orange-100 text-orange-600"
              />
              <QueueCard
                title="FTA Reporting Queue"
                subtitle="Report validated invoices to the FTA data platform"
                count={inv?.fta_pending ?? 0}
                urgent
                href="/management/asp?tab=fta"
                icon={Landmark}
                color="bg-teal-100 text-teal-600"
              />
            </div>
          </div>

          {/* ── User role breakdown ──────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">User Roles</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { role: 'admin',      label: 'Admins',       color: 'bg-red-100 text-red-600' },
                { role: 'supplier',   label: 'Suppliers',    color: 'bg-blue-100 text-blue-600' },
                { role: 'accountant', label: 'Accountants',  color: 'bg-indigo-100 text-indigo-600' },
                { role: 'viewer',     label: 'Viewers',      color: 'bg-gray-100 text-gray-600' },
              ].map(({ role, label, color }) => (
                <div key={role} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{usr?.by_role?.[role] ?? 0}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
