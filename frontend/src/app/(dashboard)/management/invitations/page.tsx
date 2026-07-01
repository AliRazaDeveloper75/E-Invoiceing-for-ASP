'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import {
  Mail, Plus, Search, RefreshCw, Trash2, Clock, CheckCircle2,
  XCircle, AlertCircle, Loader2, Copy, Check, Send,
  Building2, FileText, Eye, RotateCcw, ChevronDown, ChevronUp,
  MousePointerClick, AlertTriangle, Timer, X, UserPlus,
} from 'lucide-react';

interface EmailLog {
  id: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message: string;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name_hint: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  message: string;
  expires_at: string;
  created_at: string;
  invited_by_name: string | null;
  send_count: number;
  last_sent_at: string | null;
  last_delivery_status: 'sent' | 'failed' | '';
  last_error: string;
  email_opened_at: string | null;
  link_accessed_at: string | null;
  email_logs: EmailLog[];
  is_link_active: boolean;
  minutes_until_expiry: number;
}

interface OnboardingCompany {
  id: string;
  name: string;
  legal_name: string;
  trn: string;
  business_type: string;
  industry_type: string;
  onboarding_status: string;
  onboarding_notes: string;
  onboarding_reviewed_at: string | null;
  email: string;
  phone: string;
  contact_person_name: string;
  contact_person_email: string;
  logo_url: string | null;
  member_count: number;
  reviewed_by: string | null;
  created_at: string;
  documents: Array<{
    id: string;
    document_type: string;
    file: string;
    file_name: string;
    verified: boolean;
    created_at: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:      { label: 'Pending',      color: 'bg-amber-100 text-amber-700',    icon: Clock },
  accepted:     { label: 'Accepted',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  expired:      { label: 'Expired',      color: 'bg-gray-100 text-gray-500',      icon: XCircle },
  revoked:      { label: 'Revoked',      color: 'bg-red-100 text-red-700',        icon: XCircle },
  not_started:  { label: 'Not Started',  color: 'bg-gray-100 text-gray-500',      icon: Clock },
  submitted:    { label: 'Submitted',    color: 'bg-blue-100 text-blue-700',      icon: FileText },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700',    icon: AlertCircle },
  approved:     { label: 'Approved',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     color: 'bg-red-100 text-red-700',        icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-500', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-AE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function TrackPill({
  icon: Icon, label, active, activeColor, tip,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  activeColor: string;
  tip?: string;
}) {
  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
        ${active ? activeColor : 'bg-gray-100 text-gray-400'}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function LinkStatus({ inv }: { inv: Invitation }) {
  if (inv.status !== 'pending') return null;
  if (!inv.is_link_active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">
        <AlertTriangle className="h-2.5 w-2.5" /> Expired
      </span>
    );
  }
  const mins = inv.minutes_until_expiry;
  const hrs  = Math.floor(mins / 60);
  const rem  = mins % 60;
  const label = hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
  const color = mins <= 10 ? 'bg-red-100 text-red-600' : mins <= 30 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      <Timer className="h-2.5 w-2.5" /> {label} left
    </span>
  );
}

function EmailLogsRow({ logs }: { logs: EmailLog[] }) {
  if (!logs.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {logs.map(log => (
        <div key={log.id} className={`flex items-start gap-2 text-[10px] rounded-lg px-2.5 py-1.5
          ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {log.status === 'sent'
            ? <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
            : <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />}
          <span className="font-medium">{log.status === 'sent' ? 'Sent' : 'Failed'}</span>
          <span className="text-[10px] opacity-70">{fmtTime(log.sent_at)}</span>
          {log.error_message && (
            <span className="ml-1 truncate max-w-xs opacity-80">{log.error_message}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function CreateInviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', company_name_hint: '',
    role: 'supplier', message: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const send = async () => {
    if (!form.email) { setError('Email is required.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/onboarding/invitations/', form);
      onCreated();
      onClose();
    } catch (err) {
      const msg = (err as AxiosError<{ error?: { message?: string } }>)
        ?.response?.data?.error?.message ?? 'Failed to send invitation.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-2.5 shadow-sm">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Send Invitation</h2>
            <p className="text-sm text-gray-500 mt-0.5">Link valid for 1 hour after sending</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="supplier@company.ae"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                placeholder="Ahmed"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                placeholder="Al Mansouri"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name (hint)</label>
            <input value={form.company_name_hint} onChange={e => set('company_name_hint', e.target.value)}
              placeholder="Pre-fills company name on registration form"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              <option value="supplier">Supplier</option>
              <option value="accountant">Accountant</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Personal message (optional)</label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)}
              rows={2} placeholder="Welcome message shown on the invitation page\u2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={send} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 shadow-sm transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ company, onClose, onReviewed }: {
  company: OnboardingCompany; onClose: () => void; onReviewed: () => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await api.post(`/onboarding/review/${company.id}/`, { action, notes });
      onReviewed();
      onClose();
    } catch (err) {
      const msg = (err as AxiosError<{ error?: { message?: string } }>)
        ?.response?.data?.error?.message ?? 'Review failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-2.5 shadow-sm">
            <Eye className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Review: {company.name}</h2>
            <p className="text-sm text-gray-500">TRN: {company.trn}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            {company.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover border mb-3" />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Legal name:</span> <span className="font-medium">{company.legal_name}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium">{company.business_type || '\u2014'}</span></div>
              <div><span className="text-gray-500">Industry:</span> <span className="font-medium">{company.industry_type || '\u2014'}</span></div>
              <div><span className="text-gray-500">Members:</span> <span className="font-medium">{company.member_count}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{company.email || '\u2014'}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{company.phone || '\u2014'}</span></div>
            </div>
            {company.contact_person_name && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 text-xs font-medium mb-1">Contact person</p>
                <p className="font-medium">{company.contact_person_name} \u2014 {company.contact_person_email}</p>
              </div>
            )}
          </div>
          {company.documents.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Uploaded documents</p>
              <div className="space-y-2">
                {company.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-white text-sm">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.file_name || doc.document_type}</p>
                      <p className="text-xs text-gray-400">{doc.document_type.replace(/_/g, ' ')}</p>
                    </div>
                    <a href={doc.file} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Eye className="h-3.5 w-3.5" /> View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Decision</p>
            <div className="grid grid-cols-3 gap-2">
              {(['approve', 'request_changes', 'reject'] as const).map(a => (
                <button key={a} type="button" onClick={() => setAction(a)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${action === a
                      ? a === 'approve' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : a === 'reject' ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {a === 'approve' ? '\u2705 Approve' : a === 'reject' ? '\u274c Reject' : '\U0001f4cb Request Changes'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (sent to company)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Optional notes or reason for decision\u2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 shadow-sm transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit Decision
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = 'invitations' | 'onboarding';

export default function InvitationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab]                   = useState<Tab>('invitations');
  const [invitations, setInvitations]   = useState<Invitation[]>([]);
  const [companies, setCompanies]       = useState<OnboardingCompany[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OnboardingCompany | null>(null);
  const [copied, setCopied]             = useState<string | null>(null);
  const [resending, setResending]       = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace('/dashboard');
  }, [isLoading, isAdmin, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'invitations') {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        const res = await api.get(`/onboarding/invitations/${params}`);
        setInvitations(res.data.data);
      } else {
        const res = await api.get('/onboarding/review/?status=submitted,under_review,approved,rejected');
        setCompanies(res.data.data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab, statusFilter]);

  useEffect(() => { if (isAdmin) load(); }, [load, isAdmin]);

  const revoke = async (id: string) => {
    if (!confirm('Revoke this invitation?')) return;
    try {
      await api.delete(`/onboarding/invitations/${id}/`);
      load();
    } catch { /* silent */ }
  };

  const resend = async (id: string) => {
    setResending(id);
    try {
      await api.post(`/onboarding/invitations/${id}/resend/`);
      load();
    } catch { /* silent */ }
    finally { setResending(null); }
  };

  const copyLink = (id: string, token: string) => {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = tab === 'invitations'
    ? invitations.filter(i =>
        !search || i.email.toLowerCase().includes(search.toLowerCase()) ||
        (i.first_name + ' ' + i.last_name).toLowerCase().includes(search.toLowerCase()))
    : companies.filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.trn.includes(search));

  if (isLoading || !isAdmin) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl shadow-md p-6 sm:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyek0zNiAxNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-widest">Invitations &amp; Onboarding</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Invitations &amp; Onboarding</h1>
              <p className="text-sm text-blue-200/80 mt-1">
                Manage supplier invitations and review company registrations
              </p>
            </div>
            {tab === 'invitations' && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-sm"
              >
                <Plus className="h-4 w-4" /> Send Invitation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100/60 rounded-xl p-1 w-fit">
        {(['invitations', 'onboarding'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize
              ${tab === t ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'invitations' ? 'Invitations' : 'Onboarding Review'}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'invitations' ? 'Search by email or name\u2026' : 'Search by company or TRN\u2026'}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
            />
          </div>
          {tab === 'invitations' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          )}
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Invitation Stats ─────────────────────────────────────────── */}
      {tab === 'invitations' && (
        <div className="grid grid-cols-4 gap-3">
          {['pending', 'accepted', 'expired', 'revoked'].map(s => {
            const count = invitations.filter(i => i.status === s).length;
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <div key={s} className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded-lg ${cfg.color.replace('text-', '')}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 capitalize">{s}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invitations Table ────────────────────────────────────────── */}
      {tab === 'invitations' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          {loading
            ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            : filtered.length === 0
              ? <div className="text-center py-16 text-gray-400">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 inline-flex mb-3">
                    <Mail className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="font-medium">No invitations found</p>
                  <p className="text-sm mt-1">Send an invitation to onboard a new supplier</p>
                </div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invitee</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery &amp; Engagement</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Link</th>
                      <th className="px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(filtered as Invitation[]).map((inv: Invitation) => (
                      <>
                        <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors even:bg-blue-50/10">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{inv.email}</p>
                            {(inv.first_name || inv.last_name) && (
                              <p className="text-xs text-gray-400">{inv.first_name} {inv.last_name}</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Sent {inv.send_count}\u00d7 {inv.last_sent_at ? `\u00b7 last ${fmtTime(inv.last_sent_at)}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-gray-700">{inv.company_name_hint || '\u2014'}</p>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                              {inv.role}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1">
                              {inv.last_delivery_status === 'sent' && (
                                <TrackPill
                                  icon={CheckCircle2} label="Delivered" active
                                  activeColor="bg-emerald-100 text-emerald-700"
                                  tip={`Delivered ${inv.last_sent_at ? fmtTime(inv.last_sent_at) : ''}`}
                                />
                              )}
                              {inv.last_delivery_status === 'failed' && (
                                <TrackPill
                                  icon={AlertTriangle} label="Failed" active
                                  activeColor="bg-red-100 text-red-600"
                                  tip={inv.last_error}
                                />
                              )}
                              {!inv.last_delivery_status && (
                                <TrackPill icon={Mail} label="Not sent" active={false} activeColor="" />
                              )}
                              <TrackPill
                                icon={MousePointerClick} label="Link clicked"
                                active={!!inv.link_accessed_at}
                                activeColor="bg-violet-100 text-violet-700"
                                tip={inv.link_accessed_at ? `Clicked ${fmtTime(inv.link_accessed_at)}` : 'Link not clicked yet'}
                              />
                            </div>
                            {inv.email_logs.length > 0 && (
                              <button
                                onClick={() => setExpandedLogs(expandedLogs === inv.id ? null : inv.id)}
                                className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                {expandedLogs === inv.id
                                  ? <><ChevronUp className="h-3 w-3" /> Hide logs</>
                                  : <><ChevronDown className="h-3 w-3" /> {inv.email_logs.length} send log{inv.email_logs.length > 1 ? 's' : ''}</>
                                }
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <LinkStatus inv={inv} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 justify-end">
                              {['pending', 'expired'].includes(inv.status) && (
                                <button
                                  onClick={() => resend(inv.id)}
                                  disabled={resending === inv.id}
                                  title="Resend invitation (resets link to 1 hour)"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                >
                                  {resending === inv.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <RotateCcw className="h-3.5 w-3.5" />}
                                  Resend
                                </button>
                              )}
                              {inv.status === 'pending' && (
                                <button
                                  onClick={() => copyLink(inv.id, inv.token)}
                                  title="Copy invite link"
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {copied === inv.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                </button>
                              )}
                              {inv.status === 'pending' && (
                                <button
                                  onClick={() => revoke(inv.id)}
                                  title="Revoke invitation"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedLogs === inv.id && (
                          <tr key={`${inv.id}-logs`} className="bg-gray-50">
                            <td colSpan={6} className="px-5 py-3">
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Send History</p>
                              <EmailLogsRow logs={inv.email_logs} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )
          }
        </div>
      )}

      {/* ── Onboarding Review Table ──────────────────────────────────── */}
      {tab === 'onboarding' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          {loading
            ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            : filtered.length === 0
              ? <div className="text-center py-16 text-gray-400">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 inline-flex mb-3">
                    <Building2 className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="font-medium">No pending submissions</p>
                  <p className="text-sm mt-1">Company onboarding submissions will appear here</p>
                </div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">TRN</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Docs</th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                      <th className="px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(filtered as OnboardingCompany[]).map(co => (
                      <tr key={co.id} className="hover:bg-blue-50/30 transition-colors even:bg-blue-50/10">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {co.logo_url
                              ? <img src={co.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-gray-200" />
                              : <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                  <Building2 className="h-4 w-4 text-gray-400" />
                                </div>
                            }
                            <div>
                              <p className="font-medium text-gray-900">{co.name}</p>
                              <p className="text-xs text-gray-400">{co.email || co.contact_person_email || '\u2014'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-gray-600">{co.trn}</td>
                        <td className="px-4 py-4 text-gray-600 capitalize">{co.business_type || '\u2014'}</td>
                        <td className="px-4 py-4"><StatusBadge status={co.onboarding_status} /></td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-gray-500">{co.documents.length} file{co.documents.length !== 1 ? 's' : ''}</span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500">{fmt(co.created_at)}</td>
                        <td className="px-4 py-4">
                          {['submitted', 'under_review'].includes(co.onboarding_status) && (
                            <button
                              onClick={() => setReviewTarget(co)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </button>
                          )}
                          {['approved', 'rejected'].includes(co.onboarding_status) && (
                            <button
                              onClick={() => setReviewTarget(co)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" /> Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          }
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateInviteModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
      {reviewTarget && (
        <ReviewModal
          company={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onReviewed={load}
        />
      )}
    </div>
  );
}
