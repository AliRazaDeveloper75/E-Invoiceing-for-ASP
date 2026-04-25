'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { FileText, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AxiosError } from 'axios';

type Step = 'loading' | 'form' | 'success' | 'invalid';

function ActivateForm() {
  const params     = useSearchParams();
  const router     = useRouter();
  const token      = params.get('token') ?? '';
  const supplierId = params.get('supplier') ?? '';

  const [step, setStep]           = useState<Step>('loading');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!token || !supplierId) {
      setStep('invalid');
    } else {
      setStep('form');
    }
  }, [token, supplierId]);

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
      await api.post('/inbound/suppliers/activate/', {
        supplier_id: supplierId,
        token,
        password,
      });
      setStep('success');
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message ?? 'Activation failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-900">E-Numerak</h1>
            <p className="text-gray-500 mt-1 text-sm">Supplier Portal</p>
          </div>

          {step === 'loading' && (
            <div className="text-center text-gray-500">Verifying link…</div>
          )}

          {step === 'invalid' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
              <p className="text-gray-500 text-sm">
                This activation link is invalid or has already been used.
                Please contact your administrator for a new invitation.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900">Account Activated!</h2>
              <p className="text-gray-500 text-sm">
                Your supplier portal account is now active. You can sign in to
                track your submitted invoices and view validation results.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
              >
                Sign in to Supplier Portal
              </button>
            </div>
          )}

          {step === 'form' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Activate your account</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Set a password to access your Supplier Portal
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      New Password
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
                      Confirm Password
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
                    {loading ? 'Activating…' : 'Activate Account'}
                  </button>
                </form>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Secure JWT authentication — data encrypted in transit
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right — branding */}
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
            <span className="text-xl font-bold tracking-tight">E-Numerak</span>
          </div>
          <p className="text-white/50 text-sm ml-12">Supplier Portal</p>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Welcome to your<br />Supplier Portal
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            Once activated, you can track all invoices you submit,
            view validation results, and monitor FTA reporting status
            — all in one place.
          </p>
          <div className="space-y-3 pt-2">
            {[
              'Track invoice submission status in real-time',
              'View validation observations and fix guidance',
              'Monitor FTA reporting outcomes',
              'Secure API key for programmatic submission',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-white/70">{item}</span>
              </div>
            ))}
          </div>
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
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
      <ActivateForm />
    </Suspense>
  );
}
