'use client';

import { useEffect, useState } from 'react';
import { Scale, ArrowUp, FileCheck } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'Acceptance of Terms',
    body: [
      'By accessing or using E-Numerak ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
    ],
  },
  {
    heading: 'The Service',
    body: [
      'E-Numerak is a software platform for generating, validating, signing, and transmitting e-invoices in compliance with UAE Federal Tax Authority (FTA) requirements.',
      'The Service is provided on a subscription basis and may be updated or improved over time.',
    ],
  },
  {
    heading: 'Your Responsibilities',
    body: [
      'You are responsible for the accuracy of the data you enter, including TRNs, customer details, and invoice amounts.',
      'You must keep your account credentials confidential and are responsible for all activity under your account.',
      'You agree to use the Service only for lawful purposes and in compliance with UAE tax law.',
    ],
  },
  {
    heading: 'Accounts & Access',
    body: [
      'Accounts are created by invitation or registration. Roles (Admin, Accountant, Viewer, Supplier) determine the actions each user may perform.',
      'We may suspend or terminate accounts that violate these terms or applicable law.',
    ],
  },
  {
    heading: 'Fees & Payment',
    body: [
      'Subscription fees, where applicable, are billed in advance and are non-refundable except as required by law.',
      'We reserve the right to change pricing with reasonable prior notice.',
    ],
  },
  {
    heading: 'Limitation of Liability',
    body: [
      'The Service is provided "as is". To the maximum extent permitted by law, E-Numerak is not liable for indirect, incidental, or consequential damages.',
      'You remain solely responsible for your tax filings and compliance obligations with the FTA.',
    ],
  },
  {
    heading: 'Intellectual Property',
    body: [
      'All software, design, and content of the Service are the property of E-Numerak. Your business data remains yours.',
    ],
  },
  {
    heading: 'Changes to These Terms',
    body: [
      'We may revise these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.',
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
  'from-teal-500 to-teal-600',
];

const DOT_COLORS = [
  'bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400', 'bg-cyan-400', 'bg-indigo-400', 'bg-teal-400',
];

export default function TermsPage() {
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
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            <div className="max-w-xl">
              <AnimatedSection delay={0} direction="up">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.12em] mb-6 backdrop-blur-sm">
                  <Scale className="h-3.5 w-3.5" />
                  Terms &amp; Conditions
                </div>
              </AnimatedSection>
              <AnimatedSection delay={150} direction="up">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-5">
                  Terms of Service
                </h1>
              </AnimatedSection>
              <AnimatedSection delay={300} direction="up">
                <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl">
                  Please read these terms carefully before using the E-Numerak platform.
                </p>
              </AnimatedSection>
              <AnimatedSection delay={450} direction="up">
                <p className="text-xs text-blue-300/60 mt-6 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Last updated: {new Date().getFullYear()}
                </p>
              </AnimatedSection>
            </div>

            {/* Right: Terms overview mockup */}
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
                      e-numerak.com/terms
                    </div>
                    <div className="w-10" />
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                          <FileCheck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Service Agreement</div>
                          <div className="text-[9px] text-blue-300/60">8 clauses &bull; Effective 2026</div>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30">
                        <span className="text-[8px] font-semibold text-blue-300">In Effect</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {[
                        { clause: '1. Acceptance', desc: 'Binding agreement upon use of the Service', done: true },
                        { clause: '2. Service Scope', desc: 'E-invoice generation & FTA transmission', done: true },
                        { clause: '3. Responsibilities', desc: 'Data accuracy & account security', done: true },
                        { clause: '4. Access Control', desc: 'Role-based permissions & account management', done: true },
                        { clause: '5. Payments', desc: 'Subscription billing & pricing terms', done: true },
                      ].map((item) => (
                        <div key={item.clause} className="flex items-start gap-2.5 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]">
                          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white/10 text-blue-200/70 text-[8px] font-bold shrink-0 mt-0.5">
                            {item.clause.split('.')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-white">{item.clause}</span>
                              {item.done && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                            </div>
                            <p className="text-[9px] text-blue-300/50 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="h-3.5 w-3.5 text-blue-200/70" />
                        <span className="text-[10px] text-blue-100/70">Governing Law</span>
                      </div>
                      <span className="text-[9px] font-medium text-blue-300/80">UAE Jurisdiction</span>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 animate-float">
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold shadow-lg">
                    Effective 2026
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

      {/* Content */}
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
                      <Scale className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 mb-1">Questions about these terms?</p>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        If you have any questions about these Terms of Service, please reach out to us through our{' '}
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
