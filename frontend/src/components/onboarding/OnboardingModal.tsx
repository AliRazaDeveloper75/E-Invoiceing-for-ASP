'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Sparkles, Building2, Users, CheckCircle2,
  ArrowRight, X, FileText, ShieldCheck, Zap, Globe,
} from 'lucide-react';

const storageKey = (userId: string) => `onboarding_v1_${userId}`;

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '1st step',
    icon: Building2,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badge: 'bg-blue-600',
    title: 'Set up your company',
    description:
      'Add your company details including your UAE Tax Registration Number (TRN). Your 15-digit TRN is mandatory to generate FTA-compliant E-Invoice invoices.',
    checklist: [
      'Company trading name and legal name',
      'TRN — 15-digit UAE Tax Registration Number',
      'Registered address in the UAE',
    ],
    action: { label: 'Go to Companies →', href: '/companies' },
  },
  {
    step: '2nd step',
    icon: Users,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    badge: 'bg-purple-600',
    title: 'Add your first customer',
    description:
      'Add the businesses or individuals you invoice. For UAE B2B and B2G customers you will need their TRN to generate compliant invoices.',
    checklist: [
      'B2B — Business buyers (TRN required)',
      'B2G — Government entities (TRN required)',
      'B2C — Individual consumers (no TRN needed)',
    ],
    action: { label: 'Add Customer →', href: '/customers/new' },
  },
  {
    step: '3rd step',
    icon: FileText,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-600',
    title: 'Create your first invoice',
    description:
      'Generate a BIS 3.0 tax invoice. Choose the document type, select a customer, add line items, and submit — the platform handles XML generation, digital signing, and FTA reporting.',
    checklist: [
      'Tax Invoice, Credit Note, or Debit Note',
      'VAT and Excise calculations included',
      'Automatic submission to the FTA via E-Invoice',
    ],
    action: { label: 'Create Invoice →', href: '/invoices/new' },
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0); // 0 = welcome, 1-3 = steps, 4 = done

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(storageKey(user.id));
    if (!done) {
      // Small delay so the dashboard loads first
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  function finish() {
    if (user) localStorage.setItem(storageKey(user.id), '1');
    setVisible(false);
  }

  function handleContinue() {
    if (step < STEPS.length) setStep(s => s + 1);
    else finish();
  }

  function handleAction(href: string) {
    finish();
    router.push(href);
  }

  if (!visible) return null;

  const isWelcome = step === 0;
  const isDone    = step > STEPS.length;
  const isLast    = step === STEPS.length;
  const current   = !isWelcome && !isDone ? STEPS[step - 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#1e4080] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">E-Numerak</span>
          </div>
          <button
            onClick={finish}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Step progress dots ──────────────────────────────────────────── */}
        {!isDone && (
          <div className="flex items-center justify-center gap-1.5 pt-5">
            {STEPS.map((_, i) => {
              const active  = i + 1 === step;
              const done    = i + 1 < step;
              return (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    active ? 'w-6 h-2 bg-blue-600'
                    : done  ? 'w-2 h-2 bg-blue-400'
                    :          'w-2 h-2 bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-7 py-6">

          {/* Welcome screen */}
          {isWelcome && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Sparkles className="h-9 w-9 text-blue-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Welcome{user?.first_name ? `, ${user.first_name}` : ''}!
                </h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  You are now on the UAE&apos;s leading FTA-compliant e-invoicing platform.
                  Complete 3 quick steps to start issuing E-Invoice invoices.
                </p>
              </div>
              <ul className="space-y-2.5 text-left">
                {[
                  { icon: Building2,    text: 'Set up your company & TRN' },
                  { icon: Users,        text: 'Add your first customer' },
                  { icon: FileText,     text: 'Create a E-Invoice invoice' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    {text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {['FTA Certified', 'BIS 3.0', 'VAT Ready', 'Secure'].map(b => (
                  <span key={b} className="px-2.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Step screens */}
          {current && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 h-12 w-12 rounded-xl ${current.iconBg} flex items-center justify-center`}>
                  <current.icon className={`h-6 w-6 ${current.iconColor}`} />
                </div>
                <div>
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold text-white rounded-full ${current.badge} mb-1.5`}>
                    {current.step}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{current.title}</h2>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">{current.description}</p>

              <ul className="space-y-2">
                {current.checklist.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Done screen */}
          {isDone && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">You&apos;re all set!</h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Setup complete. Start creating FTA-compliant E-Invoice invoices and
                  submit them to the UAE Federal Tax Authority today.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: ShieldCheck, label: 'FTA Certified' },
                  { icon: Globe,       label: 'BIS 3.0' },
                  { icon: Zap,         label: 'Auto-Validated' },
                  { icon: FileText,    label: 'UBL 2.1 XML' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <Icon className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer buttons ───────────────────────────────────────────────── */}
        <div className="px-7 pb-6 flex items-center justify-between gap-3">

          {isDone ? (
            <button
              onClick={finish}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5
                         rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              {/* Skip */}
              <button
                onClick={finish}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-2">
                {/* Optional shortcut to the relevant page */}
                {current?.action && (
                  <button
                    onClick={() => handleAction(current.action.href)}
                    className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200
                               rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap"
                  >
                    {current.action.label}
                  </button>
                )}

                {/* Continue / Finish */}
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl
                             bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                             transition-colors whitespace-nowrap"
                >
                  {isWelcome ? "Let's go" : isLast ? 'Finish' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
