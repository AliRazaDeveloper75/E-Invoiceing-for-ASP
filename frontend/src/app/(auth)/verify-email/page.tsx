'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { MailCheck, RefreshCw, ShieldCheck, XCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type PageState = 'pending' | 'submitting' | 'success' | 'error' | 'resending';

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [pageState, setPageState] = useState<PageState>('pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [resentBanner, setResentBanner] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const resentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Email comes from auth context or fallback stored at registration/login
  const pendingEmail =
    user?.email ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('verify_email') ?? '' : '');

  // If already verified, bounce to dashboard
  useEffect(() => {
    if (user?.email_verified) {
      router.replace(
        user.role === 'inbound_supplier' ? '/supplier-portal'
        : user.role === 'buyer' ? '/buyer/dashboard'
        : '/dashboard'
      );
    }
  }, [user, router]);

  // Clean up resent timer on unmount
  useEffect(() => {
    return () => { if (resentTimer.current) clearTimeout(resentTimer.current); };
  }, []);

  const submitCode = useCallback(async (code: string) => {
    setPageState('submitting');
    setErrorMsg('');
    try {
      const res = await api.post('/auth/verify-email/', { code });
      const setupToken: string = res.data?.data?.setup_token ?? '';
      setPageState('success');
      clearTokens();
      sessionStorage.removeItem('verify_email');
      if (setupToken) sessionStorage.setItem('setup_token', setupToken);
      setTimeout(() => router.push('/mfa-setup'), 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid or expired code.';
      setErrorMsg(msg);
      setPageState('error');
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputs.current[0]?.focus(), 50);
    }
  }, [router]);

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
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const resend = async () => {
    if (!pendingEmail) return;
    setPageState('resending');
    setErrorMsg('');
    setDigits(Array(CODE_LENGTH).fill(''));
    setResentBanner(false);
    if (resentTimer.current) clearTimeout(resentTimer.current);
    try {
      await api.post('/auth/resend-verification/', { email: pendingEmail });
    } catch {
      // silent — show banner regardless
    }
    setPageState('pending');
    setResentBanner(true);
    setTimeout(() => inputs.current[0]?.focus(), 50);
    // Auto-dismiss banner after 5 seconds
    resentTimer.current = setTimeout(() => setResentBanner(false), 5000);
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Email verified!</h1>
          <p className="text-gray-500 text-sm">Setting up two-factor authentication…</p>
        </div>
      </div>
    );
  }

  const isSubmitting = pageState === 'submitting';
  const isResending  = pageState === 'resending';

  // ── Main OTP form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
            {isSubmitting
              ? <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              : <MailCheck className="h-8 w-8 text-blue-600" />
            }
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-gray-700">{pendingEmail || 'your email'}</span>.
            <br />Enter it below — valid for 15 minutes.
          </p>
        </div>

        {/* ── Resent success banner ── */}
        {resentBanner && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-left">
            <div className="shrink-0 h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">New code sent!</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Check your inbox at{' '}
                <span className="font-medium">{pendingEmail}</span>
              </p>
            </div>
            <button
              onClick={() => setResentBanner(false)}
              className="ml-auto text-emerald-400 hover:text-emerald-600 transition-colors"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* OTP boxes */}
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {digits.map((digit, i) => {
            const isFocused = focusedIdx === i;
            return (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isSubmitting || isResending}
                autoFocus={i === 0}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={() => setFocusedIdx(i)}
                onBlur={() => setFocusedIdx(null)}
                style={{
                  width: 48,
                  height: 56,
                  textAlign: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: isFocused
                    ? '2px solid #2563eb'
                    : digit
                      ? '2px solid #2563eb'
                      : '2px solid #d1d5db',
                  background: digit ? '#eff6ff' : '#f9fafb',
                  color: '#111827',
                  outline: 'none',
                  boxShadow: isFocused ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  opacity: (isSubmitting || isResending) ? 0.5 : 1,
                  cursor: (isSubmitting || isResending) ? 'not-allowed' : 'text',
                }}
              />
            );
          })}
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
            loading={isResending}
            disabled={isSubmitting}
          >
            {!isResending && <RefreshCw className="h-4 w-4 mr-1.5" />}
            {isResending ? 'Sending…' : 'Resend code'}
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
