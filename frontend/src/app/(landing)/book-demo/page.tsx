'use client';

import { useState } from 'react';
import type { AxiosError } from 'axios';
import {
  Calendar, CheckCircle2, ChevronRight,
  ShieldCheck, Zap, Users, Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import { validateEmail, validatePersonName } from '@/lib/validation';
import { AnimatedSection } from '../AnimatedSection';

type FormField = 'full_name' | 'email' | 'phone' | 'company' | 'message';
type FieldErrors = Partial<Record<FormField, string>>;

function validateDemoForm(form: Record<FormField, string>): FieldErrors {
  const errors: FieldErrors = {};

  const name = validatePersonName(form.full_name);
  if (name !== true) errors.full_name = name;

  const email = validateEmail(form.email);
  if (email !== true) errors.email = email;

  if (form.phone.trim()) {
    if (form.phone.trim().length > 30) {
      errors.phone = 'Phone number is too long (maximum 30 characters).';
    } else {
      const digits = form.phone.replace(/[\s\-().+]/g, '');
      if (!/^\d+$/.test(digits)) {
        errors.phone = 'Phone number must contain only digits, spaces, hyphens, or parentheses.';
      } else if (digits.length < 7 || digits.length > 15) {
        errors.phone = 'Phone number must be between 7 and 15 digits.';
      }
    }
  }

  const company = form.company.trim();
  if (!company) {
    errors.company = 'Company name is required.';
  } else if (company.length > 200) {
    errors.company = 'Company name must be 200 characters or fewer.';
  }

  if (form.message.trim().length > 1000) {
    errors.message = 'Message must be 1000 characters or fewer.';
  }

  return errors;
}

export default function BookDemoPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    company: '', message: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as FormField;
    if (field === 'phone' && (e.target.value.match(/\d/g) ?? []).length > 15) return;
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fieldErrors = validateDemoForm(form);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/demo/', {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      const details = (err as AxiosError<{ error?: { details?: FieldErrors } }>)
        ?.response?.data?.error?.details;
      if (details && Object.keys(details).length) {
        setErrors(prev => ({ ...prev, ...details }));
        setError('Please fix the highlighted fields and try again.');
      } else {
        setError('Something went wrong. Please try again or email us directly.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="ltr">
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1b35] via-[#1e4080] to-[#0f2147] text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[150px] animate-pulse-glow" />
          <div className="absolute top-1/3 -right-32 w-[450px] h-[450px] rounded-full bg-indigo-500/15 blur-[120px] animate-float" />
          <div className="absolute -bottom-32 left-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-float-delayed" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-start">
            {/* ── Left: Value Prop ── */}
            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  Free Demo
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
                  See{' '}
                  <span className="bg-gradient-to-r from-blue-300 via-blue-200 to-cyan-200 bg-clip-text text-transparent">
                    E-Numerak
                  </span>{' '}
                  in Action
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={200} direction="up">
                <p className="text-lg text-blue-100/80 leading-relaxed mb-10 max-w-lg">
                  Book a personalized walkthrough with our team. See how E-Numerak simplifies
                  FTA-compliant e-invoicing for your business — in under 30 minutes.
                </p>
              </AnimatedSection>

              <AnimatedSection delay={300} direction="up">
                <div className="space-y-4">
                  {[
                    { icon: <Zap className="h-4 w-4" />, title: 'Live Platform Demo', desc: 'See the real dashboard, not a slide deck' },
                    { icon: <ShieldCheck className="h-4 w-4" />, title: 'FTA Compliance Walkthrough', desc: 'Understand how every invoice meets UAE regulations' },
                    { icon: <Users className="h-4 w-4" />, title: 'Q&A with Our Team', desc: 'Get your specific questions answered on the spot' },
                    { icon: <Star className="h-4 w-4" />, title: 'Custom Use Case', desc: 'We tailor the demo to your business needs' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3.5">
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/20 shrink-0 mt-0.5 text-blue-300">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-blue-200/60 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AnimatedSection>


            </div>

            {/* ── Right: Form ── */}
            <AnimatedSection delay={200} direction="right" className="w-full">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 blur-3xl rounded-3xl" />
                <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
                  {/* Form header */}
                  <div className="px-8 pt-8 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2.5 mb-1">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Book Your Free Demo</h2>
                    </div>
                    <p className="text-xs text-gray-500">Fill in your details and we&apos;ll reach out within 24 hours</p>
                  </div>

                  {submitted ? (
                    <div className="px-8 py-16 text-center">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mx-auto mb-5">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Thank You, {form.full_name.split(' ')[0]}!</h3>
                      <p className="text-xs text-emerald-600 font-semibold mb-5">Your request has been received</p>
                      <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-3">
                        A member of our team will reach out to you at{' '}
                        <span className="font-semibold text-gray-700">{form.email}</span> within 24 hours to
                        schedule your personalized walkthrough.
                      </p>
                      <p className="text-xs text-gray-400">
                        Need immediate assistance? Call{' '}
                        <a href="tel:+971506358421" className="text-blue-600 hover:underline font-semibold">+971 50 635 8421</a>
                      </p>
                    </div>
                  ) : (
                    <form className="px-8 py-6 space-y-5" onSubmit={handleSubmit} noValidate>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name *</label>
                          <input
                            name="full_name" value={form.full_name} onChange={handleChange}
                            type="text" placeholder="John Doe" maxLength={200}
                            aria-invalid={!!errors.full_name}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 ${errors.full_name ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                          />
                          {errors.full_name && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {errors.full_name}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
                          <input
                            name="email" value={form.email} onChange={handleChange}
                            type="email" placeholder="john@company.com" maxLength={254}
                            aria-invalid={!!errors.email}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 ${errors.email ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                          />
                          {errors.email && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {errors.email}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number</label>
                          <input
                            name="phone" value={form.phone} onChange={handleChange}
                            type="tel" placeholder="+971 50 123 4567" maxLength={30}
                            aria-invalid={!!errors.phone}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 ${errors.phone ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                          />
                          {errors.phone && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {errors.phone}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company Name *</label>
                          <input
                            name="company" value={form.company} onChange={handleChange}
                            type="text" placeholder="Your Company LLC" maxLength={200}
                            aria-invalid={!!errors.company}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50/50 ${errors.company ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                          />
                          {errors.company && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {errors.company}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message / Questions</label>
                        <textarea
                          name="message" value={form.message} onChange={handleChange}
                          rows={3} placeholder="Tell us about your business and what you'd like to see in the demo..."
                          maxLength={1000}
                          aria-invalid={!!errors.message}
                          className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none bg-gray-50/50 ${errors.message ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                        />
                        <div className="mt-1 flex items-center justify-between">
                          {errors.message ? (
                            <p className="text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {errors.message}</p>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] text-gray-400">{form.message.length}/1000</span>
                        </div>
                      </div>

                      {error && (
                        <p className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                          <span>⚠</span> {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending...
                          </>
                        ) : (
                          <>
                            Book My Free Demo
                            <ChevronRight className="h-4 w-4" />
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                        By submitting, you agree to our{' '}
                        <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>.
                        We respect your data and will never share it.
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Wave separator */}
        <svg viewBox="0 0 1440 80" className="w-full -mb-1" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
        </svg>
      </section>

      {/* ── Why Section ── */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection delay={0} direction="up">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.1em] mb-4">
                Why Book a Demo
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                See Why Businesses Trust E-Numerak
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck className="h-6 w-6" />,
                title: 'FTA-Certified Platform',
                desc: 'Built to meet UAE FTA standards. Every invoice is formatted, validated, and submission-ready.',
                gradient: 'from-blue-600 to-blue-400',
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: 'Real-Time Validation',
                desc: 'Catch errors before submission. Our engine validates every field against FTA schema in seconds.',
                gradient: 'from-emerald-500 to-emerald-400',
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: 'Role-Based Team Access',
                desc: 'Assign Admin, Accountant, or Viewer roles. Keep control while empowering your finance team.',
                gradient: 'from-amber-500 to-amber-400',
              },
            ].map((card, i) => (
              <AnimatedSection key={i} delay={i * 100} direction="up">
                <div className="bg-white rounded-2xl border border-gray-200 p-7 h-full hover:shadow-lg hover:border-gray-300 transition-all duration-300 group">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    {card.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Contact info */}
          <AnimatedSection delay={500} direction="up">
            <div className="mt-12 text-center">
              <p className="text-sm text-gray-500">
                Prefer to talk now? Call us at{' '}
                <a href="tel:+971506358421" className="text-blue-600 font-semibold hover:underline">+971 50 635 8421</a>
                {' '}or email{' '}
                <a href="mailto:info@e-numerak.com" className="text-blue-600 font-semibold hover:underline">info@e-numerak.com</a>
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
