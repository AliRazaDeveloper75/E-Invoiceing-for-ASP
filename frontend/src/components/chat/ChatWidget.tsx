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
  LogOut,
  ThumbsUp,
  ThumbsDown,
  Check,
} from 'lucide-react';

// ─── Custom Icons ─────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Professional geometric abstract logo representing E-Numerak (Secure E-Invoicing / Tax nodes)
function ENumerakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

// ─── Environment Setup ────────────────────────────────────────────────────────

const AI_AGENT_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ??
  'https://tax-data-assistant-backend-production.up.railway.app';

const AI_AGENT_BASE = AI_AGENT_URL.replace(/\/chat\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'chatbot' | 'agent';

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
  'How do I create an invoice?',
  'What is a TRN?',
];

// ─── AgentTab ─────────────────────────────────────────────────────────────────

interface AgentTabProps {
  onClose: () => void;
}

function AgentTab({ onClose }: AgentTabProps) {
  const [sessionId, setSessionId] = useState('');
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let id = localStorage.getItem('chat_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('chat_session_id', id);
    }
    setSessionId(id);

    const reg = localStorage.getItem('chat_registered');
    const savedName = localStorage.getItem('chat_user_name');
    const savedEmail = localStorage.getItem('chat_user_email');

    if (reg === 'true' && savedName && savedEmail) {
      setRegistered(true);
      setName(savedName);
      setEmail(savedEmail);
      setMessages([
        {
          role: 'assistant',
          content: `Welcome back, ${savedName}! 👋 How can I assist you with UAE tax today?`,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  async function register() {
    setRegError(null);
    if (!sessionId) return setRegError('Please wait and try again.');
    if (!name.trim()) return setRegError('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setRegError('Please enter a valid email.');

    setRegLoading(true);
    try {
      const res = await fetch(`${AI_AGENT_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), session_id: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        localStorage.setItem('chat_registered', 'true');
        localStorage.setItem('chat_user_name', name.trim());
        localStorage.setItem('chat_user_email', email.trim());
        setRegistered(true);
        setMessages([
          {
            role: 'assistant',
            content: `Hello, ${name.trim()}! 👋 I'm your E-Numerak Tax Assistant. How can I help you today?`,
          },
        ]);
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
    if (!msgText || loading || !sessionId) return;

    setMessages((m) => [...m, { role: 'user', content: msgText }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${AI_AGENT_BASE}/chat/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText, session_id: sessionId, email: email }),
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
  if (!target || target.role !== 'assistant') return;

  const nextRating = target.feedback === rating ? null : rating;

  setMessages((m) => {
    const updated = [...m];
    updated[index] = { ...updated[index], feedback: nextRating };
    return updated;
  });

  if (!nextRating) return;

  // Get the user message that came before this bot response
  const userMessage = messages[index - 1]?.content ?? '';

  try {
    await fetch(`${AI_AGENT_BASE}/chat/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
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
    if (sessionId) {
      try {
        await fetch(`${AI_AGENT_BASE}/clear-memory/${sessionId}`, { method: 'POST' });
      } catch {
        /* ignore */
      }
    }
    setError(null);
    setMessages([{ role: 'assistant', content: 'New conversation started! How can I help you? 😊' }]);
  }

  function handleExit() {
    localStorage.removeItem('chat_registered');
    localStorage.removeItem('chat_user_name');
    localStorage.removeItem('chat_user_email');
    localStorage.removeItem('chat_session_id');
    setRegistered(false);
    setName('');
    setEmail('');
    setMessages([]);
    setError(null);
    setSessionId('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!registered) {
    return (
      <div className="relative flex h-full flex-col justify-center bg-gradient-to-b from-white to-slate-50 px-6 py-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <ENumerakLogo className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Welcome to E-Numerak
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Your UAE tax assistant — here to help 24/7
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="Enter your name"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="Enter your email"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
            />
          </div>

          {regError && (
            <p className="text-center text-xs font-medium text-rose-500">{regError}</p>
          )}

          <button
            onClick={register}
            disabled={regLoading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {regLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              'Start chatting'
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-400">
          🔒 Your data is safe and private
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <button
          onClick={handleExit}
          title="Switch account"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-rose-200 hover:text-rose-500"
        >
          <LogOut className="h-3 w-3" />
          Exit
        </button>

        <button
          onClick={newChat}
          title="New chat"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900"
        >
          <RotateCcw className="h-3 w-3" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <ENumerakLogo className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">AI Tax Assistant</p>
                <p className="text-xs text-slate-400">Usually replies instantly</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              Ask me anything about tax invoices, VAT, TRNs, or UAE e-invoicing on E-Numerak.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900/20 hover:bg-slate-50 hover:text-slate-900"
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
                      ? 'rounded-br-md bg-slate-900 text-white'
                      : 'rounded-bl-md border border-slate-100 bg-slate-50 text-slate-700'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    showTyping ? (
                      <span className="flex h-4 items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.3s]" />
                      </span>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:text-slate-900 prose-strong:text-slate-900">
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
                        msg.feedback === 'like' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" fill={msg.feedback === 'like' ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => sendFeedback(i, 'dislike')}
                      aria-label="Bad response"
                      title="Bad response"
                      className={`rounded-md p-1 transition-colors ${
                        msg.feedback === 'dislike' ? 'text-rose-500' : 'text-slate-300 hover:text-slate-500'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" fill={msg.feedback === 'dislike' ? 'currentColor' : 'none'} />
                    </button>
                    {msg.feedback && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
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
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900/20 hover:bg-slate-50 hover:text-slate-900"
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

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition-colors focus-within:border-slate-300 focus-within:bg-white">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about invoices, VAT, payments…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
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
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition-all hover:scale-105 hover:bg-slate-800 active:scale-95"
        >
          {open ? <X className="h-6 w-6" /> : <ENumerakLogo className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[520px] max-h-[calc(100dvh-7rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
          role="dialog"
          aria-label="Chat support"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-3.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <ENumerakLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-tight text-white">
                E-Numerak Support
              </h1>
              <p className="text-[11px] text-slate-400">Compliance & Tax Assistant</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Minimize chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-xl py-1.5 text-center text-xs font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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