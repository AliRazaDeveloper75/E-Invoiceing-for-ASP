import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, FileText, Zap,
  Lock, ChevronRight, Building2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'E-Numerak — E-Invoicing, Done Right',
  description:
    'E-Numerak is an end-to-end compliance platform that centralizes invoicing across your business. UAE FTA-Certified, E-Invoice Compliant. From invoice creation to FTA Validation — everything unified.',
  keywords: [
    'UAE e-invoicing platform',
    'FTA certified e-invoice',
    'E-Invoice compliant platform UAE',
    'BIS 3.0 UAE',
    'VAT excise invoicing UAE',
    'e-invoicing Federal Decree-Law 16',
    'UAE digital economy invoicing',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'E-Numerak | UAE FTA-Certified, E-Invoice Compliant Platform',
    description:
      'Navigate UAE\'s e-Invoicing regulations with confidence. E-Numerak delivers full control, visibility, and speed — from invoice creation to FTA Validation.',
    url: '/',
  },
};

const FEATURES = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Automated E-Invoice Invoicing',
    desc: 'The solution automatically creates E-Invoice invoices with no technical complexity. Fully FTA Audit File (FAF) compliant including all VAT and Excise data fields you need for certification.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Real-Time Validation & Tax Support',
    desc: 'Real time validation ensures accuracy before submission. The system supports VAT and Exercise for standard rated, zero rated, and exempt transcations reducing the risk of errors.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Role-Based Team Access',
    desc: 'Roles based access with the facility to distinguish the duties of each team shall provide stress free handling of the entire process. All features are built to make things easy without sacrificing compliance.',
    color: 'text-indigo-600 bg-indigo-50',
  },
];

const STATS = [
  { value: '5%',   label: 'UAE VAT Rate' },
  { value: '32',   label: 'FAF Data Elements' },
  { value: '5',    label: 'E-Invoice Corners' },
  { value: '100%', label: 'FTA Compliant' },
];

const COMPLIANCE = [
  'Federal Decree-Law No. 16 of 2024 (VAT)',
  'Federal Decree-Law No. 7 of 2017 (Excise)',
  'FTA Tax Accounting Software Certification',
  'BIS Billing 3.0',
  'UBL 2.1 XML Standard',
  'UAE Phase 1 & Phase 2 E-Invoicing',
];

