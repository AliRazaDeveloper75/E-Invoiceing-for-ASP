'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { MailCheck, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type PageState = 'pending' | 'submitting' | 'success' | 'error' | 'resending' | 'resent';

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [pageState, setPageState] = useState<PageState>('pending');
  const [errorMsg, setErrorMsg] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // If already verified, bounce to the right home page
  useEffect(() => {
    if (user?.email_verified) {
      router.replace(
        user.role === 'inbound_supplier' ? '/supplier-portal'
        : user.role === 'buyer' ? '/buyer/dashboard'
        : '/dashboard'
      );
    }
  }, [user, router]);

  const submitCode = useCallback(async (code: string) => {
    setPageState('submitting');
    setErrorMsg('');
    try {
      await api.post('/auth/verify-email/', { code });
      await refreshUser();
      setPageState('success');
      setTimeout(() => {
        // refreshUser updates user in context; read from the updated user via closure workaround
        router.push('/dashboard'); // layout will redirect inbound_supplier to /supplier-portal
      }, 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid or expired code.';
      setErrorMsg(msg);
      setPageState('error');
      // Clear digits so user can re-enter
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputs.current[0]?.focus(), 50);
    }
  }, [refreshUser, router]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.every(d => d !== '')) {
      submitCode(digits.join(''));
    }
  }, [digits, submitCode]);

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputs.current[focusIdx]?.focus();
  };

  const resend = async () => {
    if (!user?.email) return;
    setPageState('resending');
    setErrorMsg('');
    setDigits(Array(CODE_LENGTH).fill(''));
    try {
      await api.post('/auth/resend-verification/', { email: user.email });
    } catch {
      // silent
    }
    setPageState('resent');
    setTimeout(() => { setPageState('pending'); inputs.current[0]?.focus(); }, 3000);
  };

  // ── Success ─────────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Email verified!</h1>
          <p className="text-gray-500 text-sm">Your account is now active. Redirecting…</p>
        </div>
      </div>
    );
  }

  // ── Resent confirmation ──────────────────────────────────────────────────────
  if (pageState === 'resent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
              <MailCheck className="h-8 w-8 text-brand-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">New code sent!</h1>
          <p className="text-gray-500 text-sm">
            Check your inbox at <span className="font-semibold">{user?.email}</span> for a new
            6-digit code.
          </p>
        </div>
      </div>
    );
  }

  const isSubmitting = pageState === 'submitting';

  // ── Main OTP form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
            {isSubmitting
              ? <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
              : <MailCheck className="h-8 w-8 text-brand-600" />
            }
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-gray-700">{user?.email ?? 'your email'}</span>.
            <br />Enter it below — valid for 15 minutes.
          </p>
        </div>

        {/* OTP boxes */}
        <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isSubmitting}
              autoFocus={i === 0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`
                w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none
                transition-all duration-150 caret-transparent
                ${digit ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 bg-gray-50 text-gray-900'}
                focus:border-brand-500 focus:bg-white focus:shadow-sm
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            />
          ))}
        </div>

        {/* Error */}
        {pageState === 'error' && errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Resend */}
        <div className="space-y-3">
          <Button
            onClick={resend}
            variant="secondary"
            className="w-full"
            loading={pageState === 'resending'}
            disabled={isSubmitting}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Resend code
          </Button>

          <button
            onClick={() => { clearTokens(); router.push('/login'); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}
