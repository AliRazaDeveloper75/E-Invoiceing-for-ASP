'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { api, setTokens } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AxiosError } from 'axios';
import {
  FileText, ShieldCheck, Network, Landmark, CheckCircle2, ArrowRight,
  Building2, Truck,
} from 'lucide-react';

interface RegisterForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role: 'supplier' | 'accountant';
}

const STEPS = [
  {
    icon: FileText,
    title: 'Create invoices instantly',
    desc: 'Generate PEPPOL BIS 3.0 compliant e-invoices in seconds.',
  },
  {
    icon: Network,
    title: 'Transmit via PEPPOL network',
    desc: 'Invoices delivered end-to-end through accredited ASP infrastructure.',
  },
  {
    icon: ShieldCheck,
    title: 'Validated & digitally signed',
    desc: 'Every invoice ASP-validated before delivery to the buyer.',
  },
  {
    icon: Landmark,
    title: 'Auto FTA reporting',
    desc: 'Invoice extracts automatically reported to the MoF data platform.',
  },
];

const ROLES = [
  {
    value: 'supplier',
    label: 'Supplier',
    desc: 'Issue & submit outbound invoices to buyers',
    icon: Building2,
  },
  {
    value: 'accountant',
    label: 'Accountant',
    desc: 'Manage invoices on behalf of your company',
    icon: Truck,
  },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ defaultValues: { role: 'supplier' } });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    setServerError('');
    try {
      const res = await api.post('/auth/register/', {
        email: data.email,
        password: data.password,
        confirm_password: data.confirm_password,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
      });
      setTokens(res.data.data.tokens.access, res.data.data.tokens.refresh);
      router.push('/verify-email');
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string | string[]> } }>;
      const details = e.response?.data?.error?.details;
      if (details) {
        const msgs = Object.entries(details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join('; ');
        setServerError(msgs);
      } else {
        setServerError(e.response?.data?.error?.message ?? 'Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-900">E-Numerak</h1>
            <p className="text-gray-500 mt-1 text-sm">E-Invoicing Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-gray-500 mt-1 text-sm">Get started with UAE e-invoicing today</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  I am registering as
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(({ value, label, desc, icon: Icon }) => {
                    const active = selectedRole === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValue('role', value)}
                        className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-left transition-all
                          ${active
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center
                          ${active ? 'bg-brand-100' : 'bg-gray-100'}`}>
                          <Icon className={`h-4 w-4 ${active ? 'text-brand-600' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-gray-700'}`}>
                          {label}
                        </span>
                        <span className="text-xs text-gray-400 leading-tight">{desc}</span>
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center self-end
                          ${active ? 'border-brand-500' : 'border-gray-300'}`}>
                          {active && <div className="h-2 w-2 rounded-full bg-brand-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" {...register('role')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First name"
                  placeholder="Ahmed"
                  error={errors.first_name?.message}
                  {...register('first_name', { required: 'Required' })}
                />
                <Input
                  label="Last name"
                  placeholder="Al Mansouri"
                  error={errors.last_name?.message}
                  {...register('last_name', { required: 'Required' })}
                />
              </div>

              <Input
                label="Email address"
                type="email"
                placeholder="you@company.ae"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                })}
              />

              <Input
                label="Password"
                type="password"
                placeholder="Min. 8 characters"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                })}
              />

              <Input
                label="Confirm password"
                type="password"
                placeholder="Repeat password"
                error={errors.confirm_password?.message}
                {...register('confirm_password', {
                  required: 'Please confirm your password',
                  validate: (v) => v === watch('password') || 'Passwords do not match',
                })}
              />

              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Create account
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-600 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Secure JWT authentication — data encrypted in transit
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — branding ───────────────────────────────────────── */}
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
            <span className="text-xl font-bold tracking-tight">E-Numerak</span>
          </div>
          <p className="text-white/50 text-sm ml-12">E-Invoicing Platform</p>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Start issuing compliant<br />invoices in minutes
            </h2>
            <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-sm">
              Join UAE businesses already using the platform to issue, validate,
              and report tax invoices under Federal Decree-Law No. 16 of 2024.
            </p>
          </div>

          {/* Step list */}
          <div className="space-y-4">
            {STEPS.map(({ icon: Icon, title, desc }) => (
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
    </div>
  );
}
