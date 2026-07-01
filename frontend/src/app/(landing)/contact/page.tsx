'use client';

import { useState } from 'react';
import {
  Mail, MapPin, Phone, MessageSquare, ExternalLink,
  CheckCircle2, Send, Sparkles, ChevronDown, Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '../AnimatedSection';

const ITEM_ICONS = [
  <Mail key="0" className="h-5 w-5" />,
  <Phone key="1" className="h-5 w-5" />,
  <MapPin key="2" className="h-5 w-5" />,
];

const ITEM_GRADIENTS = [
  'from-blue-600 to-blue-400 shadow-blue-500/25',
  'from-emerald-500 to-emerald-400 shadow-emerald-500/25',
  'from-amber-500 to-amber-400 shadow-amber-500/25',
];

export default function ContactPage() {
  const { t } = useI18n();
  const subjects = t<{ value: string; label: string }[]>('contact.subjects');
  const contactItems = t<{ label: string; value: string; sub: string }[]>('contact.items');
  const faqs = t<{ q: string; a: string }[]>('contact.faqs');

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    company: '', subject: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.message.trim()) {
      setError(t('contact.errRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/contact/', form);
      setSubmitted(true);
      setForm({ first_name: '', last_name: '', email: '', company: '', subject: '', message: '' });
    } catch {
      setError(t('contact.errGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-[#1e4080] to-[#0f2147] text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse-glow" />
          <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px] animate-float" />
          <div className="absolute -bottom-32 left-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[90px] animate-float-delayed" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

            {/* Left: Text content */}
            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  {t('contact.hero.tag')}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                  {t('contact.hero.title')}
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  {t('contact.hero.body')}
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['Email Support', 'Phone Support', 'Live Chat', '24/7 Help'].map((badge) => (
                    <span
                      key={badge}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-200 text-xs font-medium"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </AnimatedSection>
            </div>

            {/* Right: Support hub mockup */}
            <AnimatedSection delay={300} direction="right" className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 blur-3xl rounded-3xl" />

                <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 hover:shadow-blue-500/10 transition-shadow duration-500">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 text-blue-200/50 text-[10px] font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
                      e-numerak.com/support
                    </div>
                    <div className="w-14" />
                  </div>

                  {/* Mockup body */}
                  <div className="p-6 space-y-4">
                    {/* Support header */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Live Support</div>
                          <div className="text-[10px] text-blue-300/60">We're here to help</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-semibold text-emerald-300">Online</span>
                      </div>
                    </div>

                    {/* Team avatars row */}
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                      <div className="text-[10px] text-blue-200/50 font-medium mb-3">Support Team</div>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {[
                            { initial: 'S', gradient: 'from-blue-400 to-indigo-500' },
                            { initial: 'A', gradient: 'from-emerald-400 to-emerald-500' },
                            { initial: 'M', gradient: 'from-amber-400 to-amber-500' },
                            { initial: 'R', gradient: 'from-violet-400 to-violet-500' },
                          ].map((p, i) => (
                            <div
                              key={i}
                              className={`w-8 h-8 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#1e4080] transition-all duration-300 hover:scale-110 hover:-translate-y-1`}
                            >
                              {p.initial}
                            </div>
                          ))}
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-blue-300 ring-2 ring-[#1e4080]">
                            +3
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-blue-300/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          4 active
                        </div>
                      </div>
                    </div>

                    {/* Quick contact channels */}
                    <div className="space-y-2">
                      {[
                        { channel: 'Email Support', detail: 'support@e-numerak.com', icon: <Mail className="h-3.5 w-3.5" />, bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
                        { channel: 'Phone Line', detail: '+971 4 123 4567', icon: <Phone className="h-3.5 w-3.5" />, bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
                        { channel: 'Live Chat', detail: 'Avg. response 2 minutes', icon: <MessageSquare className="h-3.5 w-3.5" />, bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
                      ].map((c) => (
                        <div key={c.channel} className={`flex items-center justify-between ${c.bg} rounded-xl px-4 py-2.5 border border-white/[0.06] transition-all duration-200 hover:bg-white/10`}>
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 text-blue-200/70">
                              {c.icon}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{c.channel}</div>
                              <div className="text-[9px] text-blue-300/50">{c.detail}</div>
                            </div>
                          </div>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        </div>
                      ))}
                    </div>

                    {/* Response time badge */}
                    <div className="bg-white/[0.03] rounded-xl p-3.5 border border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10">
                          <Clock className="h-4 w-4 text-blue-200/70" />
                        </div>
                        <div>
                          <div className="text-[11px] font-medium text-white">Typical Response Time</div>
                          <div className="text-[9px] text-blue-300/50">Mon–Fri, 9 AM – 6 PM GST</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-300">&lt; 2 hrs</div>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    We reply fast
                  </div>
                </div>
              </div>
            </AnimatedSection>

          </div>
        </div>
        <svg viewBox="0 0 1440 80" className="w-full -mb-1" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
        </svg>
      </section>

      {/* Main: Form + Info */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">

            {/* Form */}
            <div className="lg:col-span-3">
              <AnimatedSection direction="up" delay={0}>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <div className="p-8 lg:p-10">
                    <div className="flex items-center gap-3 mb-8 pb-5 border-b border-gray-100">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-900 to-brand-600 text-white shadow-md">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900 text-lg">{t('contact.formTitle')}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">We typically respond within 24 hours</p>
                      </div>
                    </div>

                    {submitted ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-5">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{t('contact.sentTitle')}</h3>
                        <p className="text-sm text-gray-500 mb-8 max-w-sm leading-relaxed">{t('contact.sentBody')}</p>
                        <button
                          onClick={() => setSubmitted(false)}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-900 hover:bg-brand-700 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {t('contact.sendAnother')}
                        </button>
                      </div>
                    ) : (
                      <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.firstName')} *</label>
                            <input
                              name="first_name" value={form.first_name} onChange={handleChange}
                              type="text" placeholder={t('contact.firstNamePh')}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.lastName')} *</label>
                            <input
                              name="last_name" value={form.last_name} onChange={handleChange}
                              type="text" placeholder={t('contact.lastNamePh')}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.email')} *</label>
                            <input
                              name="email" value={form.email} onChange={handleChange}
                              type="email" placeholder={t('contact.emailPh')}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.companyTrn')}</label>
                            <input
                              name="company" value={form.company} onChange={handleChange}
                              type="text" placeholder={t('contact.companyPh')}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.subject')}</label>
                          <div className="relative">
                            <select
                              name="subject" value={form.subject} onChange={handleChange}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                              <option value="">{t('contact.subjectPh')}</option>
                              {subjects.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.message')} *</label>
                          <textarea
                            name="message" value={form.message} onChange={handleChange}
                            rows={4} placeholder={t('contact.messagePh')}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                          />
                        </div>

                        {error && (
                          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            {error}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 pt-2">
                          <button
                            type="submit" disabled={submitting}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-900 to-brand-700 hover:from-brand-700 hover:to-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-900/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {submitting ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Sending...
                              </span>
                            ) : (
                              <>{t('contact.send')} <Send className="h-4 w-4" /></>
                            )}
                          </button>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            Average response: &lt; 24 hours
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </AnimatedSection>
            </div>

            {/* Sidebar: Info + Resources */}
            <div className="lg:col-span-2 space-y-8">
              <AnimatedSection direction="up" delay={100}>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 lg:p-8">
                  <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-brand-900" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('contact.infoTitle')}</span>
                  </div>
                  <div className="space-y-4">
                    {contactItems.map((item, i) => (
                      <div key={item.label} className="group flex items-start gap-4 transition-all duration-300 hover:-translate-x-0.5">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${ITEM_GRADIENTS[i]} text-white shadow-md shrink-0 transition-all duration-300 group-hover:scale-110`}
                        >
                          {ITEM_ICONS[i]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className="text-sm font-bold text-gray-900">{item.value}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.sub}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                        <p className="text-sm font-bold text-blue-900">{t('contact.resourcesTitle')}</p>
                      </div>
                      <p className="text-xs text-blue-700/80 leading-relaxed mb-3">{t('contact.resourcesBody')}</p>
                      <a
                        href="https://tax.gov.ae"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors group"
                      >
                        {t('contact.resourcesLink')}
                        <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" delay={0}>
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-semibold uppercase tracking-[0.12em] mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                FAQ
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                {t('contact.faqTitle')}
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mt-4 max-w-lg mx-auto">
                Quick answers to the most common questions about our platform and compliance.
              </p>
            </div>
          </AnimatedSection>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <AnimatedSection key={faq.q} delay={i * 100} direction="up">
                <details className="group bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-gray-300 open:shadow-md">
                  <summary className="flex items-center justify-between px-6 py-5 text-[15px] font-bold text-gray-900 cursor-pointer list-none transition-colors group-open:bg-white">
                    <span className="pr-4">{faq.q}</span>
                    <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 group-open:bg-brand-900 text-gray-500 group-open:text-white transition-all duration-300">
                      <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform duration-300" />
                    </span>
                  </summary>
                  <div className="px-6 pb-6 pt-2 bg-white border-t border-gray-100">
                    <p className="text-[15px] text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
