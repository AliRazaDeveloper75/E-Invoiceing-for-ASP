'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  X,
  Send,
  Bot,
  ChevronRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// External AI Agent endpoint (streaming). Override via NEXT_PUBLIC_AI_AGENT_URL.
const AI_AGENT_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ??
  'https://tax-data-assistant-backend-production.up.railway.app';

// Base URL (without the trailing /chat) for /register, /chat and /clear-memory.
const AI_AGENT_BASE = AI_AGENT_URL.replace(/\/chat\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'chatbot' | 'agent';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
          'E-Invoice is the UAE\'s standard electronic invoicing network. UAE PINT is the UAE national profile based on BIS 3.0 and UBL 2.1, mandated by the UAE FTA for e-invoicing compliance.',
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex-wrap min-h-[36px]">
        <button onClick={reset} className="hover:text-blue-600 font-medium transition-colors">
          Home
        </button>
        {path.map((node, i) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <button
              onClick={() => {
                setPath(path.slice(0, i + 1));
                setAnswer(node.answer ?? null);
              }}
              className="hover:text-blue-600 transition-colors truncate max-w-[100px]"
            >
              {node.text}
            </button>
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {answer ? (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed">
              {answer}
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Back to main menu
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">
              {path.length === 0 ? 'What can I help you with today?' : 'Choose a topic:'}
            </p>
            {currentMenu.map((node) => (
              <button
                key={node.id}
                onClick={() => select(node)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm text-left group"
              >
                <span className="text-gray-700 group-hover:text-blue-700 font-medium">
                  {node.text}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" />
              </button>
            ))}
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

  // ── FIX 1: Properly restore email from localStorage ──────────────────────
  useEffect(() => {
    let id = localStorage.getItem('chat_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('chat_session_id', id);
    }
    setSessionId(id);

    const reg = localStorage.getItem('chat_registered');
    const savedName = localStorage.getItem('chat_user_name');
    const savedEmail = localStorage.getItem('chat_user_email'); // ← read email

    if (reg === 'true' && savedName && savedEmail) {
      setRegistered(true);
      setName(savedName);
      setEmail(savedEmail); // ← FIX: set email state so send() can use it
      setMessages([{
        role: 'assistant',
        content: `Welcome back, ${savedName}! 👋 How can I assist you with UAE tax today?`,
      }]);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function register() {
    setRegError(null);
    if (!sessionId) return setRegError('Please wait and try again.');
    if (!name.trim()) return setRegError('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setRegError('Please enter a valid email.');

    setRegLoading(true);
    try {
      const res = await fetch(`${AI_AGENT_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), session_id: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        localStorage.setItem('chat_registered', 'true');
        localStorage.setItem('chat_user_name', name.trim());
        localStorage.setItem('chat_user_email', email.trim()); // ← save email
        setRegistered(true);
        setMessages([{
          role: 'assistant',
          content: `Hello, ${name.trim()}! 👋 I'm your E-Numerak Tax Assistant. How can I help you today?`,
        }]);
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
      const res = await fetch(`${AI_AGENT_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText, session_id: sessionId, email: email }), // ← email included
      });
      if (!res.ok || !res.body) throw new Error('Request failed');

      setMessages((m) => [...m, { role: 'assistant', content: '' }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      // eslint-disable-next-line no-constant-condition
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

  async function newChat() {
    if (sessionId) {
      try { await fetch(`${AI_AGENT_BASE}/clear-memory/${sessionId}`, { method: 'POST' }); } catch { /* ignore */ }
    }
    setError(null);
    setMessages([{ role: 'assistant', content: 'New conversation started! How can I help you? 😊' }]);
  }

  // ── FIX 2: Exit / logout — clears localStorage and goes back to registration ──
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

  // ── Registration gate ──────────────────────────────────────────────────────
  if (!registered) {
    return (
      <div className="flex flex-col h-full justify-center px-6 py-6 bg-gray-50 relative">
        {/* ── FIX 3: Close/Exit button on registration screen ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="text-3xl mb-2">👋</div>
          <h2 className="text-gray-800 font-bold text-base">Welcome to E-Numerak</h2>
          <p className="text-gray-500 text-xs mt-1">Your UAE Tax Assistant — here to help 24/7</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="Enter your name"
              className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 bg-white transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="Enter your email"
              className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 bg-white transition-colors"
            />
          </div>

          {regError && <p className="text-red-500 text-xs text-center">{regError}</p>}

          <button
            onClick={register}
            disabled={regLoading}
            className="w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors mt-1"
          >
            {regLoading ? 'Starting…' : 'Start Chatting →'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">🔒 Your data is safe and private</p>
      </div>
    );
  }

  // ── Chat ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-3 pt-2">
        {/* Exit button — goes back to registration */}
        <button
          onClick={handleExit}
          title="Switch account"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-full px-2 py-0.5 hover:border-red-300 transition-colors"
        >
          <X className="w-3 h-3" /> Exit
        </button>

        <button
          onClick={newChat}
          title="New chat"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-full px-2 py-0.5 hover:border-blue-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-start justify-start gap-3 text-gray-500 py-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Bot className="w-5 h-5" />
              <span className="text-sm font-medium">AI Tax Assistant</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Hello! Ask me anything about tax invoices, VAT, TRN, or UAE e-invoicing on E-Numerak.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'space-y-1'}`}>
              <div
               className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' && msg.content ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
              ) : msg.role === 'user' ? (
                msg.content
              ) : (
                loading ? (
                  <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </span>
                ) : null
              )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-red-500">{error}</p>}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex gap-2 items-end">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about invoices, VAT, payments…"
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── ChatWidget ───────────────────────────────────────────────────────────────

export function ChatWidget(_props: ChatWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chatbot');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chatbot', label: 'Help Topics' },
    { id: 'agent', label: 'AI Agent' },
  ];

  return (
    <>
      {/* Floating buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        {/* WhatsApp */}
        <a
          href="https://wa.me/971506358421"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1da851] hover:scale-105 active:scale-95 transition-all"
        >
          <WhatsAppIcon className="w-7 h-7" />
        </a>

        {/* Help / Chat */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close chat' : 'Open chat'}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1e3a5f] text-white shadow-lg hover:bg-[#1e4080] hover:scale-105 active:scale-95 transition-all"
        >
          {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[560px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center gap-3">
            <Bot className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">E-Invoice Assistant</p>
              <p className="text-xs text-blue-300 truncate">UAE PINT / E-Invoice support</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            {tab === 'chatbot' ? <ChatbotTab /> : <AgentTab onClose={() => setOpen(false)} />}
          </div>
        </div>
      )}
    </>
  );
}