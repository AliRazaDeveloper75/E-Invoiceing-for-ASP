'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { AxiosError } from 'axios';
import { ShieldCheck, KeyRound, ArrowLeft, Smartphone } from 'lucide-react';

export default function MFAVerifyPage() {
  const { completeMfaLogin } = useAuth();
  const router = useRouter();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect to login if no pending MFA token
  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('mfa_token')) {
      router.replace('/login');
    }
  }, [router]);

  const code = digits.join('');

  const handleDigitChange = (index: number, value: string) => {
    // Accept only digits; handle paste of full code
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // User pasted a full code
      const arr = cleaned.slice(0, 6).split('');
      const next = [...digits];
      arr.forEach((d, i) => { next[i] = d; });
      setDigits(next);
      inputRefs.current[Math.min(arr.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setError('');
    setLoading(true);
    const mfaToken = sessionStorage.getItem('mfa_token') ?? '';
    try {
      await completeMfaLogin(mfaToken, code);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(
        e.response?.data?.error?.message ||
        'Invalid code. Please try again.'
      );
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('mfa_token');
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Two-Factor Authentication</h1>
              <p className="mt-1 text-sm text-gray-500">
                Open your authenticator app and enter the 6-digit code.
              </p>
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <Smartphone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Open <strong>Google Authenticator</strong> (or any TOTP app) and enter the
              current 6-digit code for <strong>E-Numerak</strong>.
            </p>
          </div>

          {/* 6-digit input */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Authentication Code
              </label>
              <div className="flex gap-2 justify-center">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`
                      w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none
                      transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                      ${digit ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-900'}
                      ${error ? 'border-red-400 bg-red-50' : ''}
                    `}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={code.length !== 6}
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              Verify Code
            </Button>
          </form>
        </div>

        {/* Back link */}
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 mx-auto text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </button>
      </div>
    </div>
  );
}
