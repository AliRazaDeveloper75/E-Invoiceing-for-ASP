'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  X,
  Send,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Loader2,
  Sparkles,
  FileText,
  Receipt,
  Building2,
  UserCircle2,
  ThumbsUp,
  ThumbsDown,
  Check,
  ArrowRight,
  Mail,
  User,
  Phone,
  AlertCircle,
} from 'lucide-react';

// ─── Custom Icons ─────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ENumerakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 2.5" opacity="0.5" />
      <path
        d="M12 9.5h6l3 3v9.5a1 1 0 01-1 1H12a1 1 0 01-1-1V10.5a1 1 0 011-1z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M12 9.5h6l3 3v9.5a1 1 0 01-1 1H12a1 1 0 01-1-1V10.5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M18 9.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13 16h6M13 18.5h6M13 21h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── UAE Phone Validation ─────────────────────────────────────────────────────
// UAE numbers: +971 followed by:
//   - Mobile: 5X XXXXXXX (9 digits after 971) → 05X XXXXXXX
//   - Landline: 2/3/4/6/7/9 XXXXXXX (7 digits) → 02/03/04...
// We store digits only (no spaces, dashes) for the local part after the country code

const UAE_DIAL_CODE = '+971';

// After +971: mobile starts with 5 (then 8 more digits = 9 total), landline starts with 2/3/4/6/7/9 (then 7 more = 8 total)
// So valid local: 9 digits (mobile) e.g. 501234567 or 8 digits (landline) e.g. 21234567
function validateUAEPhone(digits: string): { valid: boolean; message: string } {
  if (!digits) return { valid: false, message: 'Phone number is required' };
  if (digits.length < 8) return { valid: false, message: 'Number is too short' };
  if (digits.length > 9) return { valid: false, message: 'Number is too long' };

  const mobilePattern = /^5[0-9]{8}$/;
  const landlinePattern = /^[2-4|6-7|9][0-9]{7}$/;

  if (digits.length === 9 && mobilePattern.test(digits)) return { valid: true, message: '' };
  if (digits.length === 8 && landlinePattern.test(digits)) return { valid: true, message: '' };

  if (digits[0] === '5' && digits.length < 9) return { valid: false, message: `Mobile needs ${9 - digits.length} more digit(s)` };
  if (digits[0] !== '5') return { valid: false, message: 'Enter a valid UAE mobile or landline number' };

  return { valid: false, message: 'Enter a valid UAE number' };
}

