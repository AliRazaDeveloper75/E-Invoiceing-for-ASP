'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import {
  ArrowLeft, Mail, Phone, Building2, Calendar,
  MessageSquare, CheckCircle2, AlertCircle,
  User, Check, Clock, Copy, Flag, Send,
  Smartphone, ChevronRight, ExternalLink,
} from 'lucide-react';

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
  updated_at?: string;
}

const STATUS_ORDER: DemoRequest['status'][] = ['new', 'contacted', 'scheduled', 'completed'];

const STATUS_LABEL: Record<string, string> = {
  new: 'New Request',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  completed: 'Completed',
};

const STATUS_META: Record<string, { label: string; icon: typeof Flag; color: string; bg: string; dot: string }> = {
  new:       { label: 'New', icon: Flag, color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  contacted: { label: 'Contacted', icon: Send, color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  completed: { label: 'Completed', icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
};

const STATUS_ACTIONS = [
  { key: 'contacted' as const, label: 'Mark Contacted', desc: 'Client has been reached out', icon: Send },
  { key: 'scheduled' as const, label: 'Mark Scheduled', desc: 'Demo call has been booked', icon: Calendar },
  { key: 'completed' as const, label: 'Mark Completed', desc: 'Demo is done and closed', icon: CheckCircle2 },
];

const ACTIVITY_STEPS = [
  { key: 'new', label: 'Submitted', dot: '#9ca3af' },
  { key: 'contacted', label: 'Contacted', dot: '#3b82f6' },
  { key: 'scheduled', label: 'Scheduled', dot: '#f59e0b' },
  { key: 'completed', label: 'Completed', dot: '#22c55e' },
];

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' \u00B7 ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-5 w-36 rounded-lg bg-gray-200" />
      <div className="h-56 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200" />
      <div className="h-32 rounded-xl bg-white border border-gray-200" />
      <div className="h-64 rounded-xl bg-white border border-gray-200" />
    </div>
  );
}

export default function DemoRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState('');
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');

  const { data, mutate, isLoading } = useSWR(
    `/admin/demo-requests/${id}/`,
    async (url: string) => {
      const r = await api.get(url);
      return r.data.data;
    },
  );

  const req = data as DemoRequest | undefined;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const updateRequest = async (status: DemoRequest['status']) => {
    setSaving(status);
    try {
      const r = await api.put(`/admin/demo-requests/${id}/`, { status });
      if (r.data.success) {
        await mutate();
        showToast(`Status updated to "${STATUS_LABEL[status]}"`);
      }
    } finally {
      setSaving('');
    }
  };

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    showToast('Copied to clipboard');
    setTimeout(() => setCopied(''), 1400);
  };

  if (isLoading) {
    return <RoleGuard allowedRoles={['admin']}><Skeleton /></RoleGuard>;
  }

  if (!req) {
    return (
      <RoleGuard allowedRoles={['admin']}>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto px-4 py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-6 ring-1 ring-red-100">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Request Not Found</h2>
            <p className="text-sm text-gray-500 mb-8">This demo request may have been removed or the link is invalid.</p>
            <button
              onClick={() => router.push('/demo-requests')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Requests
            </button>
          </div>
        </div>
      </RoleGuard>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(req.status);
  const meta = STATUS_META[req.status];
  const StatusIcon = meta.icon;
  const lastUpdated = req.updated_at || req.created_at;

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── BACK NAV ─── */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/demo-requests')}
              className="group inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <div className="p-1.5 rounded-lg border border-gray-200 group-hover:border-gray-400 group-hover:bg-gray-50 transition-all">
                <ArrowLeft className="h-3.5 w-3.5" />
              </div>
              Back to requests
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              Updated <span className="font-medium text-gray-500">{timeAgo(lastUpdated)}</span>
            </div>
          </div>

          {/* ─── HERO BANNER ─── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 border border-white/10 mb-8 shadow-xl">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative px-6 sm:px-8 py-6 sm:py-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30 ring-2 ring-white/20 shrink-0">
                    <span className="text-2xl font-bold text-white">{req.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1.5">{req.full_name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-blue-200/70">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {req.company}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-blue-300/30" />
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {fmt(req.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 text-xs text-blue-200/60">
                    <StatusIcon className="h-3.5 w-3.5" />
                    {req.status === 'completed' ? 'Closed' : `In queue ${timeAgo(req.created_at)}`}
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border" style={{ background: `${meta.color}20`, color: meta.dot, borderColor: `${meta.color}30` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                    {meta.label}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── STATUS & ACTIONS ─── */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Flag className="h-3 w-3 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">Status & Actions</h2>
            </div>

            <div className="p-6">
              {/* Current status row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl" style={{ background: meta.bg }}>
                    <StatusIcon className="h-5 w-5" style={{ color: meta.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-gray-900">{meta.label}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold" style={{ background: meta.bg, color: meta.color }}>
                        {timeAgo(lastUpdated)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {req.status === 'new' ? 'Awaiting your first action on this request.' : req.status === 'contacted' ? 'Client contacted — schedule a demo to move forward.' : req.status === 'scheduled' ? 'Demo is booked — mark complete when finished.' : 'All steps done. Case closed.'}
                    </p>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="flex items-center gap-2">
                  {ACTIVITY_STEPS.map((step, i) => (
                    <div key={step.key} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full transition-all ${i <= currentIdx ? '' : 'opacity-30'}`}
                          style={{ background: i <= currentIdx ? step.dot : '#d1d5db' }}
                        />
                        <span className={`text-[11px] font-medium ${i <= currentIdx ? 'text-gray-700' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < ACTIVITY_STEPS.length - 1 && (
                        <div className={`w-4 h-px ${i < currentIdx ? 'bg-gray-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons — only remaining steps */}
              {(() => {
                const remaining = STATUS_ACTIONS.filter((a) => STATUS_ORDER.indexOf(a.key) > currentIdx);
                if (remaining.length === 0) {
                  return (
                    <div className="flex items-center justify-center gap-2.5 mt-5 py-4 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="text-sm font-medium text-gray-500">All steps completed</span>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap items-center gap-3 mt-5">
                    {remaining.map(({ key, label, icon: Icon }) => {
                      const disabled = saving !== '';
                      const c = STATUS_META[key];
                      return (
                        <button
                          key={key}
                          onClick={() => updateRequest(key as DemoRequest['status'])}
                          disabled={disabled}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed border hover:brightness-110 active:scale-[0.97]"
                          style={{
                            background: c.color,
                            color: '#fff',
                            borderColor: 'transparent',
                          }}
                        >
                          {saving === key ? <Spinner /> : <Icon className="h-4 w-4" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─── CONTACT DETAILS ─── */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">Contact Details</h2>
            </div>

            <div className="divide-y divide-gray-50">
              {/* Email */}
              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-gray-900 mt-px font-mono">{req.email}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 pl-14 sm:pl-0">
                  <button onClick={() => handleCopy('email', req.email)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5">
                    <Copy className="h-3 w-3" />{copied === 'email' ? 'Copied' : 'Copy'}
                  </button>
                  <a href={`mailto:${req.email}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors inline-flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> Email
                  </a>
                </div>
              </div>

              {/* Phone */}
              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium text-gray-900 mt-px font-mono">{req.phone || 'Not provided'}</p>
                  </div>
                </div>
                {req.phone && (
                  <div className="flex gap-1.5 pl-14 sm:pl-0">
                    <button onClick={() => handleCopy('phone', req.phone)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5">
                      <Copy className="h-3 w-3" />{copied === 'phone' ? 'Copied' : 'Copy'}
                    </button>
                    <a href={`tel:${req.phone}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors inline-flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    <a href={`https://wa.me/${req.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors inline-flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Company */}
              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</p>
                    <p className="text-sm font-medium text-gray-900 mt-px">{req.company}</p>
                  </div>
                </div>
                <button onClick={() => handleCopy('company', req.company)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5 w-fit pl-14 sm:pl-3">
                  <Copy className="h-3 w-3" />{copied === 'company' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Message */}
              {req.message && (
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Message</span>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-5">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{req.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── FOOTER ─── */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-8 pb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            E-Numerak Compliance Portal · Case records retained per UAE AML requirements
          </div>
        </div>

        {/* ─── TOAST ─── */}
        <div
          className="fixed left-1/2 bottom-8 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all duration-300 shadow-2xl"
          style={{
            background: '#0f172a',
            color: '#fff',
            opacity: toast ? 1 : 0,
            pointerEvents: 'none',
            transform: toast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(24px)',
            zIndex: 50,
          }}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      </div>
    </RoleGuard>
  );
}