const LIFECYCLE = [
  { status: 'Draft',     desc: 'Created and refined',                    color: 'bg-gray-400' },
  { status: 'Pending',   desc: 'Ready for processing',                   color: 'bg-amber-500' },
  { status: 'Submitted', desc: 'Securely transmitted',                   color: 'bg-blue-500' },
  { status: 'Validated', desc: 'Approved by FTA',                        color: 'bg-emerald-500' },
  { status: 'Rejected',  desc: 'Immediate marking for correction',        color: 'bg-red-500' },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1e4080] to-[#0f2147] text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-4">
              E-Numerak —{' '}
              <span className="text-blue-300">E-Invoicing, Done Right</span>
            </h1>

            <p className="text-lg sm:text-xl text-blue-200 font-medium mb-6">
              Navigate&nbsp;UAE&apos;s e-Invoicing regulations with confidence
            </p>

            <p className="text-base text-blue-100 leading-relaxed mb-10 max-w-2xl">
              E-Numerak is an end-to-end compliance platform that centralizes invoicing across your
              business, giving you full control, visibility, and speed. From invoice creation to FTA
              Validation. Everything is unified into one intelligence system. Designed for the{' '}
              UAE&apos;s fast-growing digital Economy.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-lg transition-all"
              >
                Launch E-Invoice Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all"
              >
                Explore Services <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {['FTA Certified', 'BIS 3.0', 'VAT & Excise Ready', 'Secure & Compliant'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 1440 60" className="w-full -mb-1" preserveAspectRatio="none">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-[#1e3a5f]">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                About E-Numerak
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Revolutionizing invoicing for UAE businesses
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                <p>
                  E-Numerak is revolutionizing the way businesses in the UAE handle invoicing. With
                  ever-changing compliance mandates, conventional approaches are falling short.
                  Organizations require a solution that ensures compliance, maximizes efficiency,
                  maintains security, and prepares them for what lies ahead.
                </p>
                <p>
                  Designed for the UAE&apos;s, E-Numerak combines VAT, Excise and E-Invoice compliances
                  into a single elegant platform. All of your invoices are formatted, authenticated
                  and transmitted securely to &amp; from the FTA, ensuring a smooth, fully compliant
                  invoicing process. The outcome is a more intelligent, more robust online invoicing
                  solution tailored for today&apos;s business.
                </p>
              </div>
            </div>

            {/* Visual card */}
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm">E-Numerak Platform</p>
                  <p className="text-blue-300 text-xs">UAE E-Invoicing Solution</p>
                </div>
              </div>
              {[
                'VAT, Excise & E-Invoice in one platform',
                'FTA-certified secure transmission',
                'Authenticated invoice formatting',
                'Fully compliant invoicing process',
                'Built for today\'s UAE business',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-sm text-blue-100">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Seamless Process ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              How It Works
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">
              A Seamless Process, Designed for Precision
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] text-left">
              <p>
                E-Numerak Delivers an end-to-end, intelligent, and paperless invoicing process. The
                platform seemlessly generated fully UAE-Compliant invoices. Real time validation
                highlights issues instantly, which enable immediate correction on the platform.
              </p>
              <p>
                Approved invoices are then sent via the 5-corner network securely from your
                internal systems through the Access Point to the FTA. All steps are monitored, all
                information is controlled, and all documents are stored ready for a potential audit
                trail. A process designed not just for compliance, but to build confidence
              </p>
            </div>
          </div>

          {/* Process steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-10">
            {[
              { step: '01', label: 'Create Invoice',     desc: 'Fully UAE-Compliant' },
              { step: '02', label: 'Real-Time Validate', desc: 'Instant error detection' },
              { step: '03', label: 'Send via E-Invoice',    desc: '5-corner network' },
              { step: '04', label: 'FTA Submission',     desc: 'Secure & certified' },
              { step: '05', label: 'Audit Trail',        desc: 'Full traceability' },
            ].map((p, i, arr) => (
              <div key={p.step} className="relative flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-sm mb-3">
                  {p.step}
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+24px)] right-0 h-0.5 bg-gray-200" />
                )}
                <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services / Features ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              Services
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Comprehensive E-Invoicing Services
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              E-Numerak provides a one-stop solution to meet all requirements under the Regulations
              of the Country.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                Compliance
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-5">
                Built for Compliance. Engineered for Excellence.
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] mb-8">
                <p>
                  E-Numerak is not only the software but also the full compliance architecture.
                </p>
                <p>
                  Compliant with all regulations of Federal Decree-Law No. 16 of 2024 (VAT) and
                  Federal Decree-Law No. 7 of 2017 (Excise), the entire invoice processing is
                  compliant and can cater to UAE requirements. No one size fits all solution
                  integration with BIS Billing 3.0 for global acumen, 5-corner model for
                  end to end invoice visibility.
                </p>
                <p>
                  Security is firmly anchored in the platform and involves industry best-practices
                  and including many security measures. For example, the data isolation facility
                  uses state-of-the-art authentication processes.
                </p>
                <p className="font-semibold text-gray-800">
                  Compliance isn&apos;t optional E-Numerak ensures it at every step
                </p>
              </div>
              <ul className="space-y-3">
                {COMPLIANCE.map((c) => (
                  <li key={c} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Invoice Lifecycle */}
            <div>
              <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] rounded-3xl p-8 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-2">
                  Complete Visibility. Total Control.
                </p>
                <h3 className="text-lg font-bold text-white mb-6">
                  Every invoice moves through a clearly defined lifecycle
                </h3>
                {LIFECYCLE.map((step, i) => (
                  <div key={step.status} className="flex items-start gap-3 mb-4 last:mb-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-3 h-3 rounded-full mt-0.5 ${step.color}`} />
                      {i < LIFECYCLE.length - 1 && (
                        <div className="w-0.5 h-6 bg-white/20 mt-1" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white">{step.status}</span>
                      <p className="text-xs text-blue-200 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
                <p className="mt-6 text-xs text-blue-300 leading-relaxed">
                  Stay in the loop, in the driver&apos;s seat, and always on course with standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-8 space-y-4">
              {[
                { label: 'Automate Complex Workflows',   desc: 'Reduce errors and accelerate invoicing cycles across your business.' },
                { label: 'Free Your Team',               desc: 'Automate time-consuming compliance tasks — no more wasted admin hours.' },
                { label: 'Built for Ambitious Companies', desc: 'A solution for organizations who prioritize accuracy, speed and adaptability.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                Why E-Numerak
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-5">
                Why Leading Businesses Choose E-Numerak
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                <p>
                  In the current fast-changing world of regulation, it&apos;s not a choice between
                  being efficient and being accurate-it&apos;s a must.
                </p>
                <p>
                  E-Numerak enables organizations to automate complex  workflows, reduce errors and
                  accelerate invoicing workflows While automating the time-consuming compliance
                  process, the solution frees your  team from timewasting admin tasks.
                </p>
                <p>
                  It is a solution for ambitious companies who prioritize accuracy, speed and
                  adaptability to the future.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value of E-Invoicing ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
              The Big Picture
            </p>
            <h2 className="text-3xl font-bold text-gray-900">The Value of E-Invoicing</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'A Transparent Ecosystem',
                body: 'E-invoicing signifies a transition to a more transparent, efficient and secure financial ecosystem. Through the adoption of structured digital processes instead of manual procedures, enterprises ensure higher accuracy, shorter turnaround time and absolute traceability.',
                color: 'border-blue-200 bg-blue-50',
                heading: 'text-blue-700',
              },
              {
                title: 'UAE Compliance Imperative',
                body: 'In the UAE, this will be a result of the desire for enhanced VAT compliance, low level fraud, and the shift towards global standards of digitisation. Early adoption is not a luxury - it\'s a necessity.',
                color: 'border-emerald-200 bg-emerald-50',
                heading: 'text-emerald-700',
              },
              {
                title: 'Ready Today & Tomorrow',
                body: 'E-Numerak guarantees that your business is ready today and tomorrow for all phases of UAE e-invoicing.',
                color: 'border-purple-200 bg-purple-50',
                heading: 'text-purple-700',
              },
            ].map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl border p-6 ${card.color}`}
              >
                <h3 className={`font-bold text-base mb-3 ${card.heading}`}>{card.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="bg-[#1e3a5f] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
            Get Started
          </p>
          <h2 className="text-3xl font-bold text-white mb-5">
            Step Into the Future of Invoicing
          </h2>
          <div className="space-y-3 text-blue-200 text-[15px] leading-relaxed mb-8 max-w-2xl mx-auto">
            <p>
              The UAE is quickly progressing in adopting e-invoicing and some progressive companies
              have already migrated to paperless invoices.
            </p>
            <p>
              E-Numerak offers a trusted, comprehensive platform to take that journey by combining
              technology, compliance, and performance. Start e-voicing in full compliance with the{' '}
              FTA today .
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-lg transition-all"
          >
            Launch E-Invoice Portal <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-6 text-sm font-semibold text-blue-200">
            Implement e-voicing, the right way.
          </p>
        </div>
      </section>

      {/* ── Footer tagline ───────────────────────────────────────────────────── */}
      <section className="bg-[#0f2147] py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-white font-bold text-lg">E-Numerak</p>
          <p className="text-blue-300 text-sm leading-relaxed">
            Built for businesses across the supply chain adopting 5-corner e-invoicing
            platform for merchant establishments in UAE.
          </p>
          <p className="text-blue-400 text-sm leading-relaxed">
            Let&apos;s build the future of the digital economy of the UAE, For the great ones!
            Certified by the FTA, with a high technological VAT-ready platform.
          </p>
        </div>
      </section>
    </>
  );
}
