'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AxiosError } from 'axios';
import {
  ShieldCheck, FileText, Network, Landmark, CheckCircle2, ArrowRight, MailWarning,
} from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
}

const FEATURES = [
  {
    icon: FileText,
    title: 'UAE FTA Compliant',
    desc: 'Fully compliant with Federal Decree-Law No. 16 of 2024 e-invoicing mandate.',
  },
  {
    icon: Network,
    title: 'PEPPOL 5-Corner',
    desc: 'End-to-end transmission via accredited ASP through the OpenPEPPOL network.',
  },
  {
    icon: ShieldCheck,
    title: 'ASP Validated',
    desc: 'Every invoice validated and digitally signed before delivery to the buyer.',
  },
  {
    icon: Landmark,
    title: 'Automatic FTA Reporting',
    desc: 'Invoice extracts reported to the Ministry of Finance data platform (Corner 5).',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [unverified, setUnverified] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    setUnverified(false);
    try {
      await login(data.email, data.password);
    } catch (err) {
      if ((err as { code?: string }).code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
        return;
      }
      const e = err as AxiosError<{ detail?: string; error?: { message?: string } }>;
      setServerError(
        e.response?.data?.detail ||
        e.response?.data?.error?.message ||
        'Invalid credentials. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between
                      bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900
                      px-12 py-12 text-white relative overflow-hidden">

        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-500/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">UAE E-Invoicing</span>
          </div>
          <p className="text-white/50 text-sm ml-12">PEPPOL 5-Corner Platform</p>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              The UAE&apos;s compliant<br />e-invoicing platform
            </h2>
            <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-sm">
              Issue, validate, and report tax invoices in full compliance with the UAE
              FTA mandate — powered by the PEPPOL BIS 3.0 standard.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center mt-0.5">
                  <Icon className="h-4 w-4 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer badges */}
        <div className="relative z-10 flex items-center gap-3 flex-wrap">
          {['FTA Certified', 'PEPPOL BIS 3.0', 'UBL 2.1', 'VAT Compliant'].map((badge) => (
            <span
              key={badge}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-white/70 border border-white/10"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-900">UAE E-Invoicing</h1>
            <p className="text-gray-500 mt-1 text-sm">PEPPOL 5-Corner Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your account to continue</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@company.ae"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                })}
              />

              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password', { required: 'Password is required' })}
                />
                <div className="mt-1.5 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {unverified && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <MailWarning className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-semibold">Email not verified</p>
                      <p className="mt-0.5 text-amber-700">
                        Your account is not verified. Please verify your email before accessing your account.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/verify-email')}
                        className="mt-2 text-amber-900 font-semibold underline underline-offset-2 hover:text-amber-700"
                      >
                        Verify email now →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Sign in
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-brand-600 font-semibold hover:underline">
                Create one free
              </Link>
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Secure JWT authentication — data encrypted in transit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
