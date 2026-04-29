'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  ChevronRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

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
  /** When true, hides the AI Agent tab (for public/unauthenticated pages) */
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
          'The platform supports:\n• Tax Invoice (380)\n• Credit Note (381)\n• Commercial Invoice (480)\n• Continuous Supply Invoice (875)\n\nAll per the UAE PINT / PEPPOL BIS 3.0 standard.',
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
          'Open the invoice detail page. Once status is Submitted or Validated, a "Download XML" button appears. Click it to download the PEPPOL UBL 2.1 XML file.',
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
        text: 'What is PEPPOL / UAE PINT?',
        answer:
          'PEPPOL (Pan-European Public Procurement On-Line) is a global e-invoicing network. UAE PINT is the UAE national profile based on PEPPOL BIS 3.0 and UBL 2.1, mandated by the UAE FTA for e-invoicing compliance.',
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
          'Yes. E-Numerak is FTA-certified and fully compliant with Federal Decree-Law No. 16 of 2024. It generates PEPPOL BIS 3.0 / UBL 2.1 e-invoices and submits them to the Accredited Service Provider (ASP).',
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex-wrap min-h-[36px]">
        <button
          onClick={reset}
          className="hover:text-blue-600 font-medium transition-colors"
        >
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

// ─── AgentTab ─────────────────────────────────────────────────────────────────

function AgentTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/chat/', { messages: next });
      const reply: string = res.data?.data?.reply ?? 'No response received.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setError('Could not get a response. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-gray-400 py-8">
            <Bot className="w-10 h-10 text-blue-300" />
            <p className="text-sm leading-relaxed">
              Ask me anything about UAE e-invoicing,<br />VAT rules, or using this platform.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
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

        {error && (
          <p className="text-center text-xs text-red-500">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex gap-2 items-end">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={send}
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

export function ChatWidget({ publicMode = false }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chatbot');

  const tabs: { id: Tab; label: string }[] = publicMode
    ? [{ id: 'chatbot', label: 'Help Topics' }]
    : [
        { id: 'chatbot', label: 'Help Topics' },
        { id: 'agent',   label: 'AI Agent' },
      ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[560px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center gap-3">
            <Bot className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">E-Invoice Assistant</p>
              <p className="text-xs text-blue-300 truncate">UAE PINT / PEPPOL support</p>
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
            {tab === 'chatbot' ? <ChatbotTab /> : <AgentTab />}
          </div>
        </div>
      )}
    </>
  );
}
