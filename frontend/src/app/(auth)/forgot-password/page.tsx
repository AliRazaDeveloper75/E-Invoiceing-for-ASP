'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { FileText, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AxiosError } from 'axios';

interface ForgotForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>();

  const onSubmit = async (data: ForgotForm) => {
    setServerError('');
    try {
      await api.post('/auth/forgot-password/', { email: data.email });
      setSent(true);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setServerError(e.response?.data?.error?.message ?? 'Something went wrong. Please try again.');
    }
  };

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
            <span className="text-xl font-bold tracking-tight">E-Numerak</span>
          </div>
          <p className="text-white/50 text-sm ml-12">E-Invoicing Platform</p>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Forgot your<br />password?
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            No problem. Enter your registered email and we&apos;ll send you a secure
            link to reset your password within 30 minutes.
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
            <h1 className="text-2xl font-bold text-brand-900">E-Numerak</h1>
            <p className="text-gray-500 mt-1 text-sm">E-Invoicing Platform</p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>

          {sent ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                If <span className="font-semibold text-gray-700">{getValues('email')}</span> is
                registered, we&apos;ve sent a password reset link. It expires in 30 minutes.
              </p>
              <p className="text-xs text-gray-400">
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-brand-600 font-semibold hover:underline"
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/login"
                className="block w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                           hover:bg-brand-700 text-center transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.ae"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                        {...register('email', {
                          required: 'Email is required',
                          pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' },
                        })}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  {serverError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold
                               hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
