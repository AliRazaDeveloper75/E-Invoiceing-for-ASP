'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { api } from '@/lib/api';
import {
  User, Lock, Save, Eye, EyeOff,
  Building2, Hash, MapPin, Phone, Mail, Globe,
} from 'lucide-react';

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
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* Profile info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={profileForm.first_name}
                onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={profileForm.last_name}
                onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              value={user?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              value={user?.role?.replace(/_/g, ' ') ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed capitalize"
            />
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Company details (read-only) */}
      {activeCompany && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            {activeCompany.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeCompany.logo_url} alt={activeCompany.name}
                className="h-10 w-10 rounded-lg object-cover border border-gray-200" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Building2 className="h-5 w-5" />
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
              { icon: Hash,    label: 'PEPPOL Endpoint', value: activeCompany.peppol_endpoint },
            ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm text-gray-800 break-words">{String(value)}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Company details are managed by your administrator. Contact support to request changes.
          </p>
        </div>
      )}

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Change password</h2>
        </div>

        <form onSubmit={changePassword} className="space-y-4" noValidate>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type={showOld ? 'text' : 'password'}
              value={pwForm.old_password}
              onChange={e => { setPwForm(f => ({ ...f, old_password: e.target.value })); setPwErrors(p => ({ ...p, old_password: '' })); }}
              className={`w-full px-3 py-2 pr-10 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${pwErrors.old_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
            />
            <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-8 text-gray-400">
              {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {pwErrors.old_password && <p className="mt-1 text-xs text-red-600">⚠ {pwErrors.old_password}</p>}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type={showNew ? 'text' : 'password'}
              value={pwForm.new_password}
              onChange={e => { setPwForm(f => ({ ...f, new_password: e.target.value })); setPwErrors(p => ({ ...p, new_password: '' })); }}
              className={`w-full px-3 py-2 pr-10 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${pwErrors.new_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
            />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-8 text-gray-400">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {pwErrors.new_password && <p className="mt-1 text-xs text-red-600">⚠ {pwErrors.new_password}</p>}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={pwForm.confirm_password}
              onChange={e => { setPwForm(f => ({ ...f, confirm_password: e.target.value })); setPwErrors(p => ({ ...p, confirm_password: '' })); }}
              className={`w-full px-3 py-2 pr-10 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${pwErrors.confirm_password ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-8 text-gray-400">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {pwErrors.confirm_password && <p className="mt-1 text-xs text-red-600">⚠ {pwErrors.confirm_password}</p>}
          </div>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {pwMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pwSaving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Lock className="h-4 w-4" />
            {pwSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