function validateName(name: string): { valid: boolean; message: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, message: 'Full name is required' };
  if (trimmed.length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
  if (trimmed.length > 60) return { valid: false, message: 'Name must be under 60 characters' };
  if (!/^[a-zA-Z\u0600-\u06FF\s'-]+$/.test(trimmed)) return { valid: false, message: 'Name can only contain letters, spaces, hyphens, apostrophes' };
  return { valid: true, message: '' };
}

function validateEmail(email: string): { valid: boolean; message: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, message: 'Email address is required' };
  if (trimmed.length > 100) return { valid: false, message: 'Email must be under 100 characters' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return { valid: false, message: 'Enter a valid email address' };
  return { valid: true, message: '' };
}

// ─── Field Components ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  touched?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, touched, children, hint }: FieldProps) {
  const hasError = touched && error;
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold tracking-wide text-stone-600 uppercase" style={{ letterSpacing: '0.06em', fontSize: '10px' }}>
        {label} <span className="text-orange-500">*</span>
      </label>
      {children}
      {hasError ? (
        <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-stone-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  hasError?: boolean;
  suffix?: React.ReactNode;
}

function StyledInput({ icon: Icon, hasError, suffix, className = '', ...props }: InputProps) {
  return (
    <div className={`relative flex items-center overflow-hidden rounded-xl border transition-all ${
      hasError
        ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-100'
        : 'border-stone-200 bg-white focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100'
    }`}>
      <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400 shrink-0" />
      <input
        className={`w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 ${suffix ? 'pr-16' : ''} ${className}`}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 text-[11px] font-medium text-stone-400 select-none">{suffix}</span>
      )}
    </div>
  );
}

// ─── UAE Phone Input ──────────────────────────────────────────────────────────

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  hasError?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function UAEPhoneInput({ value, onChange, hasError, onKeyDown }: PhoneInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip anything non-numeric
    const raw = e.target.value.replace(/\D/g, '');
    // Max 9 digits (mobile: 5XXXXXXXX)
    const capped = raw.slice(0, 9);
    onChange(capped);
  }

  // Format for display: add spaces e.g. 50 123 4567
  function formatDisplay(digits: string) {
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return (
    <div className={`flex overflow-hidden rounded-xl border transition-all ${
      hasError
        ? 'border-rose-300 ring-2 ring-rose-100'
        : 'border-stone-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100'
    }`}>
      {/* Dial code prefix */}
      <div className={`flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 ${
        hasError ? 'border-rose-200 bg-rose-50' : 'border-stone-200 bg-stone-50'
      }`}>
        <span className="text-base leading-none" role="img" aria-label="UAE flag">🇦🇪</span>
        <span className="text-sm font-medium text-stone-500 select-none">{UAE_DIAL_CODE}</span>
      </div>
      <div className="relative flex flex-1 items-center">
        <Phone className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400" />
        <input
          type="tel"
          inputMode="numeric"
          value={formatDisplay(value)}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder="50 123 4567"
          maxLength={11} // formatted with spaces: 2+1+3+1+4 = 11
          className={`w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 tracking-wide ${
            hasError ? 'bg-rose-50' : 'bg-white'
          }`}
          aria-label="UAE phone number"
        />
        {value.length > 0 && (
          <span className="absolute right-3 text-[10px] font-medium text-stone-400 select-none tabular-nums">
            {value.length}/9
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Environment Setup ────────────────────────────────────────────────────────

const AI_AGENT_URL = 'https://tax-data-assistant-backend-production.up.railway.app';
const AI_AGENT_BASE = AI_AGENT_URL.replace(/\/chat\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'chatbot' | 'agent';
type AuthView = 'login' | 'register' | 'chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'like' | 'dislike' | null;
}

interface ChatbotNode {
  id: string;
  text: string;
  answer?: string;
  children?: ChatbotNode[];
}

interface ChatWidgetProps {
  publicMode?: boolean;
}

// ─── Chatbot option tree ──────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  invoices: Receipt,
  vat: FileText,
  company: Building2,
  account: UserCircle2,
  platform: Sparkles,
};

const CHATBOT_TREE: ChatbotNode[] = [
  {
    id: 'invoices',
    text: 'Invoices',
    children: [
      {
        id: 'create',
        text: 'How do I create an invoice?',
        answer:
          'Go to Invoices → New Invoice. Fill in the 6 steps: Invoice Details, Supplier, Buyer, Items, Payment, then Submit. Your invoice is assigned a unique number and submitted to the ASP automatically.',
      },
      {
        id: 'types',
        text: 'What invoice types are supported?',
        answer:
          'The platform supports:\n• Tax Invoice (380)\n• Credit Note (381)\n• Commercial Invoice (480)\n• Continuous Supply Invoice (875)\n\nAll per the UAE PINT / BIS 3.0 standard.',
      },
      {
        id: 'status',
        text: 'What do the invoice statuses mean?',
        answer:
          'Draft → editable, not yet submitted.\nPending → submitted, XML being generated.\nSubmitted → sent to ASP.\nValidated → accepted by FTA.\nRejected → FTA found errors; check rejection reason.\nCancelled → voided.\nPaid → payment received.',
      },
      {
        id: 'xml',
        text: 'How do I download the UBL XML?',
        answer:
          'Open the invoice detail page. Once status is Submitted or Validated, a "Download XML" button appears. Click it to download the UBL 2.1 XML file.',
      },
      {
        id: 'credit_note',
        text: 'How do I issue a credit note?',
        answer:
          'Create a new invoice and select type "Credit Note (381)". Enter the original invoice number in the Reference Number field. Credit notes reverse a previously issued tax invoice for returns, cancellations, or corrections.',
      },
    ],
  },
  {
    id: 'vat',
    text: 'VAT & Tax',
    children: [
      {
        id: 'rates',
        text: 'What VAT rates are available?',
        answer:
          'Standard: 5% — applies to most goods & services.\nZero-rated: 0% — exports, international transport, certain food items.\nExempt: no VAT — financial services, residential property.',
      },
      {
        id: 'trn',
        text: 'What is a TRN?',
        answer:
          'TRN (Tax Registration Number) is a 15-digit number issued by the UAE Federal Tax Authority. It is required on every B2B tax invoice for both the seller and buyer.',
      },
      {
        id: 'peppol',
        text: 'What is E-Invoice / UAE PINT?',
        answer:
          "E-Invoice is the UAE's standard electronic invoicing network. UAE PINT is the UAE national profile based on BIS 3.0 and UBL 2.1, mandated by the UAE FTA for e-invoicing compliance.",
      },
    ],
  },
  {
    id: 'company',
    text: 'Company & Customers',
    children: [
      {
        id: 'add_company',
        text: 'How do I add a company?',
        answer:
          'Go to Settings → Companies → Add Company. Enter the company name, TRN, address, and contact details. You must have at least one active company to create invoices.',
      },
      {
        id: 'add_customer',
        text: 'How do I add a customer?',
        answer:
          'Go to Customers → Add Customer. Fill in the buyer name, TRN (required for B2B), address, and contact. Once saved, the customer appears in the Buyer picker when creating invoices.',
      },
    ],
  },
  {
    id: 'account',
    text: 'My Account',
    children: [
      {
        id: 'mfa',
        text: 'How do I set up two-factor authentication?',
        answer:
          'Go to Account → Security → Enable MFA. Scan the QR code with an authenticator app (e.g. Google Authenticator). Enter the 6-digit code to confirm. MFA adds a secure second login step.',
      },
      {
        id: 'roles',
        text: 'What user roles exist?',
        answer:
          'Admin: full access — manage company, users, and all invoices.\nAccountant: create and manage invoices.\nViewer: read-only access to invoices.\nInbound Supplier: accesses the supplier portal only.',
      },
    ],
  },
  {
    id: 'platform',
    text: 'About the Platform',
    children: [
      {
        id: 'compliance',
        text: 'Is this platform FTA certified?',
        answer:
          'Yes. E-Numerak is FTA-certified and fully compliant with Federal Decree-Law No. 16 of 2024. It generates BIS 3.0 / UBL 2.1 e-invoices and submits them to the Accredited Service Provider (ASP).',
      },
      {
        id: 'pricing',
        text: 'How can I get started?',
        answer:
          'Sign up at the E-Invoice Portal, register your company TRN, add your customers, and create your first invoice. Our onboarding wizard guides you through each step.',
      },
    ],
  },
];

// ─── ChatbotTab ───────────────────────────────────────────────────────────────

function ChatbotTab() {
  const [path, setPath] = useState<ChatbotNode[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);

  const currentMenu: ChatbotNode[] =
    path.length === 0 ? CHATBOT_TREE : path[path.length - 1].children ?? [];

  function select(node: ChatbotNode) {
    if (node.answer) {
      setPath((p) => [...p, node]);
      setAnswer(node.answer!);
    } else if (node.children) {
      setPath((p) => [...p, node]);
      setAnswer(null);
    }
  }

  function reset() {
    setPath([]);
    setAnswer(null);
  }

  function goBack() {
    if (path.length === 0) return;
    const next = path.slice(0, -1);
    setPath(next);
    setAnswer(null);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[40px] flex-wrap items-center gap-1 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-400">
        <button
          onClick={reset}
          className="font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          Help topics
        </button>
        {path.map((node, i) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              onClick={() => {
                setPath(path.slice(0, i + 1));
                setAnswer(node.answer ?? null);
              }}
              className="max-w-[110px] truncate transition-colors hover:text-slate-900"
            >
              {node.text}
            </button>
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {answer ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700 shadow-sm">
              <p className="whitespace-pre-line">{answer}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                All topics
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {path.length === 0 ? 'Browse by category' : 'Choose a topic'}
            </p>
            {currentMenu.map((node) => {
              const Icon = path.length === 0 ? CATEGORY_ICONS[node.id] : undefined;
              return (
                <button
                  key={node.id}
                  onClick={() => select(node)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm shadow-sm transition-all hover:border-slate-900/10 hover:bg-slate-50 hover:shadow-md"
                >
                  <span className="flex items-center gap-3">
                    {Icon && (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="font-medium text-slate-700 group-hover:text-slate-900">
                      {node.text}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Suggested queries ────────────────────────────────────────────────────────

const SUGGESTED = [
  'How do I add a company?',
  'What is E-Numerak?',
  'What is a TRN?',
];

// ─── AgentTab ─────────────────────────────────────────────────────────────────

interface AgentTabProps {
  onClose: () => void;
}

function AgentTab({ onClose }: AgentTabProps) {
  const [view, setView] = useState<AuthView>('login');
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState(''); // digits only after +971
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // Field-level touched state for inline validation
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });

  const nameValidation = validateName(regName);
  const emailValidation = validateEmail(regEmail);
  const phoneValidation = validateUAEPhone(regPhone);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loginEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    if (view === 'login') loginEmailRef.current?.focus();
  }, [view]);

  // Reset touched when switching views
  useEffect(() => {
    setTouched({ name: false, email: false, phone: false });
  }, [view]);

  async function login() {
    setLoginError(null);
    const email = loginEmail.trim();
    if (!email || !email.includes('@')) {
      setLoginError('Enter a valid email address.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(`${AI_AGENT_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setUserId(data.user_id);
        setUserName(data.name);
        setMessages([
          {
            role: 'assistant',
            content: `Welcome back, ${data.name}. How can I help with your UAE tax or invoicing questions today?`,
          },
        ]);
        setView('chat');
      } else if (res.status === 401) {
        setRegEmail(email);
        setRegError(null);
        setView('register');
      } else {
        setLoginError(data.detail || 'Something went wrong. Please try again.');
      }
    } catch {
      setLoginError('Connection failed. Please check your internet.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function register() {
    // Touch all fields to show errors
    setTouched({ name: true, email: true, phone: true });
    setRegError(null);

    if (!nameValidation.valid || !emailValidation.valid || !phoneValidation.valid) {
      return;
    }

    const fullPhone = `${UAE_DIAL_CODE}${regPhone}`;

    setRegLoading(true);
    try {
      const res = await fetch(`${AI_AGENT_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim(), phone: fullPhone }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setUserId(data.user_id);
        setUserName(data.name);
        setMessages([
          {
            role: 'assistant',
            content: `Hello, ${data.name}! I'm your E-Numerak tax assistant — ask me anything about VAT, TRNs, or e-invoicing on the platform.`,
          },
        ]);
        setView('chat');
      } else {
        setRegError(data.detail || 'Registration failed. Please try again.');
      }
    } catch {
      setRegError('Connection failed. Please check your internet.');
    } finally {
      setRegLoading(false);
    }
  }

  async function send(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || loading || userId === null) return;

    setMessages((m) => [...m, { role: 'user', content: msgText }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${AI_AGENT_BASE}/chat/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, message: msgText }),
      });
      if (!res.ok || !res.body) throw new Error('Request failed');

      setMessages((m) => [...m, { role: 'assistant', content: '' }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: 'assistant', content: reply };
          return updated;
        });
      }
    } catch {
      setError('Could not get a response. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(index: number, rating: 'like' | 'dislike') {
    const target = messages[index];
    if (!target || target.role !== 'assistant' || userId === null) return;

    const nextRating = target.feedback === rating ? null : rating;

    setMessages((m) => {
      const updated = [...m];
      updated[index] = { ...updated[index], feedback: nextRating };
      return updated;
    });

    if (!nextRating) return;

    const userMessage = messages[index - 1]?.content ?? '';

    try {
      await fetch(`${AI_AGENT_BASE}/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_message: userMessage,
          bot_response: target.content,
          rating: nextRating === 'like' ? 'thumbs_up' : 'thumbs_down',
        }),
      });
    } catch {
      /* feedback is best-effort */
    }
  }

  async function newChat() {
    if (userId !== null) {
      try {
        await fetch(`${AI_AGENT_BASE}/chat/clear-memory/${userId}`, { method: 'POST' });
      } catch {
        /* ignore */
      }
    }
    setError(null);
    setMessages([
      { role: 'assistant', content: 'New conversation started. How can I help you?' },
    ]);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const allFieldsValid = nameValidation.valid && emailValidation.valid && phoneValidation.valid;

  // ── Login view ──
  if (view === 'login') {
    return (
      <div
        className="relative flex h-full flex-col justify-center px-6 py-6"
        style={{ background: 'linear-gradient(180deg, #FBF7F2 0%, #FFFFFF 60%)' }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: '#C2410C' }}
          >
            <ENumerakLogo className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-stone-900">
            Sign in to E-Numerak
          </h2>
          <p className="mt-1 text-[13px] text-stone-500">
            Your UAE tax assistant — here to help 24/7
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#78716c' }}>
              Email address <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                ref={loginEmailRef}
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 pl-9 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {loginError && (
            <p className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {loginError}
            </p>
          )}

          <button
            onClick={login}
            disabled={loginLoading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: '#1C1917' }}
          >
            {loginLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-stone-400">
          New here? Enter your email and we'll get you set up.
        </p>
      </div>
    );
  }

  // ── Register view ──
  if (view === 'register') {
    return (
      <div
        className="relative flex h-full flex-col justify-center overflow-y-auto px-6 py-5"
        style={{ background: 'linear-gradient(180deg, #FBF7F2 0%, #FFFFFF 60%)' }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: '#C2410C' }}
          >
            <ENumerakLogo className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-stone-900">
            Create your account
          </h2>
          <p className="mt-1 text-[13px] text-stone-500">
            Let's get you set up — takes just a moment.
          </p>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <Field
            label="Full name"
            error={nameValidation.message}
            touched={touched.name}
          >
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={regName}
                onChange={(e) => {
                  // Block numeric-only input; allow letters, spaces, hyphens, apostrophes
                  const val = e.target.value;
                  if (val.length <= 60) setRegName(val);
                }}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                onKeyDown={(e) => e.key === 'Enter' && register()}
                placeholder="e.g. Ahmed Al Mansouri"
                maxLength={60}
                className={`w-full rounded-xl border px-3.5 py-2.5 pl-9 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 ${
                  touched.name && !nameValidation.valid
                    ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-100'
                    : 'border-stone-200 bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-stone-300 select-none">
                {regName.length}/60
              </span>
            </div>
          </Field>

          {/* Email */}
          <Field
            label="Email address"
            error={emailValidation.message}
            touched={touched.email}
          >
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={regEmail}
                onChange={(e) => {
                  if (e.target.value.length <= 100) setRegEmail(e.target.value);
                }}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                onKeyDown={(e) => e.key === 'Enter' && register()}
                placeholder="you@company.com"
                maxLength={100}
                className={`w-full rounded-xl border px-3.5 py-2.5 pl-9 pr-16 text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 ${
                  touched.email && !emailValidation.valid
                    ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-100'
                    : 'border-stone-200 bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
                }`}
              />
            </div>
          </Field>

          {/* UAE Phone */}
          <Field
            label="UAE phone number"
            error={phoneValidation.message}
            touched={touched.phone}
            hint={!touched.phone ? 'Mobile: 05X XXXXXXX · Landline: 0X XXXXXXX' : undefined}
          >
            <UAEPhoneInput
              value={regPhone}
              onChange={(digits) => {
                setRegPhone(digits);
                if (!touched.phone && digits.length > 0) {
                  setTouched((t) => ({ ...t, phone: true }));
                }
              }}
              hasError={touched.phone && !phoneValidation.valid}
              onKeyDown={(e) => e.key === 'Enter' && register()}
            />
          </Field>

          {/* Server-level error */}
          {regError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {regError}
            </p>
          )}

          {/* Progress indicator: show how many fields are filled */}
          <div className="flex items-center gap-1.5">
            {[nameValidation.valid, emailValidation.valid, phoneValidation.valid].map((v, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  v ? 'bg-emerald-400' : 'bg-stone-200'
                }`}
              />
            ))}
            <span className="ml-1 text-[10px] font-medium text-stone-400 tabular-nums">
              {[nameValidation.valid, emailValidation.valid, phoneValidation.valid].filter(Boolean).length}/3
            </span>
          </div>

          <button
            onClick={register}
            disabled={regLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: allFieldsValid && !regLoading ? '#1C1917' : '#78716c',
              transition: 'background 0.2s',
            }}
          >
            {regLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create account & start chatting
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            onClick={() => {
              setRegError(null);
              setView('login');
            }}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ── Chat view ──
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <span className="px-2 text-xs font-medium text-stone-400">
          Signed in as <span className="text-stone-600">{userName}</span>
        </span>

        <button
          onClick={newChat}
          title="New chat"
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-900"
        >
          <RotateCcw className="h-3 w-3" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: '#C2410C' }}
              >
                <ENumerakLogo className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900">AI Tax Assistant</p>
                <p className="text-xs text-stone-400">Usually replies instantly</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-stone-500">
              Ask me anything about tax invoices, VAT, TRNs, or UAE e-invoicing on E-Numerak.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
            const showTyping = isLastAssistant && loading && !msg.content;
            const showFeedback = msg.role === 'assistant' && !showTyping && msg.content.length > 0;

            return (
              <div
                key={i}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md border border-stone-100 bg-stone-50 text-stone-700'
                  }`}
                  style={msg.role === 'user' ? { background: '#1C1917' } : undefined}
                >
                  {msg.role === 'assistant' ? (
                    showTyping ? (
                      <span className="flex h-4 items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.3s]" />
                      </span>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:text-stone-900 prose-strong:text-stone-900">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )
                  ) : (
                    msg.content
                  )}
                </div>

                {showFeedback && (
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <button
                      onClick={() => sendFeedback(i, 'like')}
                      aria-label="Good response"
                      title="Good response"
                      className={`rounded-md p-1 transition-colors ${
                        msg.feedback === 'like' ? 'text-emerald-600' : 'text-stone-300 hover:text-stone-500'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" fill={msg.feedback === 'like' ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => sendFeedback(i, 'dislike')}
                      aria-label="Bad response"
                      title="Bad response"
                      className={`rounded-md p-1 transition-colors ${
                        msg.feedback === 'dislike' ? 'text-rose-500' : 'text-stone-300 hover:text-stone-500'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" fill={msg.feedback === 'dislike' ? 'currentColor' : 'none'} />
                    </button>
                    {msg.feedback && (
                      <span className="flex items-center gap-1 text-[11px] text-stone-400">
                        <Check className="h-3 w-3" />
                        Thanks for the feedback
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && messages.length <= 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-500">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-stone-100 bg-white p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-1.5 transition-colors focus-within:border-orange-200 focus-within:bg-white">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about invoices, VAT, payments…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: '#1C1917' }}
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ChatWidget ───────────────────────────────────────────────────────────────

export function ChatWidget(_props: ChatWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chatbot');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chatbot', label: 'Help topics' },
    { id: 'agent', label: 'AI agent' },
  ];

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        <a
          href="https://wa.me/971506358421"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/15 transition-all hover:scale-105 hover:bg-[#1da851] active:scale-95"
        >
          <WhatsAppIcon className="h-6 w-6" />
        </a>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close chat' : 'Open chat'}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: '#1C1917', boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.35)' }}
        >
          {open ? <X className="h-6 w-6" /> : <ENumerakLogo className="h-7 w-7" />}
        </button>
      </div>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[560px] max-h-[calc(100dvh-7rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/10"
          role="dialog"
          aria-label="Chat support"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 text-white" style={{ background: '#1C1917' }}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'rgba(194, 65, 12, 0.25)' }}
            >
              <ENumerakLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-tight text-white">
                E-Numerak Support
              </h1>
              <p className="text-[11px] text-stone-400">Compliance & Tax Assistant</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Minimize chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-100 bg-stone-50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-xl py-1.5 text-center text-xs font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content Views */}
          <div className="min-h-0 flex-1 bg-white">
            {tab === 'chatbot' ? <ChatbotTab /> : <AgentTab onClose={() => setOpen(false)} />}
          </div>
        </div>
      )}
    </>
  );
}