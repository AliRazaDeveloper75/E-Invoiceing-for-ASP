'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import {
  Users, Plus, Search, RefreshCw, Shield,
  CheckCircle2, XCircle, Edit2, UserCheck, UserX, Eye, Trash2, X,
  Mail, Calendar, Clock, Building2, BadgeCheck, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AxiosError } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  company_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data;
}

const ROLE_BADGE: Record<string, string> = {
  admin:            'bg-red-100 text-red-700 border-red-200',
  supplier:         'bg-blue-100 text-blue-700 border-blue-200',
  accountant:       'bg-indigo-100 text-indigo-700 border-indigo-200',
  viewer:           'bg-gray-100 text-gray-600 border-gray-200',
  inbound_supplier: 'bg-amber-100 text-amber-700 border-amber-200',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', supplier: 'Supplier', accountant: 'Accountant',
  viewer: 'Viewer', inbound_supplier: 'Inbound Supplier',
};

const ALL_ROLES = ['viewer', 'supplier', 'accountant', 'inbound_supplier', 'admin'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Avatar({ user }: { user: AdminUser }) {
  return (
    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
      {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
    </div>
  );
}

// ─── Pagination helper ─────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

// ─── View Details Modal ───────────────────────────────────────────────────────

function ViewUserModal({ user, onClose, onEdit }: { user: AdminUser; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent w-full max-w-lg">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">User Details</h2>
              <p className="text-sm text-gray-500">View complete user information</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 pt-0 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-xl font-bold">
              {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{user.full_name}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {user.is_staff && <Shield className="h-2.5 w-2.5 mr-1" />}
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {user.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                    <XCircle className="h-3 w-3" /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-800 mt-0.5 break-all">{user.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <BadgeCheck className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Role</p>
                <p className="text-sm text-gray-800 mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Building2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Companies</p>
                <p className="text-sm text-gray-800 mt-0.5">{user.company_count} linked</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Staff Access</p>
                <p className="text-sm text-gray-800 mt-0.5">{user.is_staff ? 'Yes (Django Admin)' : 'No'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Joined</p>
                <p className="text-sm text-gray-800 mt-0.5">{fmtDateTime(user.date_joined)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Last Login</p>
                <p className="text-sm text-gray-800 mt-0.5">{fmtDateTime(user.last_login)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button onClick={onEdit} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20 transition-all">
            Edit User
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name:  user.last_name,
    role:       user.role,
    is_active:  user.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.put(`/admin/users/${user.id}/`, form);
      onSaved();
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message ?? 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent w-full max-w-md">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Edit2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">Edit User</h2>
              <p className="text-sm text-gray-500">Update user details and permissions</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 pt-0 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email (read-only)</label>
            <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">{user.email}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input required value={form.first_name} onChange={set('first_name')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input required value={form.last_name} onChange={set('last_name')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account Status</label>
            <select
              value={form.is_active ? 'true' : 'false'}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all">
              {loading ? 'Saving\u2026' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onDeleted }: { user: AdminUser; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleDelete() {
    setLoading(true); setError('');
    try {
      await api.delete(`/admin/users/${user.id}/`);
      onDeleted();
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message ?? 'Failed to delete user.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent w-full max-w-sm">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">Delete User</h2>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">This action is permanent</p>
            <p className="text-xs text-red-700">
              Deleting <strong>{user.full_name}</strong> ({user.email}) cannot be undone.
              All their data will be removed from the platform.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-semibold hover:from-red-700 hover:to-red-800 disabled:opacity-50 shadow-lg shadow-red-500/20 transition-all">
              {loading ? 'Deleting\u2026' : 'Delete User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'supplier' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/users/', form);
      onCreated();
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message ?? 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent w-full max-w-md">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">Create New User</h2>
              <p className="text-sm text-gray-500">Add a new user to the platform</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input required value={form.first_name} onChange={set('first_name')}
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input required value={form.last_name} onChange={set('last_name')}
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={set('email')}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
            <input required type="password" minLength={8} value={form.password} onChange={set('password')}
              placeholder="Min. 8 characters"
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all">
              {loading ? 'Creating\u2026' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagementUsersPage() {
  const searchParams = useSearchParams();
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') ?? '');
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);

  const [showCreate, setShowCreate]   = useState(false);
  const [viewUser,   setViewUser]     = useState<AdminUser | null>(null);
  const [editUser,   setEditUser]     = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser]   = useState<AdminUser | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    ...(search       ? { search }               : {}),
    ...(roleFilter   ? { role: roleFilter }     : {}),
    ...(statusFilter ? { is_active: statusFilter } : {}),
  });

  const { data, isLoading, mutate } = useSWR(`/admin/users/?${params}`, fetcher);

  const users: AdminUser[] = data?.data?.results ?? [];
  const pagination         = data?.data?.pagination ?? {};

  const pageSize = 20;
  const totalPages = Math.ceil((pagination.count ?? 0) / pageSize);

  async function toggleActive(user: AdminUser) {
    const endpoint = user.is_active
      ? `/admin/users/${user.id}/deactivate/`
      : `/admin/users/${user.id}/activate/`;
    try {
      await api.post(endpoint);
      mutate();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      alert(e.response?.data?.error?.message ?? 'Action failed.');
    }
  }

  return (
    <div className="space-y-6">

      {/* Modals */}
      {showCreate  && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
      {viewUser    && (
        <ViewUserModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onEdit={() => { setEditUser(viewUser); setViewUser(null); }}
        />
      )}
      {editUser    && <EditUserModal   user={editUser}   onClose={() => setEditUser(null)}   onSaved={() => mutate()} />}
      {deleteUser  && <DeleteUserModal user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={() => mutate()} />}

      {/* Header */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 uppercase tracking-wider">User Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">View, create, edit and delete platform users</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="h-4 w-4" /> New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email\u2026"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button onClick={() => mutate()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading\u2026
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="p-4 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 mb-3">
              <Users className="h-10 w-10 text-blue-300" />
            </div>
            <p className="font-medium text-gray-500">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Companies</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Last Login</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user, idx) => (
                <tr key={user.id} className={`${idx % 2 === 0 ? 'bg-blue-50/10' : ''} hover:bg-blue-50/30 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar user={user} />
                      <div>
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {user.is_staff && <Shield className="h-2.5 w-2.5 mr-1" />}
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700">{user.company_count}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(user.date_joined)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(user.last_login)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setViewUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all"
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 transition-all"
                        title="Edit user"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        className={`p-1.5 rounded-lg transition-all ${user.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-gradient-to-br hover:from-amber-50 hover:to-amber-100' : 'text-gray-400 hover:text-emerald-600 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-emerald-100'}`}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {user.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setDeleteUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100 transition-all"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {(pagination.count ?? 0) > 0 && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{pagination.count} user{pagination.count !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-2 text-gray-400">\u2026</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all ${
                      p === page
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20'
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}>
                    {p}
                  </button>
                )
              )}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
