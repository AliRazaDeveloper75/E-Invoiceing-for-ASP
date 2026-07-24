'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { AxiosError } from 'axios';
import type { APISuccess } from '@/types';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Bell, Shield, Globe, ShieldCheck, ShieldOff,
  QrCode, CheckCircle2, AlertCircle, Copy, Check,
} from 'lucide-react';
import { clsx } from 'clsx';

// ── MFA Section ───────────────────────────────────────────────────────────────

type MFAStep = 'idle' | 'setup' | 'enabling' | 'disabling';

interface SetupData {
  secret: string;
  qr_uri: string;
}

function MFASection() {
  const { user, refreshUser } = useAuth();
  const mfaEnabled = user?.mfa_enabled ?? false;

  const [step, setStep]           = useState<MFAStep>('idle');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode]           = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);

  // Generate QR code data URL whenever setup data changes
  useEffect(() => {
    if (!setupData?.qr_uri) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(setupData.qr_uri, { width: 200, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    });
  }, [setupData]);

  const startSetup = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await api.post<APISuccess<SetupData>>('/auth/mfa/setup/');
      setSetupData(data.data);
      setStep('setup');
    } catch {
      setError('Failed to start MFA setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/mfa/enable/', { code });
      await refreshUser();
      setStep('idle');
      setSetupData(null);
      setQrDataUrl('');
      setCode('');
      setSuccess('Two-factor authentication has been enabled.');
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/mfa/disable/', { code });
      await refreshUser();
      setStep('idle');
      setCode('');
      setSuccess('Two-factor authentication has been disabled.');
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setStep('idle');
    setSetupData(null);
    setQrDataUrl('');
    setCode('');
    setError('');
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900">Two-Factor Authentication</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
            ${mfaEnabled
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'}`}
        >
          {mfaEnabled ? <><CheckCircle2 className="h-3 w-3" /> Enabled</> : 'Disabled'}
        </span>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed">
        Use Google Authenticator or any TOTP app to generate a one-time code each time you sign in.
      </p>

      {/* Success / Error banners */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Idle state ── */}
      {step === 'idle' && !mfaEnabled && (
        <button
          onClick={startSetup}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 w-full sm:w-auto"
        >
          {loading ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Loading…' : 'Enable Two-Factor Authentication'}
        </button>
      )}

      {step === 'idle' && mfaEnabled && (
        <button
          onClick={() => { setStep('disabling'); setError(''); setSuccess(''); }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-5 py-2.5 text-sm font-semibold text-red-700 hover:text-red-800 shadow-sm hover:shadow-md transition-all duration-200 w-full sm:w-auto"
        >
          <ShieldOff className="h-4 w-4" />
          Disable Two-Factor Authentication
        </button>
      )}

      {/* ── Setup: QR code + confirm code ── */}
      {step === 'setup' && setupData && (
        <div className="space-y-5 pt-2">
          <div className="rounded-xl bg-indigo-50 border border-indigo-200/70 px-4 py-3.5 text-sm text-indigo-700 space-y-1">
            <p className="font-semibold">Scan this QR code with your authenticator app</p>
            <p className="text-indigo-600">
              Open <strong>Google Authenticator</strong>, tap <strong>+</strong>, then
              select <strong>Scan a QR code</strong>.
            </p>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="MFA QR code"
                className="rounded-xl border border-gray-200 shadow-sm"
                width={200}
                height={200}
              />
            ) : (
              <div className="h-[200px] w-[200px] rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                <QrCode className="h-10 w-10 text-gray-300" />
              </div>
            )}

            {/* Manual entry secret */}
            <div className="w-full">
              <p className="text-xs text-gray-500 mb-1.5 text-center">
                Can&apos;t scan? Enter this key manually in your app:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-sm font-mono text-gray-800 tracking-widest text-center select-all">
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  title="Copy secret"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-emerald-500" />
                    : <Copy className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* Confirm code */}
          <form onSubmit={handleEnable} className="space-y-3 border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700">
              Enter the 6-digit code from your app to confirm setup:
            </p>
            <Input
              label="Authenticator Code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
              >
                {loading ? <Spinner /> : null}
                {loading ? 'Confirming\u2026' : 'Confirm & Enable'}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Disable: confirm with current code ── */}
      {step === 'disabling' && (
        <form onSubmit={handleDisable} className="space-y-3 pt-2">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Enter your current authenticator code to confirm disabling 2FA.
          </div>
          <Input
            label="Current Authenticator Code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              {loading ? <Spinner /> : null}
              {loading ? 'Disabling\u2026' : 'Disable 2FA'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

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
              <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Settings</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">Manage your account settings and preferences.</p>
          </div>
        </div>
      </AnimatedSection>

      {/* Account info */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Account</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900 font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900 font-medium capitalize">{user?.role?.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Email verified</span>
              <span className={user?.email_verified ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                {user?.email_verified ? 'Verified' : 'Not verified'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Member since</span>
              <span className="text-gray-900 font-medium">
                {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '\u2014'}
              </span>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Two-Factor Authentication */}
      <AnimatedSection delay={160}>
        <MFASection />
      </AnimatedSection>

      {/* Notifications placeholder */}
      <AnimatedSection delay={240}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </div>
          <p className="text-sm text-gray-400">Notification preferences coming soon.</p>
        </div>
      </AnimatedSection>

      {/* Region placeholder */}
      <AnimatedSection delay={320}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Region &amp; Language</h2>
          </div>
          <p className="text-sm text-gray-400">UAE / English (default)</p>
        </div>
      </AnimatedSection>
    </div>
  );
}
