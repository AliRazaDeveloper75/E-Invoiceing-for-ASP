'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Rocket, Briefcase, Crown, Check, ArrowRight, HelpCircle,
  Zap, BarChart3, Users, Shield, FileText, Infinity, Building2,
  MessageCircle, Sparkles, CircuitBoard, ScrollText, ChevronDown,
  Diamond, Percent, Clock,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';

const BILLING_MULTIPLIER = { monthly: 1, yearly: 12 };

const TIERS = [
  {
    name: 'Basic',
    icon: Rocket,
    tagline: 'Start your e-invoicing journey',
    price: { monthly: 299, yearly: 2990 },
    period: '/month',
    desc: 'Essential e-invoicing for small businesses getting started with FTA compliance.',
    cta: 'Get Started',
    href: '/register',
    highlight: false,
    popular: false,
    theme: 'slate',
    sections: [
      {
        title: 'Invoicing',
        features: [
          { text: 'Up to 10 invoices/month', included: true },
          { text: 'Standard Tax Invoice format', included: true },
          { text: 'PDF & UBL 2.1 XML export', included: true },
          { text: 'Credit Note support', included: false },
          { text: 'Commercial invoices', included: false },
        ],
      },
      {
        title: 'Compliance',
        features: [
          { text: 'Basic invoice validation', included: true },
          { text: 'TRN lookup', included: true },
          { text: 'VAT breakdown summary', included: false },
          { text: 'FAF audit file export', included: false },
        ],
      },
      {
        title: 'Team & Access',
        features: [
          { text: 'Single user', included: true },
          { text: 'Email support', included: true },
          { text: 'Multi-company support', included: false },
          { text: 'Role-based access', included: false },
        ],
      },
    ],
  },
  {
    name: 'Professional',
    icon: Briefcase,
    tagline: 'For growing businesses',
    price: { monthly: 799, yearly: 7990 },
    period: '/month',
    desc: 'Full compliance toolkit for teams that need serious invoicing power.',
    cta: 'Start Free Trial',
    href: '/book-demo',
    highlight: true,
    popular: true,
    theme: 'blue',
    sections: [
      {
        title: 'Invoicing',
        features: [
          { text: 'Up to 500 invoices/month', included: true },
          { text: 'All invoice types (Tax, Credit, Commercial)', included: true },
          { text: 'PDF & UBL 2.1 XML export', included: true },
          { text: 'Bulk invoice creation', included: true },
          { text: 'Continuous supply invoices', included: true },
        ],
      },
      {
        title: 'Compliance',
        features: [
          { text: 'Real-time validation', included: true },
          { text: 'TRN lookup & verification', included: true },
          { text: 'VAT & Excise reporting dashboard', included: true },
          { text: 'FAF audit file export', included: true },
          { text: 'FTA-ready data capture (all fields)', included: true },
        ],
      },
      {
        title: 'Team & Access',
        features: [
          { text: 'Up to 5 team members', included: true },
          { text: 'Role-based access (Admin, Accountant, Viewer)', included: true },
          { text: 'Multi-company (up to 3 companies)', included: true },
          { text: 'Priority email support', included: true },
          { text: 'Audit trail on every action', included: true },
        ],
      },
    ],
  },
  {
    name: 'Premium',
    icon: Crown,
    tagline: 'For enterprises at scale',
    price: { monthly: 2000, yearly: 19990 },
    period: '/month',
    desc: 'Advanced features and priority support for high-volume organizations.',
    cta: 'Contact Sales',
    href: '/contact',
    highlight: false,
    popular: false,
    theme: 'amber',
    sections: [
      {
        title: 'Invoicing',
        features: [
          { text: 'Unlimited invoices', included: true },
          { text: 'All invoice types + custom templates', included: true },
          { text: 'Bulk processing & API-driven creation', included: true },
          { text: 'ERP integration support', included: true },
          { text: 'Custom UBL extensions', included: true },
        ],
      },
      {
        title: 'Compliance',
        features: [
          { text: 'Everything in Professional, plus:', included: true },
          { text: 'Dedicated ASP integration (Corner 2)', included: true },
          { text: 'On-premise deployment option', included: true },
          { text: 'Custom compliance rules engine', included: true },
          { text: 'White-label invoice branding', included: true },
        ],
      },
      {
        title: 'Support & SLA',
        features: [
          { text: 'Unlimited team members', included: true },
          { text: 'Unlimited companies', included: true },
          { text: 'Dedicated account manager', included: true },
          { text: '99.9% uptime SLA', included: true },
          { text: '24/7 phone & email support', included: true },
        ],
      },
    ],
  },
];

const FAQS = [
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes — upgrade or downgrade at any time. Changes take effect on your next billing cycle. If you upgrade mid-cycle, you will be charged the prorated difference.',
  },
  {
    q: 'Is there a free trial for the Professional plan?',
    a: 'Absolutely. You get 14 days free with full access to all Professional features. No credit card required.',
  },
  {
    q: 'Do you offer discounts for annual billing?',
    a: 'Yes — annual plans are billed for 10 months (2 months free). You can see the adjusted price by toggling to yearly billing above.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex), plus bank transfers for Premium plans.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes — all data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use JWT authentication, company-scoped data isolation, and maintain full audit trails.',
  },
  {
    q: 'Can I request a custom plan?',
    a: 'Certainly — contact our sales team and we will tailor a plan to your specific volume, integration, and compliance requirements.',
  },
];

