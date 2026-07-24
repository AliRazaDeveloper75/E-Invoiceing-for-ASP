'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { AxiosError } from 'axios';
import {
  Users, FileText, Building2, CheckCircle2,
  XCircle, Clock, RefreshCw,
  Send, Landmark, ShieldCheck, ArrowRight, CreditCard, Eye,
  Truck, UserCheck, MessageSquare, UserPlus, X, Loader2, Mail,
  ClipboardList, TrendingUp,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

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

const iconColors: Record<string, string> = {
  blue: 'from-blue-500 to-blue-600',
  indigo: 'from-indigo-500 to-indigo-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-500 to-violet-600',
  cyan: 'from-cyan-500 to-cyan-600',
  teal: 'from-teal-500 to-teal-600',
  red: 'from-red-500 to-red-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600',
  gray: 'from-gray-500 to-gray-600',
};

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-4 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
      <h2 className="text-sm font-bold text-gray-800">{label}</h2>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = 'blue', href,
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; color?: string; href?: string;
}) {
  const inner = (
    <div className={`group bg-white rounded-xl shadow-sm border border-gray-100/80 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 transition-all duration-200 ${href ? 'hover:shadow-md hover:border-gray-200/80 cursor-pointer' : ''}`}>
      <div className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${iconColors[color] ?? iconColors.blue} shadow-sm`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value ?? 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {href && <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function QueueCard({
  title, subtitle, count, urgent, href, icon: Icon,
}: {
  title: string; subtitle: string; count: number; urgent?: boolean;
  href: string; icon: React.ElementType;
}) {
  return (
    <Link href={href}>
      <div className="group relative bg-white rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-100"
        style={{ boxShadow: '0 4px 20px -4px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          {count > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              urgent
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {count.toLocaleString()}
            </span>
          )}
        </div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{subtitle}</p>
        <div className="mt-3 sm:mt-4 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
          Manage <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/5 pointer-events-none" />
      </div>
    </Link>
  );
}

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
              <Mail className="h-5 w-5 text-white" />
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
          <div className="px-4 sm:px-6 py-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <p className="text-base font-semibold text-gray-900">Invitation sent!</p>
            <p className="text-sm text-gray-500 text-center">
              An email with the registration link has been sent to <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <CustomSelect
                  value={form.role}
                  onChange={(val) => set('role', val)}
                  options={[
                    { value: 'supplier', label: 'Supplier' },
                    { value: 'accountant', label: 'Accountant' },
                    { value: 'viewer', label: 'Viewer' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>
            </div>

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

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 transition-all duration-200 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Sending\u2026' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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
    <RoleGuard allowedRoles={['admin']}>
    <>
      <SendInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSent={() => mutateInvites()}
      />

      <div className="space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl shadow-md p-6 sm:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyek0zNiAxNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
              <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-widest">Management</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
                <p className="text-sm text-blue-200/80 mt-1">
                  Platform management &mdash; users, invoices, ASP verification and FTA reporting
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  Send Invitation
                </button>
                <button
                  onClick={() => mutate()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm transition-all duration-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading stats&hellip;
          </div>
        ) : (
          <>
            {/* ── Platform Overview ───────────────────────────────────── */}
            <section>
              <SectionHeading label="Platform Overview" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Total Users"      value={usr?.total ?? 0}                        sub={`${usr?.active ?? 0} active`} icon={Users}        color="blue"    href="/management/users" />
                <StatCard label="Suppliers"        value={usr?.by_role?.['supplier'] ?? 0}         sub="registered suppliers"         icon={UserCheck}  color="indigo"  href="/management/users?role=supplier" />
                <StatCard label="Buyers"           value={usr?.by_role?.['inbound_supplier'] ?? 0} sub="inbound suppliers"            icon={Truck}      color="violet"  href="/management/users?role=inbound_supplier" />
                <StatCard label="Companies"        value={stats?.companies.total ?? 0}             sub="registered"                   icon={Building2}  color="blue" />
                <StatCard label="Total Invoices"   value={inv?.total ?? 0}                         sub="across all companies"         icon={FileText}   color="indigo"  href="/management/invoices" />
                <StatCard label="Validated"        value={inv?.by_status?.validated ?? 0}          sub="accepted by ASP"              icon={CheckCircle2} color="emerald" />
              </div>
            </section>

            {/* ── Invitations & Onboarding ─────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4 gap-2">
                <SectionHeading label="Invitations &amp; Onboarding" />
                <Link href="/management/invitations" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Pending Invitations */}
                <Link href="/management/invitations">
                  <div className="group relative bg-white rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-100"
                    style={{ boxShadow: '0 4px 20px -4px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300">
                        <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      {pendingInvites > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {pendingInvites}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Pending Invitations</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">Awaiting company registration via email</p>
                    <div className="mt-3 sm:mt-4 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                      View all <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/5 pointer-events-none" />
                  </div>
                </Link>

                {/* Companies Under Review */}
                <Link href="/management/invitations">
                  <div className="group relative bg-white rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-100"
                    style={{ boxShadow: '0 4px 20px -4px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform duration-300">
                        <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      {reviewCount > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                          {reviewCount}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">Companies Under Review</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">Submitted or under review registrations</p>
                    <div className="mt-3 sm:mt-4 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                      View all <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/5 pointer-events-none" />
                  </div>
                </Link>

                {/* Send Invitation CTA */}
                <div
                  onClick={() => setModalOpen(true)}
                  className="group relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 cursor-pointer hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  style={{ boxShadow: '0 4px 20px -4px rgba(37,99,235,0.3), 0 1px 3px rgba(37,99,235,0.15)' }}
                >
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wOCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyek0zNiAxNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-white/20 group-hover:scale-105 transition-transform duration-300">
                        <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                    </div>
                    <p className="font-semibold text-white text-sm">Send Invitation</p>
                    <p className="text-xs text-blue-200/80 mt-1 leading-relaxed">Invite a company to register on the platform</p>
                    <div className="mt-3 sm:mt-4 pt-3 border-t border-white/15 flex items-center gap-1 text-xs font-semibold text-white/90 group-hover:text-white transition-colors">
                      Open form <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
                </div>
              </div>
            </section>

            {/* ── Payments & Buyer Engagement ──────────────────────────── */}
            <section>
              <SectionHeading label="Payments &amp; Buyer Engagement" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Payments"
                  value={stats?.payments.total_count ?? 0}
                  sub="all methods"
                  icon={CreditCard}
                  color="blue"
                  href="/management/payments"
                />
                <StatCard
                  label="Total Collected"
                  value={`AED ${parseFloat(stats?.payments.total_amount ?? '0').toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
                  sub="sum of all payments"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  label="Buyer Viewed"
                  value={inv?.buyer_viewed ?? 0}
                  sub="invoices opened by buyer"
                  icon={Eye}
                  color="cyan"
                />
                <StatCard
                  label="Paid Invoices"
                  value={(inv?.by_status?.paid ?? 0) + (inv?.by_status?.partially_paid ?? 0)}
                  sub="paid or partially paid"
                  icon={CheckCircle2}
                  color="teal"
                />
              </div>
            </section>

            {/* ── Invoice Status Breakdown ──────────────────────────────── */}
            <section>
              <SectionHeading label="Invoice Status Breakdown" />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                  { key: 'draft',     label: 'Draft',       color: 'gray',      icon: FileText },
                  { key: 'pending',   label: 'Pending',     color: 'blue',      icon: Clock },
                  { key: 'submitted', label: 'Submitted',   color: 'indigo',    icon: Send },
                  { key: 'validated', label: 'Validated',   color: 'emerald',   icon: CheckCircle2 },
                  { key: 'rejected',  label: 'Rejected',    color: 'red',       icon: XCircle },
                  { key: 'cancelled', label: 'Cancelled',   color: 'gray',      icon: XCircle },
                ].map(({ key, label, color, icon: Icon }) => (
                  <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-3 sm:p-4 text-center">
                    <div className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${iconColors[color]} shadow-sm text-white mb-1.5 sm:mb-2`}>
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <p className="text-base sm:text-lg font-bold text-gray-900">{inv?.by_status?.[key] ?? 0}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Action Queues ──────────────────────────────────────────── */}
            <section>
              <SectionHeading label="Action Queues" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <QueueCard
                  title="User Management"
                  subtitle="Create, edit roles, activate/deactivate platform users"
                  count={usr?.inactive ?? 0}
                  href="/management/users"
                  icon={Users}
                />
                <QueueCard
                  title="All Invoices"
                  subtitle="View and manage invoices across all companies"
                  count={inv?.total ?? 0}
                  href="/management/invoices"
                  icon={FileText}
                />
                <QueueCard
                  title="ASP Verification"
                  subtitle="Review draft invoices and submit to E-Invoice / ASP"
                  count={inv?.asp_pending ?? 0}
                  urgent
                  href="/management/asp"
                  icon={ShieldCheck}
                />
                <QueueCard
                  title="FTA Reporting"
                  subtitle="Report validated invoices to the FTA data platform"
                  count={inv?.fta_pending ?? 0}
                  urgent
                  href="/management/asp?tab=fta"
                  icon={Landmark}
                />
                <QueueCard
                  title="Invitations"
                  subtitle="Manage company invitations and track registration status"
                  count={pendingInvites}
                  href="/management/invitations"
                  icon={Mail}
                />
                <QueueCard
                  title="Onboarding Review"
                  subtitle="Approve or reject submitted company registrations"
                  count={reviewCount}
                  urgent={reviewCount > 0}
                  href="/management/invitations"
                  icon={ClipboardList}
                />
                <QueueCard
                  title="Payment Management"
                  subtitle="View, audit and void buyer payments across all companies"
                  count={stats?.payments.total_count ?? 0}
                  href="/management/payments"
                  icon={CreditCard}
                />
                <QueueCard
                  title="Contact Messages"
                  subtitle="Review and respond to messages submitted via the contact form"
                  count={stats?.contact_messages?.new ?? 0}
                  urgent
                  href="/management/contact-messages"
                  icon={MessageSquare}
                />
              </div>
            </section>

            {/* ── User Roles ────────────────────────────────────────────── */}
            <section>
              <SectionHeading label="User Roles" />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { role: 'admin',            label: 'Admins',      color: 'red' },
                  { role: 'supplier',         label: 'Suppliers',   color: 'blue' },
                  { role: 'accountant',       label: 'Accountants', color: 'indigo' },
                  { role: 'inbound_supplier', label: 'Buyers',      color: 'amber' },
                  { role: 'viewer',           label: 'Viewers',     color: 'gray' },
                ].map(({ role, label, color }) => (
                  <Link key={role} href={`/management/users?role=${role}`}>
                    <div className="group bg-white rounded-xl shadow-sm border border-gray-100/80 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-all duration-200 hover:shadow-md hover:border-gray-200/80 hover:-translate-y-0.5 cursor-pointer">
                      <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${iconColors[color]} shadow-sm`}>
                        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg sm:text-xl font-bold text-gray-900">{usr?.by_role?.[role] ?? 0}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
    </RoleGuard>
  );
}
