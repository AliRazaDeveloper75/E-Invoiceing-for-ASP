'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AxiosError } from 'axios';
import type { APISuccess } from '@/types';
import {
  ShieldCheck, Smartphone, KeyRound, Copy, Check,
  ArrowLeft, ChevronRight,
} from 'lucide-react';

interface SetupData {
  secret: string;
  qr_uri: string;
}

type Step = 'loading' | 'scan' | 'verify' | 'error';

export default function MFASetupPage() {
  const { completeMfaSetup } = useAuth();
  const router = useRouter();

  const [step, setStep]         = useState<Step>('loading');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);

  const setupToken = typeof window !== 'undefined'
    ? sessionStorage.getItem('setup_token') ?? ''
    : '';

  // Redirect if no setup_token
  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('setup_token')) {
      router.replace('/login');
    }
  }, [router]);

  // Fetch QR data on mount
  useEffect(() => {
    if (!setupToken) return;

    const fetchSetup = async () => {
      try {
        const { data } = await api.post<APISuccess<SetupData>>(
          '/auth/mfa/setup-login/',
          { setup_token: setupToken },
        );
        setSetupData(data.data);
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(data.data.qr_uri, { width: 220, margin: 2 });
        setQrDataUrl(dataUrl);
        setStep('scan');
      } catch (err) {
        const e = err as AxiosError<{ error?: { message?: string } }>;
        const msg = e.response?.data?.error?.message || 'Session expired. Please log in again.';
        setError(msg);
        setStep('error');
      }
    };

    fetchSetup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupToken]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await completeMfaSetup(setupToken, code);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setError(e.response?.data?.error?.message || 'Invalid code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <Button onClick={() => router.push('/login')}>Back to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-5">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

          {/* Title */}
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Secure Your Account</h1>
              <p className="mt-1 text-sm text-gray-500">
                Two-factor authentication is required to access the platform.
                This takes under a minute.
              </p>
            </div>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className={`flex items-center gap-1.5 font-semibold ${step === 'scan' ? 'text-brand-600' : 'text-gray-400'}`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${step === 'scan' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'}`}>1</span>
              Scan QR code
            </span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className={`flex items-center gap-1.5 font-semibold ${step === 'verify' ? 'text-brand-600' : 'text-gray-400'}`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${step === 'verify' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'}`}>2</span>
              Verify code
            </span>
          </div>

          {/* ── Step 1: Scan QR ── */}
          {step === 'scan' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                <Smartphone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Install <strong>Google Authenticator</strong> on your phone.
                  Tap <strong>+</strong> → <strong>Scan a QR code</strong>.
                </p>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="MFA QR code"
                    width={220}
                    height={220}
                    className="rounded-xl border border-gray-200 shadow-sm"
                  />
                ) : (
                  <div className="h-[220px] w-[220px] rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
                  </div>
                )}

                {/* Manual secret */}
                {setupData && (
                  <div className="w-full space-y-1">
                    <p className="text-xs text-gray-500 text-center">
                      Can&apos;t scan? Enter this key manually:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-sm font-mono text-gray-800 tracking-widest text-center select-all">
                        {setupData.secret}
                      </code>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {copied
                          ? <Check className="h-4 w-4 text-emerald-500" />
                          : <Copy className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => setStep('verify')} disabled={!setupData}>
                I&apos;ve scanned the QR code
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Enter code ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Open <strong>Google Authenticator</strong> and enter the
                  6-digit code shown for <strong>UAE E-Invoicing</strong>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authenticator Code
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setStep('scan'); setError(''); setCode(''); }}
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={loading}
                  disabled={code.length !== 6}
                >
                  <KeyRound className="h-4 w-4 mr-1.5" />
                  Verify &amp; Access Dashboard
                </Button>
              </div>
            </form>
          )}

          {/* Loading skeleton */}
          {step === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-7 w-7 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('setup_token');
            router.push('/login');
          }}
          className="flex items-center gap-1.5 mx-auto text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </button>
      </div>
    </div>
  );
}
