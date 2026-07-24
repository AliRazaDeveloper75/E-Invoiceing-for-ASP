'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { RoleGuard } from '@/components/guards/RoleGuard';
import {
  Users, Plus, Search, RefreshCw, Shield,
  CheckCircle2, XCircle, Edit2, UserCheck, UserX, Eye, Trash2, X,
  Mail, Calendar, Clock, Building2, BadgeCheck, ChevronLeft, ChevronRight,
  Loader2, EyeOff,
} from 'lucide-react';
import { AxiosError } from 'axios';
import CustomSelect from '@/components/ui/CustomSelect';

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
  const infoRows: { icon: React.ElementType; label: string; value: string; accent?: boolean }[] = [
    { icon: Mail,        label: 'Email',        value: user.email },
    { icon: BadgeCheck,  label: 'Role',         value: ROLE_LABELS[user.role] ?? user.role },
    { icon: Building2,   label: 'Companies',    value: `${user.company_count} linked` },
    { icon: Shield,      label: 'Staff Access',  value: user.is_staff ? 'Yes (Django Admin)' : 'No' },
    { icon: Calendar,    label: 'Joined',        value: fmtDateTime(user.date_joined) },
    { icon: Clock,       label: 'Last Login',    value: fmtDateTime(user.last_login) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">User Details</h2>
              <p className="text-xs text-gray-400">View complete user information</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">
          {/* Profile card */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-xl border border-blue-100/60">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-blue-500/20">
              {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{user.full_name}</h3>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {user.is_staff && <Shield className="h-2.5 w-2.5 mr-1" />}
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {user.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-200">
                    <XCircle className="h-3 w-3" /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="mt-5 space-y-0 divide-y divide-gray-100">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="p-1.5 rounded-lg bg-gray-100 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm text-gray-800 mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Close
          </button>
          <button onClick={onEdit} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
              <Edit2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
              <p className="text-xs text-gray-400">Update user details and permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Read-only email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.first_name}
                onChange={set('first_name')}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.last_name}
                onChange={set('last_name')}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role</label>
            <CustomSelect
              value={form.role}
              onChange={(val) => setForm((f) => ({ ...f, role: val }))}
              options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
            />
          </div>

          {/* Status toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Account Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_active: true }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  form.is_active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_active: false }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  !form.is_active
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <XCircle className="h-4 w-4" />
                Inactive
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 shadow-sm transition-all">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-sm">
              <Trash2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Delete User</h2>
              <p className="text-xs text-gray-400">This action cannot be undone</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">
          {/* User being deleted */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-red-700 text-sm font-bold shrink-0">
              {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-lg bg-red-100 shrink-0 mt-0.5">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Permanent deletion</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  All data associated with this user will be permanently removed from the platform. This action is irreversible.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 disabled:opacity-60 shadow-sm transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {loading ? 'Deleting…' : 'Delete User'}
          </button>
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
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/users/', form);
      onCreated();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ email: '', password: '', first_name: '', last_name: '', role: 'supplier' });
        onClose();
      }, 1800);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Create New User</h2>
              <p className="text-xs text-gray-400">Add a new user to the platform</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-4 sm:px-6 py-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <p className="text-base font-semibold text-gray-900">User created!</p>
            <p className="text-sm text-gray-500 text-center">
              <strong>{form.first_name} {form.last_name}</strong> has been added to the platform.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.first_name}
                  onChange={set('first_name')}
                  placeholder="John"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.last_name}
                  onChange={set('last_name')}
                  placeholder="Doe"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="john.doe@company.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 8 characters"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
              <CustomSelect
                value={form.role}
                onChange={(val) => setForm((f) => ({ ...f, role: val }))}
                options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 transition-all duration-200 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {loading ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        )}
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
    <RoleGuard allowedRoles={['admin']}>
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
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full hidden sm:block" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 uppercase tracking-wider">User Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">View, create, edit and delete platform users</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20 transition-all w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" /> New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <CustomSelect
              value={roleFilter}
              onChange={(val) => { setRoleFilter(val); setPage(1); }}
              options={[{ value: '', label: 'All roles' }, ...ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))]}
              className="flex-1 sm:flex-none"
            />
            <CustomSelect
              value={statusFilter}
              onChange={(val) => { setStatus(val); setPage(1); }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              className="flex-1 sm:flex-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-xl shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.18),0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-300">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="p-4 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 mb-3">
              <Users className="h-10 w-10 text-blue-300" />
            </div>
            <p className="font-medium text-gray-500">No users found</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar user={user} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-200 shrink-0">
                        <XCircle className="h-2.5 w-2.5" /> Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {user.is_staff && <Shield className="h-2 w-2 mr-0.5" />}
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                    <span className="text-[10px] text-gray-400">{user.company_count} companies</span>
                    <span className="text-[10px] text-gray-400">Joined {fmtDate(user.date_joined)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewUser(user)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                      <Eye className="h-3 w-3" /> View
                    </button>
                    <button onClick={() => setEditUser(user)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive(user)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user.is_active ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}>
                      {user.is_active ? <><UserX className="h-3 w-3" /> Deactivate</> : <><UserCheck className="h-3 w-3" /> Activate</>}
                    </button>
                    <button onClick={() => setDeleteUser(user)}
                      className="flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <table className="w-full text-sm hidden sm:table">
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
          </>
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
                  <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
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
    </RoleGuard>
  );
}
