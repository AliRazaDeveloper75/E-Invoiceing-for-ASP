'use client';

import { useState } from 'react';
import { Mail, MapPin, Phone, MessageSquare, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/context/I18nContext';

const ITEM_ICONS = [
  <Mail key="0" className="h-5 w-5" />,
  <Phone key="1" className="h-5 w-5" />,
  <MapPin key="2" className="h-5 w-5" />,
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
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">{t('contact.hero.tag')}</p>
            <h1 className="text-4xl font-bold mb-4">{t('contact.hero.title')}</h1>
            <p className="text-blue-100 text-lg leading-relaxed">{t('contact.hero.body')}</p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Contact form */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="h-5 w-5 text-[#1e3a5f]" />
                <h2 className="font-bold text-gray-900">{t('contact.formTitle')}</h2>
              </div>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t('contact.sentTitle')}</h3>
                  <p className="text-sm text-gray-500 mb-6">{t('contact.sentBody')}</p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-5 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#172f4d]"
                  >
                    {t('contact.sendAnother')}
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.firstName')} *</label>
                      <input
                        name="first_name" value={form.first_name} onChange={handleChange}
                        type="text" placeholder={t('contact.firstNamePh')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.lastName')} *</label>
                      <input
                        name="last_name" value={form.last_name} onChange={handleChange}
                        type="text" placeholder={t('contact.lastNamePh')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.email')} *</label>
                    <input
                      name="email" value={form.email} onChange={handleChange}
                      type="email" placeholder={t('contact.emailPh')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.companyTrn')}</label>
                    <input
                      name="company" value={form.company} onChange={handleChange}
                      type="text" placeholder={t('contact.companyPh')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.subject')}</label>
                    <select
                      name="subject" value={form.subject} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('contact.subjectPh')}</option>
                      {subjects.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('contact.message')} *</label>
                    <textarea
                      name="message" value={form.message} onChange={handleChange}
                      rows={4} placeholder={t('contact.messagePh')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit" disabled={submitting}
                    className="w-full py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? t('contact.sending') : t('contact.send')}
                  </button>
                </form>
              )}
            </div>

            {/* Contact info + FAQ */}
            <div className="space-y-8">
              <div>
                <h2 className="font-bold text-gray-900 mb-5">{t('contact.infoTitle')}</h2>
                <div className="space-y-4">
                  {contactItems.map((item, i) => (
                    <div key={item.label} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1e3a5f] text-white shrink-0">
                        {ITEM_ICONS[i]}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-bold text-gray-900 mb-5">{t('contact.faqTitle')}</h2>
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <details key={faq.q} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                      <summary className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 cursor-pointer list-none hover:bg-gray-50">
                        {faq.q}
                        <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg leading-none">›</span>
                      </summary>
                      <div className="px-5 pb-4">
                        <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
                <p className="text-sm font-semibold text-blue-900 mb-1">{t('contact.resourcesTitle')}</p>
                <p className="text-xs text-blue-700 mb-3">{t('contact.resourcesBody')}</p>
                <a
                  href="https://tax.gov.ae"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {t('contact.resourcesLink')} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
