'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import {
  Calendar, RefreshCw, Search, Mail, Phone, Building2,
  MessageSquare, ChevronRight, ArrowUpRight, FilterX,
  Clock, Loader2, Inbox, Flag, Send, CheckCircle2,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data.data;
}

interface DemoRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: 'new' | 'contacted' | 'scheduled' | 'completed';
  admin_note: string;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; icon: typeof Flag; color: string; bg: string; dot: string }> = {
  new:       { label: 'New', icon: Flag, color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  contacted: { label: 'Contacted', icon: Send, color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  completed: { label: 'Completed', icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_CARDS = [
  { label: 'New', key: 'new', color: 'text-red-600', bg: 'bg-red-50', dot: '#ef4444' },
  { label: 'Contacted', key: 'contacted', color: 'text-blue-600', bg: 'bg-blue-50', dot: '#3b82f6' },
  { label: 'Scheduled', key: 'scheduled', color: 'text-amber-600', bg: 'bg-amber-50', dot: '#f59e0b' },
  { label: 'Completed', key: 'completed', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: '#22c55e' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function DemoRequestRow({ req }: { req: DemoRequest }) {
  const router = useRouter();
  const meta = STATUS_META[req.status];
  const Icon = meta.icon;

  return (
    <tr
      onClick={() => router.push(`/demo-requests/${req.id}`)}
      className="group cursor-pointer transition-all hover:bg-indigo-50/30"
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-sm font-bold text-white">{req.full_name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{req.full_name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-px">
              <Mail className="h-3 w-3" />
              {req.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          {req.company}
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        {req.phone ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {req.phone}
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {timeAgo(req.created_at)}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
          {meta.label}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="h-4 w-4 text-gray-400" />
        </div>
      </td>
    </tr>
  );
}

function DemoRequestCard({ req }: { req: DemoRequest }) {
  const router = useRouter();
  const meta = STATUS_META[req.status];
  const Icon = meta.icon;

  return (
    <button
      onClick={() => router.push(`/demo-requests/${req.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-sm font-bold text-white">{req.full_name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{req.full_name}</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                <span className="w-1 h-1 rounded-full" style={{ background: meta.dot }} />
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{req.email}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1" />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {req.company}
        </span>
        {req.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {req.phone}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(req.created_at)}
        </span>
      </div>
      {req.message && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed border-t border-gray-50 pt-2">
          <MessageSquare className="h-3 w-3 inline mr-1 text-gray-400" />
          {req.message}
        </p>
      )}
    </button>
  );
}

export default function DemoRequestsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);

  const { data, isLoading, mutate } = useSWR(
    `/admin/demo-requests/?${params}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const requests: DemoRequest[] = data?.results ?? [];
  const counts = data?.counts ?? { new: 0, contacted: 0, scheduled: 0, completed: 0 };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">

        {/* ─── HEADER CARD ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 border border-white/10 px-6 sm:px-8 py-6 sm:py-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Demo Requests
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Inbox
                  {requests.length > 0 && (
                    <span className="ml-2.5 text-lg font-medium text-white/50">({requests.length})</span>
                  )}
                </h1>
                <p className="text-sm text-blue-200/60 mt-1">People who booked a free demo of the platform</p>
              </div>
              <button
                onClick={() => mutate()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-all hover:shadow-lg"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {STATUS_CARDS.map(({ label, key, color, bg, dot }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                  className={`rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 hover:shadow-lg ${
                    statusFilter === key
                      ? 'bg-white/10 border-white/30 shadow-lg shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <p className="text-xl sm:text-2xl font-bold text-white">{counts[key as keyof typeof counts]}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                    <span className="text-xs font-semibold" style={{ color: dot }}>{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── SEARCH & FILTER ─── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, company, phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="sm:w-48">
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="All Statuses"
              />
            </div>
          </div>
        </div>

        {/* ─── CONTENT ─── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
              <p className="text-sm font-medium text-gray-500">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                <Inbox className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No demo requests found</p>
              <p className="text-xs text-gray-500">
                {statusFilter || search ? 'Try adjusting your search or filter.' : 'No requests have come in yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="w-full hidden sm:table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Company</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Received</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map(req => (
                    <DemoRequestRow key={req.id} req={req} />
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-50">
                {requests.map(req => (
                  <DemoRequestCard key={req.id} req={req} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── FOOTER STATS ─── */}
        {requests.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Inbox className="h-3.5 w-3.5" />
            {requests.length} request{requests.length !== 1 ? 's' : ''} found
            {statusFilter && <span className="text-gray-300">· filtered by {statusFilter}</span>}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
