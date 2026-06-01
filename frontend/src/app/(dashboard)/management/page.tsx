'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import {
  Users, FileText, Building2, CheckCircle2,
  XCircle, Clock, RefreshCw,
  Send, Landmark, ShieldCheck, ArrowRight, CreditCard, Eye,
  Truck, UserCheck, MessageSquare, UserPlus, X, Loader2, Mail,
  ClipboardList,
} from 'lucide-react';

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data.data;
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
    buyer_viewed: number;
  };
  payments: {
    total_count: number;
    total_amount: string;
  };
  contact_messages: {
    new: number;
  };
}

interface Invitation {
  id: string;
  status: string;
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

// ─── Send Invitation Modal ─────────────────────────────────────────────────────

interface InviteForm {
  email: string;
  first_name: string;
  last_name: string;
  company_name_hint: string;
  role: string;
  message: string;
}

const EMPTY_FORM: InviteForm = {
  email: '',
  first_name: '',
  last_name: '',
  company_name_hint: '',
  role: 'supplier',
  message: '',
};

function SendInviteModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [form, setForm] = useState<InviteForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(field: keyof InviteForm, val: string) {
    setForm(prev => ({ ...prev, [field]: val }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) { setError('Email is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/onboarding/invitations/', form);
      setSuccess(true);
      onSent();
      setTimeout(() => {
        setSuccess(false);
        setForm(EMPTY_FORM);
        onClose();
      }, 1800);
    } catch (err) {
      const e = err as AxiosError<{ message?: string; details?: Record<string, string[]> }>;
      const details = e.response?.data?.details;
      if (details) {
        const first = Object.values(details)[0];
        setError(Array.isArray(first) ? first[0] : String(first));
      } else {
        setError(e.response?.data?.message || 'Failed to send invitation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Send Invitation</h2>
              <p className="text-xs text-gray-400">Invite a company to register on the platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-gray-900">Invitation sent!</p>
            <p className="text-sm text-gray-500 text-center">
              An email with the registration link has been sent to <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="company@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="John"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="Doe"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Company hint + Role row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name Hint</label>
                <input
                  type="text"
                  value={form.company_name_hint}
                  onChange={e => set('company_name_hint', e.target.value)}
                  placeholder="Acme LLC"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                >
                  <option value="supplier">Supplier</option>
                  <option value="accountant">Accountant</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Personal Message <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={form.message}
                onChange={e => set('message', e.target.value)}
                placeholder="Welcome to E-Numerak! We look forward to working with you."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { data: stats, isLoading, mutate } = useSWR<AdminStats>(
    '/admin/stats/',
    fetcher,
    { refreshInterval: 30000 },
  );

  const { data: invitations, mutate: mutateInvites } = useSWR<Invitation[]>(
    '/onboarding/invitations/',
    fetcher,
    { refreshInterval: 60000 },
  );

  const { data: reviewCompanies } = useSWR<{ id: string }[]>(
    '/onboarding/review/?status=submitted,under_review',
    fetcher,
    { refreshInterval: 60000 },
  );

  const [modalOpen, setModalOpen] = useState(false);

  const pendingInvites = invitations?.filter(i => i.status === 'pending').length ?? 0;
  const reviewCount = reviewCompanies?.length ?? 0;

  const inv = stats?.invoices;
  const usr = stats?.users;

  return (
    <>
      <SendInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSent={() => mutateInvites()}
      />

      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Platform management — users, invoices, ASP verification and FTA reporting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              Send Invitation
            </button>
            <button
              onClick={() => mutate()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Total Users"      value={usr?.total ?? 0}                          sub={`${usr?.active ?? 0} active`} icon={Users}        color="bg-blue-100 text-blue-600"     href="/management/users" />
                <StatCard label="Suppliers"        value={usr?.by_role?.['supplier'] ?? 0}           sub="registered suppliers"         icon={UserCheck}    color="bg-indigo-100 text-indigo-600" href="/management/users?role=supplier" />
                <StatCard label="Buyers"           value={usr?.by_role?.['inbound_supplier'] ?? 0}   sub="inbound suppliers"            icon={Truck}        color="bg-amber-100 text-amber-600"   href="/management/users?role=inbound_supplier" />
                <StatCard label="Companies"        value={stats?.companies.total ?? 0}               sub="registered"                   icon={Building2}    color="bg-violet-100 text-violet-600" />
                <StatCard label="Total Invoices"   value={inv?.total ?? 0}                           sub="across all companies"         icon={FileText}     color="bg-indigo-100 text-indigo-600" href="/management/invoices" />
                <StatCard label="Validated"        value={inv?.by_status?.validated ?? 0}            sub="accepted by ASP"              icon={CheckCircle2} color="bg-emerald-100 text-emerald-600" />
              </div>
            </div>

            {/* ── Invitations & Onboarding ─────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invitations & Onboarding</h2>
                <Link href="/management/invitations" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                  label="Pending Invitations"
                  value={pendingInvites}
                  sub="awaiting registration"
                  icon={Mail}
                  color="bg-blue-100 text-blue-600"
                  href="/management/invitations"
                />
                <StatCard
                  label="Companies Under Review"
                  value={reviewCount}
                  sub="submitted or under review"
                  icon={ClipboardList}
                  color="bg-orange-100 text-orange-600"
                  href="/management/invitations"
                />
                <div
                  onClick={() => setModalOpen(true)}
                  className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
                >
                  <div className="p-2.5 rounded-xl bg-white/20">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white">Send Invitation</p>
                    <p className="text-xs text-blue-100">Invite a company by email</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/60 shrink-0" />
                </div>
              </div>
            </div>

            {/* ── Payment & engagement stats ───────────────────────────────── */}
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payments & Buyer Engagement</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Payments"
                  value={stats?.payments.total_count ?? 0}
                  sub="all methods"
                  icon={CreditCard}
                  color="bg-teal-100 text-teal-600"
                  href="/management/payments"
                />
                <StatCard
                  label="Total Collected"
                  value={`AED ${parseFloat(stats?.payments.total_amount ?? '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
                  sub="sum of all payments"
                  icon={CheckCircle2}
                  color="bg-emerald-100 text-emerald-600"
                />
                <StatCard
                  label="Buyer Viewed"
                  value={inv?.buyer_viewed ?? 0}
                  sub="invoices opened by buyer"
                  icon={Eye}
                  color="bg-cyan-100 text-cyan-600"
                />
                <StatCard
                  label="Paid Invoices"
                  value={(inv?.by_status?.paid ?? 0) + (inv?.by_status?.partially_paid ?? 0)}
                  sub="paid or partially paid"
                  icon={CheckCircle2}
                  color="bg-green-100 text-green-600"
                />
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
                <QueueCard
                  title="Invitations"
                  subtitle="Manage company invitations and track registration status"
                  count={pendingInvites}
                  href="/management/invitations"
                  icon={Mail}
                  color="bg-blue-100 text-blue-600"
                />
                <QueueCard
                  title="Onboarding Review"
                  subtitle="Approve or reject submitted company registrations"
                  count={reviewCount}
                  urgent={reviewCount > 0}
                  href="/management/invitations"
                  icon={ClipboardList}
                  color="bg-violet-100 text-violet-600"
                />
                <QueueCard
                  title="Payment Management"
                  subtitle="View, audit and void buyer payments across all companies"
                  count={stats?.payments.total_count ?? 0}
                  href="/management/payments"
                  icon={CreditCard}
                  color="bg-green-100 text-green-600"
                />
                <QueueCard
                  title="Contact Messages"
                  subtitle="Review and respond to messages submitted via the contact form"
                  count={stats?.contact_messages?.new ?? 0}
                  urgent
                  href="/management/contact-messages"
                  icon={MessageSquare}
                  color="bg-purple-100 text-purple-600"
                />
              </div>
            </div>

            {/* ── User role breakdown ──────────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">User Roles</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { role: 'admin',            label: 'Admins',            color: 'bg-red-100 text-red-600' },
                  { role: 'supplier',         label: 'Suppliers',         color: 'bg-blue-100 text-blue-600' },
                  { role: 'accountant',       label: 'Accountants',       color: 'bg-indigo-100 text-indigo-600' },
                  { role: 'inbound_supplier', label: 'Buyers',            color: 'bg-amber-100 text-amber-600' },
                  { role: 'viewer',           label: 'Viewers',           color: 'bg-gray-100 text-gray-600' },
                ].map(({ role, label, color }) => (
                  <Link key={role} href={`/management/users?role=${role}`}>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
                      <div className={`p-2 rounded-lg ${color}`}>
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-bold text-gray-900">{usr?.by_role?.[role] ?? 0}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
