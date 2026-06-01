'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Loader2 as SpinnerFallback } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api, setTokens } from '@/lib/api';
import { AxiosError } from 'axios';
import {
  Building2, User, MapPin, FileText, CheckCircle2,
  Eye, EyeOff, Upload, X, ChevronRight, ChevronLeft,
  Loader2, ShieldCheck, ArrowRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InviteInfo {
  email: string;
  first_name: string;
  last_name: string;
  company_name_hint: string;
  role: string;
  message: string;
  invited_by: string | null;
  expires_at: string;
}

interface UploadedDoc {
  file: File;
  document_type: string;
  notes: string;
  preview?: string;
}

const EMIRATE_CHOICES = [
  { value: 'abu_dhabi', label: 'Abu Dhabi' },
  { value: 'dubai', label: 'Dubai' },
  { value: 'sharjah', label: 'Sharjah' },
  { value: 'ajman', label: 'Ajman' },
  { value: 'umm_al_quwain', label: 'Umm Al Quwain' },
  { value: 'ras_al_khaimah', label: 'Ras Al Khaimah' },
  { value: 'fujairah', label: 'Fujairah' },
];

const BUSINESS_TYPES = [
  { value: 'llc', label: 'Limited Liability Company (LLC)' },
  { value: 'sole', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'branch', label: 'Branch of Foreign Company' },
  { value: 'freezone', label: 'Free Zone Company' },
  { value: 'civil', label: 'Civil Company' },
  { value: 'public', label: 'Public Joint Stock Company' },
  { value: 'private', label: 'Private Joint Stock Company' },
];

const INDUSTRY_TYPES = [
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading', label: 'Trading' },
  { value: 'retail', label: 'Retail' },
  { value: 'construction', label: 'Construction' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'education', label: 'Education' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPES = [
  { value: 'trade_license', label: 'Trade License' },
  { value: 'trn_certificate', label: 'TRN Certificate' },
  { value: 'vat_certificate', label: 'VAT Certificate' },
  { value: 'memorandum', label: 'Memorandum of Association' },
  { value: 'other', label: 'Other' },
];

const STEPS = [
  { id: 1, label: 'Account',   icon: User },
  { id: 2, label: 'Company',   icon: Building2 },
  { id: 3, label: 'Address',   icon: MapPin },
  { id: 4, label: 'Documents', icon: FileText },
];

// ─── Field components ─────────────────────────────────────────────────────────

function Field({
  label, error, children, required, className = '',
}: { label: string; error?: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors
      ${error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-300 bg-white focus:border-brand-500 focus:ring-brand-100'}
      focus:outline-none focus:ring-2 ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }
>(({ error, children, className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors
      ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white focus:border-brand-500 focus:ring-brand-100'}
      focus:outline-none focus:ring-2 ${className}`}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

// ─── Main component ───────────────────────────────────────────────────────────

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState(1);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  // Documents
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const docRef = useRef<HTMLInputElement>(null);

  // Password visibility
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm({
    defaultValues: {
      first_name: '', last_name: '', password: '', confirm_password: '',
      company_name: '', company_legal_name: '', trn: '', trade_license_number: '',
      business_type: '', industry_type: '',
      street_address: '', city: '', emirate: 'dubai', po_box: '', country: 'AE',
      company_phone: '', company_email: '', website: '',
      contact_person_name: '', contact_person_email: '', contact_person_phone: '',
    },
  });

  // ── Validate token on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setTokenError('No invitation token found.'); setTokenLoading(false); return; }
    api.get(`/onboarding/invite/validate/?token=${token}`)
      .then(res => {
        const d = res.data.data as InviteInfo;
        setInvite(d);
        if (d.first_name) setValue('first_name', d.first_name);
        if (d.last_name)  setValue('last_name', d.last_name);
        if (d.company_name_hint) setValue('company_name', d.company_name_hint);
      })
      .catch(err => {
        const msg = (err as AxiosError<{ error?: { message?: string } }>)
          ?.response?.data?.error?.message ?? 'Invalid or expired invitation.';
        setTokenError(msg);
      })
      .finally(() => setTokenLoading(false));
  }, [token, setValue]);

  // ── Navigation helpers ───────────────────────────────────────────────────
  const STEP_FIELDS: Record<number, string[]> = {
    1: ['first_name', 'last_name', 'password', 'confirm_password'],
    2: ['company_name', 'trn', 'business_type', 'industry_type'],
    3: ['street_address', 'city', 'emirate'],
    4: [],
  };

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step] as never[]);
    if (valid) setStep(s => Math.min(s + 1, 4));
  };
  const back = () => setStep(s => Math.max(s - 1, 1));

  // ── Logo handling ────────────────────────────────────────────────────────
  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  // ── Document handling ────────────────────────────────────────────────────
  const addDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocs = files.map(f => ({ file: f, document_type: 'other', notes: '' }));
    setDocs(prev => [...prev, ...newDocs]);
    e.target.value = '';
  };

  const removeDoc = (i: number) => setDocs(prev => prev.filter((_, idx) => idx !== i));
  const updateDocType = (i: number, v: string) =>
    setDocs(prev => prev.map((d, idx) => idx === i ? { ...d, document_type: v } : d));

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: Record<string, string>) => {
    setSubmitting(true);
    setServerError('');
    try {
      const form = new FormData();
      form.append('token', token);
      Object.entries(data).forEach(([k, v]) => { if (v) form.append(k, v); });
      if (logoFile) form.append('logo', logoFile);
      docs.forEach((doc, i) => {
        form.append(`doc_${i}_file`, doc.file);
        form.append(`doc_${i}_type`, doc.document_type);
        if (doc.notes) form.append(`doc_${i}_notes`, doc.notes);
      });

      const res = await api.post('/onboarding/invite/accept/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { tokens } = res.data.data;
      setTokens(tokens.access, tokens.refresh);
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, unknown> } }>;
      const apiErr = e.response?.data?.error;
      if (apiErr?.details) {
        const msgs = Object.entries(apiErr.details as Record<string, string | string[]>)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : v}`)
          .join('\n');
        setServerError(msgs);
      } else {
        setServerError(apiErr?.message ?? 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="text-sm text-gray-500">{tokenError}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-brand-600 font-semibold hover:underline"
          >
            Sign in instead →
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registration Complete!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your company has been registered and is under review. You will be notified once approved.
            Redirecting to dashboard…
          </p>
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          </div>
        </div>
      </div>
    );
  }

  const pw = watch('password');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-900 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">E-Numerak</span>
          <span className="text-gray-400 text-sm ml-2">Company Registration</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Invite banner */}
          {invite && (
            <div className="mb-6 bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-brand-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-brand-800">
                  {invite.invited_by
                    ? `${invite.invited_by} has invited you to join E-Numerak`
                    : 'You have been invited to join E-Numerak'}
                </p>
                {invite.message && (
                  <p className="text-sm text-brand-600 mt-1 italic">"{invite.message}"</p>
                )}
                <p className="text-xs text-brand-500 mt-1">Registering as: {invite.email}</p>
              </div>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center mb-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all
                      ${done ? 'bg-emerald-500' : active ? 'bg-brand-600' : 'bg-gray-200'}`}>
                      {done
                        ? <CheckCircle2 className="h-5 w-5 text-white" />
                        : <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-400'}`} />
                      }
                    </div>
                    <span className={`text-xs mt-1 font-medium
                      ${active ? 'text-brand-700' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all
                      ${step > s.id ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form
              onSubmit={handleSubmit(onSubmit)}
              onKeyDown={(e) => { if (e.key === 'Enter' && step < 4) e.preventDefault(); }}
            >

              {/* ── Step 1: Account Setup ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Create your account</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Registering as <span className="font-semibold text-gray-700">{invite?.email}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First name" error={errors.first_name?.message} required>
                      <Input
                        placeholder="Ahmed"
                        error={errors.first_name?.message}
                        {...register('first_name', { required: 'Required' })}
                      />
                    </Field>
                    <Field label="Last name" error={errors.last_name?.message} required>
                      <Input
                        placeholder="Al Mansouri"
                        error={errors.last_name?.message}
                        {...register('last_name', { required: 'Required' })}
                      />
                    </Field>
                  </div>
                  <Field label="Password" error={errors.password?.message} required>
                    <div className="relative">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        error={errors.password?.message}
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 8, message: 'Minimum 8 characters' },
                        })}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm password" error={errors.confirm_password?.message} required>
                    <div className="relative">
                      <Input
                        type={showCpw ? 'text' : 'password'}
                        placeholder="Repeat password"
                        error={errors.confirm_password?.message}
                        {...register('confirm_password', {
                          required: 'Please confirm your password',
                          validate: v => v === pw || 'Passwords do not match',
                        })}
                      />
                      <button type="button" onClick={() => setShowCpw(!showCpw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                </div>
              )}

              {/* ── Step 2: Company Info ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Company information</h2>
                    <p className="text-sm text-gray-500 mt-1">Legal details as per your trade license</p>
                  </div>

                  {/* Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                    <div className="flex items-center gap-4">
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
                        : <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                            <Building2 className="h-6 w-6 text-gray-400" />
                          </div>
                      }
                      <div>
                        <button type="button" onClick={() => logoRef.current?.click()}
                          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          {logoPreview ? 'Change logo' : 'Upload logo'}
                        </button>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2 MB</p>
                      </div>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                    </div>
                  </div>

                  <Field label="Company name" error={errors.company_name?.message} required>
                    <Input
                      placeholder="Al Mansouri Trading LLC"
                      error={errors.company_name?.message}
                      {...register('company_name', { required: 'Company name is required' })}
                    />
                  </Field>
                  <Field label="Legal name" error={errors.company_legal_name?.message}>
                    <Input
                      placeholder="Same as company name if identical"
                      {...register('company_legal_name')}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="TRN (Tax Registration Number)" error={errors.trn?.message} required>
                      <Input
                        placeholder="100123456700003"
                        maxLength={15}
                        error={errors.trn?.message}
                        {...register('trn', {
                          required: 'TRN is required',
                          pattern: { value: /^\d{15}$/, message: '15 digits required' },
                        })}
                      />
                    </Field>
                    <Field label="Trade License Number" error={errors.trade_license_number?.message}>
                      <Input placeholder="DED-2024-12345" {...register('trade_license_number')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Business type" error={errors.business_type?.message}>
                      <Select {...register('business_type')}>
                        <option value="">Select type…</option>
                        {BUSINESS_TYPES.map(b => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Industry" error={errors.industry_type?.message}>
                      <Select {...register('industry_type')}>
                        <option value="">Select industry…</option>
                        {INDUSTRY_TYPES.map(i => (
                          <option key={i.value} value={i.value}>{i.label}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Step 3: Address & Contact ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Address & contact</h2>
                    <p className="text-sm text-gray-500 mt-1">Registered address and contact details</p>
                  </div>
                  <Field label="Street address" error={errors.street_address?.message} required>
                    <Input
                      placeholder="Office 401, Al Barsha Business Centre"
                      error={errors.street_address?.message}
                      {...register('street_address', { required: 'Street address is required' })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City" error={errors.city?.message} required>
                      <Input
                        placeholder="Dubai"
                        error={errors.city?.message}
                        {...register('city', { required: 'City is required' })}
                      />
                    </Field>
                    <Field label="Emirate" error={errors.emirate?.message} required>
                      <Select {...register('emirate', { required: 'Required' })}>
                        {EMIRATE_CHOICES.map(e => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="P.O. Box">
                      <Input placeholder="12345" {...register('po_box')} />
                    </Field>
                    <Field label="Country">
                      <Input placeholder="AE" maxLength={2} {...register('country')} />
                    </Field>
                  </div>
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-sm font-semibold text-gray-700 mb-4">Company contact</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Phone">
                        <Input placeholder="+971 4 000 0000" {...register('company_phone')} />
                      </Field>
                      <Field label="Company email">
                        <Input type="email" placeholder="info@company.ae" {...register('company_email')} />
                      </Field>
                    </div>
                    <Field label="Website" className="mt-4">
                      <Input placeholder="https://company.ae" {...register('website')} />
                    </Field>
                  </div>
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-sm font-semibold text-gray-700 mb-4">Contact person</p>
                    <Field label="Full name">
                      <Input placeholder="Ahmed Al Mansouri" {...register('contact_person_name')} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <Field label="Email">
                        <Input type="email" placeholder="ahmed@company.ae" {...register('contact_person_email')} />
                      </Field>
                      <Field label="Phone">
                        <Input placeholder="+971 50 000 0000" {...register('contact_person_phone')} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Documents ── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Upload documents</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload your trade license, TRN certificate, and other required documents.
                      All documents are reviewed by our compliance team.
                    </p>
                  </div>

                  {/* Upload zone */}
                  <button
                    type="button"
                    onClick={() => docRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center
                      gap-3 hover:border-brand-400 hover:bg-brand-50/40 transition-colors group"
                  >
                    <Upload className="h-8 w-8 text-gray-400 group-hover:text-brand-500 transition-colors" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">Click to upload documents</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG up to 10 MB each</p>
                    </div>
                  </button>
                  <input ref={docRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={addDoc} />

                  {/* Document list */}
                  {docs.length > 0 && (
                    <div className="space-y-3">
                      {docs.map((doc, i) => (
                        <div key={i}
                          className="flex items-center gap-3 p-3.5 border border-gray-200 rounded-xl bg-gray-50">
                          <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.file.name}</p>
                            <p className="text-xs text-gray-400">{(doc.file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <select
                            value={doc.document_type}
                            onChange={e => updateDocType(i, e.target.value)}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                          >
                            {DOC_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => removeDoc(i)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {docs.length === 0 && (
                    <p className="text-xs text-center text-gray-400">
                      You can also upload documents later from your dashboard.
                    </p>
                  )}

                  {/* Server error */}
                  {serverError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
                      {serverError}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={back}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300
                    text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors
                    ${step === 1 ? 'invisible' : ''}`}
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>

                {step < 4
                  ? (
                    <button
                      type="button"
                      onClick={next}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600
                        text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  )
                  : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600
                        text-white text-sm font-semibold hover:bg-brand-700 transition-colors
                        disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</>
                        : <><ArrowRight className="h-4 w-4" /> Complete Registration</>
                      }
                    </button>
                  )
                }
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Already have an account?{' '}
            <button onClick={() => router.push('/login')}
              className="text-brand-600 font-semibold hover:underline">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SpinnerFallback className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