const COMPARISON_ROWS = [
  { label: 'Invoices per month', basic: '10', pro: '500', premium: 'Unlimited' },
  { label: 'Invoice types', basic: 'Standard Tax', pro: 'All types', premium: 'All + Custom' },
  { label: 'UBL 2.1 XML export', basic: true, pro: true, premium: true },
  { label: 'PDF export', basic: true, pro: true, premium: true },
  { label: 'Real-time validation', basic: false, pro: true, premium: true },
  { label: 'VAT / Excise dashboard', basic: false, pro: true, premium: true },
  { label: 'FAF audit file export', basic: false, pro: true, premium: true },
  { label: 'Multi-company support', basic: false, pro: 'Up to 3', premium: 'Unlimited' },
  { label: 'Team members', basic: '1', pro: '5', premium: 'Unlimited' },
  { label: 'Role-based access', basic: false, pro: true, premium: true },
  { label: 'Dedicated ASP integration', basic: false, pro: false, premium: true },
  { label: 'ERP / API access', basic: false, pro: 'Basic API', premium: 'Full API' },
  { label: 'On-premise option', basic: false, pro: false, premium: true },
  { label: 'Support', basic: 'Email', pro: 'Priority Email', premium: '24/7 + Account Manager' },
  { label: 'Uptime SLA', basic: '\u2014', pro: '99.5%', premium: '99.9%' },
];

const HIGHLIGHTS = [
  { icon: Shield, stat: 'FTA Certified', label: 'UAE Tax Authority approved' },
  { icon: Zap, stat: 'BIS 3.0 Compliant', label: 'Latest billing standard' },
  { icon: Users, stat: '500+ Businesses', label: 'Trust E-Numerak' },
  { icon: BarChart3, stat: '99.9% Uptime', label: 'Enterprise-grade reliability' },
];

function PriceDisplay({ tier, billing }: { tier: typeof TIERS[number]; billing: 'monthly' | 'yearly' }) {
  const amount = billing === 'yearly'
    ? Math.round(tier.price.yearly / 12)
    : tier.price.monthly;

  const savings = tier.price.monthly * 12 - tier.price.yearly;

  return (
    <div className="mt-4">
      <div className="flex items-baseline gap-0.5">
        <span className="text-xs text-gray-400 font-medium">AED</span>
        <span className="text-4xl font-bold text-gray-900 tracking-tight">{amount}</span>
        <span className="text-xs text-gray-400">/month</span>
      </div>
      {billing === 'yearly' && (
        <p className="text-[11px] text-emerald-600 font-medium mt-1">
          AED {tier.price.yearly}/year &middot; save AED {savings}
        </p>
      )}
    </div>
  );
}

const SIDEBAR_GRADIENT = 'from-slate-950 via-blue-950 to-indigo-950';

