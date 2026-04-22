'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { FileText, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { AxiosError } from 'axios';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
        <p className="text-gray-500 text-sm">
          This password reset link is invalid or has expired.
          Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                     hover:bg-brand-700 text-center transition-colors"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mx-auto">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Password updated!</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your password has been reset successfully.
          You can now sign in with your new password.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                     hover:bg-brand-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password/', { token, new_password: password });
      setSuccess(true);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message ?? 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Set new password</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Choose a strong password for your account.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                       hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remember it?{' '}
        <Link href="/login" className="text-brand-600 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex">

      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between
                      bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900
                      px-12 py-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-500/10" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">UAE E-Invoicing</span>
          </div>
          <p className="text-white/50 text-sm ml-12">PEPPOL 5-Corner Platform</p>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Secure your<br />account
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            Choose a strong, unique password to keep your e-invoicing data safe.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 flex-wrap">
          {['FTA Certified', 'PEPPOL BIS 3.0', 'UAE Compliant'].map((badge) => (
            <span
              key={badge}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-white/70 border border-white/10"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-900">UAE E-Invoicing</h1>
            <p className="text-gray-500 mt-1 text-sm">PEPPOL 5-Corner Platform</p>
          </div>
          <Suspense fallback={<div className="text-center text-gray-500 py-10">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
