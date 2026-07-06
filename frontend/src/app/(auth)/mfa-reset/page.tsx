'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AxiosError } from 'axios';
import { ShieldAlert, KeyRound, ArrowLeft, MailCheck } from 'lucide-react';

type Step = 'request' | 'verify';

export default function MFAResetPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 — email a reset code to the registered account
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/mfa/reset-request/', { email: email.trim() });
      setNotice('If that email is registered, a 6-digit reset code has been sent. Check your inbox (and spam).');
      setStep('verify');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify the emailed code, then go straight to new-authenticator setup
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/reset-verify/', {
        email: email.trim(),
        code,
      });
      const setupToken = data?.data?.setup_token;
      if (!setupToken) {
        setError('Could not start authenticator setup. Please try again.');
        return;
      }
      // Hand off to the existing MFA setup page (QR scan + enable → login).
      sessionStorage.setItem('setup_token', setupToken);
      router.push('/mfa-setup');
    } catch (err) {
      const ax = err as AxiosError<{ error?: { message?: string } }>;
      setError(ax.response?.data?.error?.message || 'Invalid or expired code.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Reset Authenticator</h1>
              <p className="mt-1 text-sm text-gray-500">
                Lost access to your authenticator app? Verify your identity by email
                and set up a new one.
              </p>
            </div>
          </div>

          {notice && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
              <MailCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 leading-relaxed">{notice}</p>
            </div>
          )}

          {/* Step 1 — credentials */}
          {step === 'request' && (
            <form onSubmit={handleRequest} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@company.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                Send reset code
              </Button>
            </form>
          )}

          {/* Step 2 — code */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Enter the 6-digit code from your email
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  className="w-full text-center text-2xl font-bold tracking-[0.4em] rounded-xl border-2 border-gray-200 py-4 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-colors"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading} disabled={code.length !== 6}>
                <KeyRound className="h-4 w-4 mr-1.5" />
                Verify &amp; set up new authenticator
              </Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); setNotice(''); setCode(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 mx-auto block"
              >
                Didn&apos;t get a code? Try again
              </button>
            </form>
          )}
        </div>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="flex items-center gap-1.5 mx-auto text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </button>
      </div>
    </div>
  );
}
