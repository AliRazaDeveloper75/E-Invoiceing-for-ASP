'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { api } from '@/lib/api';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  User, Lock, Save, Eye, EyeOff,
  Building2, Hash, MapPin, Phone, Mail, Globe, ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { activeCompany } = useCompany();

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.put('/auth/me/', profileForm);
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const details = apiError?.details
        ? Object.values(apiError.details).flat().join(' ')
        : null;
      const msg = details ?? apiError?.message ?? 'Failed to update profile.';
      setProfileMsg({ type: 'error', text: msg });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    // Client-side validation with per-field errors
    const errs: Record<string, string> = {};
    if (!pwForm.old_password)
      errs.old_password = 'Current password is required.';
    if (!pwForm.new_password)
      errs.new_password = 'New password is required.';
    else if (pwForm.new_password.length < 8)
      errs.new_password = 'New password must be at least 8 characters.';
    else if (pwForm.old_password && pwForm.old_password === pwForm.new_password)
      errs.new_password = 'New password must be different from your current password.';
    if (!pwForm.confirm_password)
      errs.confirm_password = 'Please confirm your new password.';
    else if (pwForm.new_password !== pwForm.confirm_password)
      errs.confirm_password = 'Passwords do not match.';

    if (Object.keys(errs).length > 0) {
      setPwErrors(errs);
      return;
    }
    setPwErrors({});
    setPwSaving(true);
    try {
      await api.post('/auth/change-password/', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
        confirm_new_password: pwForm.confirm_password,
      });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      // API returns { error: { message, details } }
      const apiError = err?.response?.data?.error;
      const details = apiError?.details as Record<string, string[]> | undefined;
      if (details) {
        const mapped: Record<string, string> = {};
        Object.entries(details).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v; });
        setPwErrors(mapped);
      } else {
        setPwMsg({ type: 'error', text: apiError?.message ?? 'Failed to change password.' });
      }
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Profile</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Profile</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">Manage your personal information and password.</p>
          </div>
        </div>
      </AnimatedSection>

      {/* Profile info */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
            {user?.role && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                <ShieldCheck className="h-3 w-3" />
                {user.role.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="text"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={user?.role?.replace(/_/g, ' ') ?? ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed capitalize"
                />
              </div>
            </div>

            {profileMsg && (
              <div className={clsx(
                'rounded-xl px-4 py-3 text-sm flex items-center gap-2 border shadow-sm',
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700',
              )}>
                {profileMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {profileSaving ? 'Saving\u2026' : 'Save changes'}
            </button>
          </form>
        </div>
      </AnimatedSection>

      {/* Company details (read-only) */}
      {activeCompany && (
        <AnimatedSection delay={160}>
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              {activeCompany.logo_url && !logoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeCompany.logo_url} alt={activeCompany.name}
                  onError={() => setLogoBroken(true)}
                  className="h-10 w-10 rounded-xl object-cover border-2 border-gray-200 shadow-sm" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 shrink-0">
                  {activeCompany.name?.slice(0, 2).toUpperCase() || <Building2 className="h-5 w-5" />}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{activeCompany.name}</p>
                {activeCompany.legal_name && activeCompany.legal_name !== activeCompany.name && (
                  <p className="text-xs text-gray-400">{activeCompany.legal_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Hash,    label: 'TRN',     value: activeCompany.trn },
                { icon: MapPin,  label: 'Address', value: activeCompany.formatted_address },
                { icon: Phone,   label: 'Phone',   value: activeCompany.phone },
                { icon: Mail,    label: 'Email',   value: activeCompany.email },
                { icon: Globe,   label: 'Website', value: activeCompany.website },
                { icon: Hash,    label: 'E-Invoice Endpoint', value: activeCompany.peppol_endpoint },
              ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-medium text-gray-800 break-words mt-0.5">{String(value)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Company details are managed by your administrator. Contact support to request changes.</span>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Change password */}
      <AnimatedSection delay={240}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-gray-900">Change password</h2>
          </div>

          <form onSubmit={changePassword} className="space-y-4" noValidate>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                type={showOld ? 'text' : 'password'}
                value={pwForm.old_password}
                onChange={e => { setPwForm(f => ({ ...f, old_password: e.target.value })); setPwErrors(p => ({ ...p, old_password: '' })); }}
                className={clsx('w-full px-3 py-2 pr-10 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all', pwErrors.old_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300')}
              />
              <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors">
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {pwErrors.old_password && <p className="mt-1 text-xs text-red-600">{'\u26A0'} {pwErrors.old_password}</p>}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={pwForm.new_password}
                onChange={e => { setPwForm(f => ({ ...f, new_password: e.target.value })); setPwErrors(p => ({ ...p, new_password: '' })); }}
                className={clsx('w-full px-3 py-2 pr-10 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all', pwErrors.new_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300')}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {pwErrors.new_password && <p className="mt-1 text-xs text-red-600">{'\u26A0'} {pwErrors.new_password}</p>}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={pwForm.confirm_password}
                onChange={e => { setPwForm(f => ({ ...f, confirm_password: e.target.value })); setPwErrors(p => ({ ...p, confirm_password: '' })); }}
                className={clsx('w-full px-3 py-2 pr-10 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all', pwErrors.confirm_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300')}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {pwErrors.confirm_password && <p className="mt-1 text-xs text-red-600">{'\u26A0'} {pwErrors.confirm_password}</p>}
            </div>

            {pwMsg && (
              <div className={clsx(
                'rounded-xl px-4 py-3 text-sm flex items-center gap-2 border shadow-sm',
                pwMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700',
              )}>
                {pwMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {pwSaving ? 'Updating\u2026' : 'Update password'}
            </button>
          </form>
        </div>
      </AnimatedSection>
    </div>
  );
}