function PricingCard({ tier, billing, index }: { tier: typeof TIERS[number]; billing: 'monthly' | 'yearly'; index: number }) {
  const Icon = tier.icon;

  const themeStyles = {
    slate: {
      border: 'border-slate-200 hover:border-slate-300',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      accent: 'text-white',
      accentLight: 'text-slate-600',
      iconWrapper: 'shadow-md shadow-blue-500/20',
    },
    blue: {
      border: 'border-blue-200 hover:border-blue-300',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      accent: 'text-white',
      accentLight: 'text-blue-600',
      iconWrapper: 'shadow-md shadow-blue-500/20',
    },
    amber: {
      border: 'border-amber-200 hover:border-amber-300',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
      accent: 'text-white',
      accentLight: 'text-amber-600',
      iconWrapper: 'shadow-md shadow-amber-500/20',
    },
  };

  const theme = themeStyles[tier.theme as keyof typeof themeStyles];

  return (
    <AnimatedSection delay={index * 120} direction="up">
      <div
        className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-300 h-full
          bg-gradient-to-b from-blue-50/80 via-sky-50/60 to-indigo-50/80
          ${tier.highlight ? 'shadow-xl shadow-blue-200/60 scale-[1.03] z-10 border-blue-300 ring-1 ring-blue-200/50' : `${theme.border} shadow-md shadow-blue-100/50 hover:shadow-lg hover:shadow-blue-200/60 hover:-translate-y-1`}
        `}
        style={tier.highlight ? {} : undefined}
      >
        {/* 3D depth shadow layer */}
        <div className="absolute inset-x-4 bottom-0 h-8 bg-gradient-to-t from-blue-200/20 to-transparent rounded-b-2xl pointer-events-none" />

        {/* Popular badge */}
        {tier.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold tracking-wide shadow-lg shadow-blue-500/30">
              <Sparkles className="h-3 w-3" />
              Most Popular
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${theme.iconBg} ${theme.iconWrapper}`}>
            <Icon className={`h-4 w-4 ${theme.accent}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{tier.name}</h3>
            <p className="text-[11px] text-gray-500">{tier.tagline}</p>
          </div>
          {billing === 'yearly' && (
            <span className="ml-auto inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] font-bold shadow-sm">
              <Clock className="h-2.5 w-2.5" />
              2 Free
            </span>
          )}
        </div>

        <p className="mt-2.5 text-xs text-gray-500 leading-relaxed">{tier.desc}</p>

        <PriceDisplay tier={tier} billing={billing} />

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {/* Feature sections */}
        <div className="flex-1 space-y-3.5">
          {tier.sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">
                {section.title}
              </h4>
              <ul className="space-y-1.5">
                {section.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <div className={`mt-0.5 rounded-full p-[2px] shrink-0 ${f.included ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      {f.included ? (
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <span className={`text-xs ${f.included ? 'text-gray-600' : 'text-gray-400'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href={tier.href}
          className={`mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r ${SIDEBAR_GRADIENT} text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40`}
        >
          {tier.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </AnimatedSection>
  );
}

export default function PricingPage() {
  const { t } = useI18n();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div dir="ltr" className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#050e1d] via-[#0a1a38] to-[#0d244a] pt-28 pb-36">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection delay={0} direction="up">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-semibold tracking-wide mb-6 backdrop-blur-sm">
              <Diamond className="h-3.5 w-3.5" />
              {t('nav.pricing')}
            </span>
          </AnimatedSection>
          <AnimatedSection delay={100} direction="up">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-5 tracking-tight leading-[1.1]">
              Simple,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-cyan-200">
                Transparent
              </span>{' '}
              Pricing
            </h1>
          </AnimatedSection>
          <AnimatedSection delay={200} direction="up">
            <p className="max-w-2xl mx-auto text-lg text-blue-200/70 leading-relaxed">
              Choose the plan that fits your business. No hidden fees, no surprises \u2014 just compliant e-invoicing.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── BILLING TOGGLE ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <AnimatedSection delay={300} direction="up">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  billing === 'monthly'
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 ${
                  billing === 'yearly'
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Yearly
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                  2 Months Free
                </span>
              </button>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ─── PRICING CARDS ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} billing={billing} index={i} />
          ))}
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <AnimatedSection delay={0} direction="up">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-4">
              <CircuitBoard className="h-3.5 w-3.5" />
              Plan Comparison
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Compare Features Side-by-Side</h2>
            <p className="text-gray-500">Everything you need to make the right choice for your business.</p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={150} direction="up">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg shadow-gray-200/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-[0.08em] text-gray-400">Feature</th>
                  <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-[0.08em] text-gray-500">Basic</th>
                  <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-[0.08em] text-blue-700 bg-blue-50/80">Professional</th>
                  <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-[0.08em] text-amber-700 bg-amber-50/80">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COMPARISON_ROWS.map((row, idx) => {
                  const renderCell = (val: string | boolean) => {
                    if (typeof val === 'boolean') {
                      return val
                        ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                        : <div className="h-4 w-4 rounded-full border-2 border-gray-200 mx-auto" />;
                    }
                    return <span className="text-gray-600">{val}</span>;
                  };
                  return (
                    <tr key={row.label} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/20`}>
                      <td className="px-6 py-3.5 text-gray-900 font-medium">{row.label}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.basic)}</td>
                      <td className="px-4 py-3.5 text-center bg-blue-50/20">{renderCell(row.pro)}</td>
                      <td className="px-4 py-3.5 text-center bg-amber-50/20">{renderCell(row.premium)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AnimatedSection>
      </section>

      {/* ─── FAQ ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <AnimatedSection delay={0} direction="up">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
              <MessageCircle className="h-3.5 w-3.5" />
              FAQ
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
            <p className="text-gray-500">Everything you need to know about our pricing and plans.</p>
          </div>
        </AnimatedSection>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <AnimatedSection key={faq.q} delay={i * 60} direction="up">
              <details
                className="group rounded-2xl border border-gray-200 bg-white p-6 open:border-blue-200 open:bg-gradient-to-br open:from-blue-50/60 open:to-white transition-all duration-300 cursor-pointer hover:border-gray-300 hover:shadow-md"
              >
                <summary className="flex items-center justify-between list-none">
                  <span className="text-sm font-semibold text-gray-900 group-open:text-blue-700 pr-4">{faq.q}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 group-open:text-blue-500 group-open:rotate-180 shrink-0 transition-all duration-300" />
                </summary>
                <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-[90%]">{faq.a}</p>
              </details>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#132b56] to-[#1a3a6b] py-24">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />
          </svg>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Building2 className="h-12 w-12 text-white/20 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Not Sure Which Plan Fits?
          </h2>
          <p className="text-blue-200/70 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Book a free consultation and our team will help you find the right solution for your business.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book-demo"
              className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.03] active:scale-[0.97] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              Book a Free Demo
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/15 text-white font-semibold transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-black/10"
            >
              <MessageCircle className="h-4 w-4 text-blue-300 transition-colors duration-300 group-hover:text-white" />
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
