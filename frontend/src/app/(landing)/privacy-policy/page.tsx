'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowUp } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'Information We Collect',
    body: [
      'Account information: name, email address, phone number, and company details you provide when registering or being invited to the platform.',
      'Business data: company Tax Registration Number (TRN), customer records, invoices, line items, and supporting documents you upload (such as TRN certificates and logos).',
      'Technical data: IP address, browser type, device information, and usage logs collected automatically to operate and secure the service.',
    ],
  },
  {
    heading: 'How We Use Your Information',
    body: [
      'To generate, validate, sign, and transmit e-invoices to the UAE Federal Tax Authority (FTA) through accredited service providers.',
      'To provide, maintain, and improve the platform, including authentication, support, and fraud prevention.',
      'To comply with legal and regulatory obligations under UAE law, including record-retention requirements.',
    ],
  },
  {
    heading: 'Data Storage & Retention',
    body: [
      'Your data is stored on secured servers. Invoice and tax records are retained for the period required by UAE tax law (generally a minimum of 5 years).',
      'We retain personal data only for as long as necessary to provide the service and meet legal obligations, after which it is deleted or anonymised.',
    ],
  },
  {
    heading: 'Data Sharing',
    body: [
      'We share invoice data with the FTA and accredited service providers strictly to fulfil e-invoicing obligations.',
      'We do not sell your personal data. Third-party processors (e.g. hosting, email) act only on our instructions under appropriate safeguards.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'We apply encryption in transit (HTTPS/TLS), access controls, company-scoped data isolation, and audit logging to protect your information.',
      'No method of transmission or storage is completely secure; we continuously work to safeguard your data.',
    ],
  },
  {
    heading: 'Your Rights',
    body: [
      'You may request access to, correction of, or deletion of your personal data, subject to legal retention requirements.',
      'To exercise these rights, contact us using the details on our Contact page.',
    ],
  },
  {
    heading: 'Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be communicated through the platform or by email.',
    ],
  },
];

const SECTION_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-violet-500 to-violet-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
];

const DOT_COLORS = [
  'bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400', 'bg-cyan-400', 'bg-indigo-400',
];

export default function PrivacyPolicyPage() {
  const [showTop, setShowTop] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
      const headings = document.querySelectorAll('[data-section-id]');
      let current = 0;
      headings.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 200) current = i;
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToSection = (i: number) => {
    document.querySelector(`[data-section-id="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
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

            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Privacy &amp; Compliance
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-5">
                  Privacy Policy
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  Your privacy matters. This policy explains what data E-Numerak collects and how we use and protect it.
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <div className="flex flex-wrap gap-3 mt-8">
                  {['GDPR', 'CCPA', 'Data Protection', 'Encryption'].map((badge) => (
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

            {/* Right: Privacy & security mockup */}
            <AnimatedSection delay={300} direction="right" className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 blur-3xl rounded-3xl" />

                <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 hover:shadow-blue-500/10 transition-shadow duration-500">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400/80" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400/80" />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-blue-200/50 text-[9px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                      e-numerak.com/privacy
                    </div>
                    <div className="w-10" />
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Data Protection</div>
                          <div className="text-[9px] text-blue-300/60">Encrypted &amp; Secure</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-semibold text-emerald-300">Protected</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {[
                        { label: 'Encryption (TLS 1.3)', status: 'Active', bar: 'w-full', color: 'bg-emerald-400' },
                        { label: 'Access Controls', status: 'Enforced', bar: 'w-full', color: 'bg-emerald-400' },
                        { label: 'Audit Logging', status: 'Enabled', bar: 'w-3/4', color: 'bg-blue-400' },
                        { label: 'Data Isolation', status: 'Per-Company', bar: 'w-3/4', color: 'bg-blue-400' },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-blue-100/80">{item.label}</span>
                            <span className="text-[8px] font-medium text-emerald-300/80">{item.status}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${item.color} ${item.bar} transition-all duration-500`} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'AES-256', label: 'Encryption' },
                        { value: 'ISO 27001', label: 'Standards' },
                        { value: '5 Years', label: 'Retention' },
                      ].map((m) => (
                        <div key={m.label} className="bg-white/[0.05] rounded-xl p-2.5 border border-white/[0.06] text-center">
                          <div className="text-[11px] font-bold text-white">{m.value}</div>
                          <div className="text-[8px] text-blue-200/50 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                      <div className="text-[9px] text-blue-200/50 font-medium mb-2">Compliance Framework</div>
                      <div className="flex flex-wrap gap-1">
                        {['UAE PDPL', 'FTA Guidelines', 'GDPR Aligned', 'BIS 3.0'].map((f) => (
                          <span key={f} className="px-2 py-0.5 rounded-md bg-white/10 text-blue-200/70 text-[8px] font-semibold border border-white/[0.06]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    Your Data is Safe
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

      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-28 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4 pl-3">On this page</p>
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.heading}
                    onClick={() => scrollToSection(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      activeSection === i
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {s.heading}
                  </button>
                ))}
              </div>
            </aside>

            <div className="lg:col-span-9 max-w-4xl">
              <div className="space-y-14">
                {SECTIONS.map((s, i) => (
                  <AnimatedSection key={s.heading} delay={i * 80} direction="up">
                    <div data-section-id={i}>
                      <div className="flex items-start gap-5">
                        <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${SECTION_COLORS[i]} text-white text-xs font-bold shadow-md shrink-0 mt-0.5`}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${SECTION_COLORS[i]} opacity-60`} />
                            <h2 className="text-xl lg:text-2xl font-bold text-gray-900">{s.heading}</h2>
                          </div>
                          <div className="space-y-3">
                            {s.body.map((p, j) => (
                              <div key={j} className="flex items-start gap-3">
                                <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${DOT_COLORS[i]}`} />
                                <p className="text-[15px] text-gray-600 leading-relaxed">{p}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              <AnimatedSection delay={600} direction="up">
                <div className="mt-16 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 shrink-0">
                      <ShieldCheck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 mb-1">Questions about this policy?</p>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        If you have any questions or concerns about how we handle your data, please reach out to us through our{' '}
                        <a href="/contact" className="text-blue-600 hover:text-blue-700 font-semibold underline-offset-2 hover:underline">
                          Contact page
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>

          </div>
        </div>
      </section>

      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-40 flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-900 to-brand-700 text-white shadow-lg shadow-brand-900/30 transition-all duration-300 hover:scale-110 hover:shadow-xl ${
          showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </>
  );
}
