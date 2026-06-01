'use client';

import { useState } from 'react';
import { Mail, MapPin, Phone, MessageSquare, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const CONTACT_ITEMS = [
  {
    icon: <Mail className="h-5 w-5" />,
    label: 'Email',
    value: 'info@e-numerak.com',
    sub: 'We respond within 24 hours',
  },
  {
    icon: <Phone className="h-5 w-5" />,
    label: 'Phone',
    value: '+971 50 635 8421',
    sub: 'Sun – Thu, 9 AM – 6 PM GST',
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    label: 'Address',
    value: 'Office Number 205, Malik Abdullah Ahmad Khalifa bin Hamidan al-Fulsi',
    sub: 'Deirah – Al-Khabisi, Dubai, UAE',
  },
];

const FAQS = [
  {
    q: 'Is this platform FTA certified?',
    a: 'Yes — the platform is built against the UAE FTA Tax Accounting Software Certification Guidelines, capturing all required VAT FAF (21 fields) and Excise FAF (32 fields) data elements.',
  },
  {
    q: 'Which invoice types are supported?',
    a: 'Tax Invoice (UBL 380), Credit Note (UBL 381), Commercial Invoice (UBL 480), and Continuous Supply invoices are all supported.',
  },
  {
    q: 'How do I connect to the FTA network?',
    a: 'The platform uses the PEPPOL 5-corner model. In production, you connect through a UAE-accredited ASP (Accredited Service Provider) who routes invoices to the FTA.',
  },
  {
    q: 'Can I have multiple companies?',
    a: 'Yes. The platform supports multi-company setups with isolated data and team members per company.',
  },
];

const SUBJECTS = [
  { value: 'fta_compliance', label: 'FTA Compliance Question' },
  { value: 'peppol',         label: 'PEPPOL Integration' },
  { value: 'support',        label: 'Platform Support' },
  { value: 'pricing',        label: 'Pricing / Demo' },
  { value: 'other',          label: 'Other' },
];

export default function ContactPage() {
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
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/contact/', form);
      setSubmitted(true);
      setForm({ first_name: '', last_name: '', email: '', company: '', subject: '', message: '' });
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
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
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Contact</p>
            <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              Questions about UAE e-invoicing compliance, PEPPOL integration, or the platform?
              Our team is here to help.
            </p>
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
                <h2 className="font-bold text-gray-900">Send a Message</h2>
              </div>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Message Sent!</h3>
                  <p className="text-sm text-gray-500 mb-6">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-5 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#172f4d]"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name *</label>
                      <input
                        name="first_name" value={form.first_name} onChange={handleChange}
                        type="text" placeholder="Ahmed"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name *</label>
                      <input
                        name="last_name" value={form.last_name} onChange={handleChange}
                        type="text" placeholder="Al Rashid"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
                    <input
                      name="email" value={form.email} onChange={handleChange}
                      type="email" placeholder="ahmed@company.ae"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company / TRN (optional)</label>
                    <input
                      name="company" value={form.company} onChange={handleChange}
                      type="text" placeholder="Company name or Tax Registration Number"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject</label>
                    <select
                      name="subject" value={form.subject} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a topic…</option>
                      {SUBJECTS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message *</label>
                    <textarea
                      name="message" value={form.message} onChange={handleChange}
                      rows={4} placeholder="Describe your question or requirement…"
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
                    {submitting ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            {/* Contact info + FAQ */}
            <div className="space-y-8">
              <div>
                <h2 className="font-bold text-gray-900 mb-5">Contact Information</h2>
                <div className="space-y-4">
                  {CONTACT_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1e3a5f] text-white shrink-0">
                        {item.icon}
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
                <h2 className="font-bold text-gray-900 mb-5">Frequently Asked Questions</h2>
                <div className="space-y-3">
                  {FAQS.map((faq) => (
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
                <p className="text-sm font-semibold text-blue-900 mb-1">FTA Resources</p>
                <p className="text-xs text-blue-700 mb-3">Official UAE Federal Tax Authority documentation and certification guidelines.</p>
                <a
                  href="https://tax.gov.ae"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Visit tax.gov.ae <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
