'use client';

import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useAutosaveDraft, type DraftEnvelope } from '@/hooks/useAutosaveDraft';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import CustomSelect from '@/components/ui/CustomSelect';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Trash2, Plus, FileText, RotateCcw, RefreshCw,
  CheckCircle2, ArrowLeft, AlertTriangle, Search,
  TrendingUp, TrendingDown, Globe, ShieldCheck,
  PackageOpen, BarChart2, FileCheck, FileX,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Minus,
  Building2, Package, CreditCard, Users, UserCheck,
  Upload, Download, FileSpreadsheet, X,
  QrCode, PenLine, ExternalLink, Landmark, Phone, Mail,
  MapPin, CalendarClock, Copy, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Wallet, Banknote, CircleDollarSign,
  Share2, Maximize2,
} from 'lucide-react';
import { AxiosError } from 'axios';
import type { Customer } from '@/types';
import * as XLSX from 'xlsx';
import { FieldTooltip } from '@/components/ui/FieldTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardType {
  value: string;
  title: string;
  subtitle: string;
  hint: string;
  vatRate: string;
  vatLabel: string;
  boxRef: string;
  reqRef: string;
  color: string;
  icon: React.ReactNode;
  docType: string;
  isReverseCharge?: boolean;
}

// ─── Card color map ───────────────────────────────────────────────────────────

const C: Record<string, { border: string; bg: string; icon: string; badge: string; ring: string }> = {
  blue:    { border: 'border-blue-500',    bg: 'bg-blue-50',    icon: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    ring: 'ring-blue-200'    },
  amber:   { border: 'border-amber-500',   bg: 'bg-amber-50',   icon: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',   ring: 'ring-amber-200'   },
  orange:  { border: 'border-orange-500',  bg: 'bg-orange-50',  icon: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700',  ring: 'ring-orange-200'  },
  indigo:  { border: 'border-indigo-500',  bg: 'bg-indigo-50',  icon: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  ring: 'ring-indigo-200'  },
  rose:    { border: 'border-rose-500',    bg: 'bg-rose-50',    icon: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700',    ring: 'ring-rose-200'    },
  violet:  { border: 'border-violet-500',  bg: 'bg-violet-50',  icon: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700',  ring: 'ring-violet-200'  },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' },
  teal:    { border: 'border-teal-500',    bg: 'bg-teal-50',    icon: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',    ring: 'ring-teal-200'    },
  purple:  { border: 'border-purple-500',  bg: 'bg-purple-50',  icon: 'text-purple-600',  badge: 'bg-purple-100 text-purple-700',  ring: 'ring-purple-200'  },
  slate:   { border: 'border-slate-400',   bg: 'bg-slate-50',   icon: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600',   ring: 'ring-slate-200'   },
};

// ─── Document types ───────────────────────────────────────────────────────────

const DOCUMENT_TYPES: CardType[] = [
  {
    value: 'tax_invoice', title: 'Tax Invoice', subtitle: 'Standard B2B / B2G',
    hint: 'Standard UAE tax invoice for goods and services supplied to registered businesses or government entities.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'UBL 380', reqRef: 'Req 12',
    color: 'blue', icon: <FileText className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'credit_note', title: 'Credit Note', subtitle: 'Corrects a prior invoice',
    hint: 'Issued to reduce the value of a previously issued tax invoice. Requires the original invoice number.',
    vatRate: 'standard', vatLabel: 'Varies', boxRef: 'UBL 381', reqRef: 'Req 13',
    color: 'amber', icon: <RotateCcw className="h-6 w-6" />, docType: 'credit_note',
  },
  {
    value: 'debit_note', title: 'Debit Note', subtitle: 'Increases value of a prior invoice',
    hint: 'Issued to increase the value of a previously issued tax invoice. Requires the original invoice number.',
    vatRate: 'standard', vatLabel: 'Varies', boxRef: 'UBL 383', reqRef: 'Req 13',
    color: 'orange', icon: <FileX className="h-6 w-6" />, docType: 'tax_invoice',
  },
];

const SALES_TYPES: CardType[] = [
  {
    value: 'domestic_standard', title: 'Domestic Sales', subtitle: 'Standard-rated supplies',
    hint: 'Sales of goods or services within the UAE subject to standard 5% VAT.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 1a', reqRef: 'Req 1.1',
    color: 'blue', icon: <TrendingUp className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'intra_gcc_transfer', title: 'Intra-GCC Transfer', subtitle: 'Transfer of imported goods (5%)',
    hint: 'Transfer of imported goods between GCC states subject to UAE standard rate VAT.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 1b', reqRef: 'Req 1.2',
    color: 'indigo', icon: <ArrowUpRight className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'import_reverse_charge', title: 'Import — Reverse Charge', subtitle: 'Import outside GCC (RC)',
    hint: 'Import from outside GCC subject to reverse charge — VAT liability transfers to the buyer.',
    vatRate: 'standard', vatLabel: '5% RC', boxRef: 'Box 1c', reqRef: 'Req 1.3',
    color: 'rose', icon: <FileCheck className="h-6 w-6" />, docType: 'tax_invoice', isReverseCharge: true,
  },
  {
    value: 'intra_gcc_purchase_std', title: 'Intra-GCC Purchase', subtitle: 'Standard-rated (5%)',
    hint: 'Standard-rated purchases from other GCC member states subject to UAE VAT.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 1d', reqRef: 'Req 1.4',
    color: 'violet', icon: <ShoppingBag className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'export_zero', title: 'Exports', subtitle: 'Zero-rated supplies (0%)',
    hint: 'Export of goods or services to customers outside the UAE or GCC — zero-rated for VAT.',
    vatRate: 'zero', vatLabel: '0%', boxRef: 'Box 2', reqRef: 'Req 1.5',
    color: 'emerald', icon: <Globe className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'intra_gcc_oos', title: 'Intra-GCC Supplies', subtitle: 'Outside scope of VAT',
    hint: 'Intra-GCC supplies that fall outside the scope of UAE VAT legislation.',
    vatRate: 'out_of_scope', vatLabel: 'OOS', boxRef: 'Box 3', reqRef: 'Req 1.6',
    color: 'slate', icon: <Minus className="h-6 w-6" />, docType: 'commercial_invoice',
  },
  {
    value: 'exempt', title: 'Exempt Supplies', subtitle: 'No VAT applicable',
    hint: 'Exempt supplies such as financial services, bare land, or residential rent — no VAT charged.',
    vatRate: 'exempt', vatLabel: 'Exempt', boxRef: 'Box 4', reqRef: 'Req 1.7',
    color: 'teal', icon: <ShieldCheck className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'out_of_scope', title: 'Out of Scope Supplies', subtitle: 'Outside VAT legislation',
    hint: 'Supplies that fall entirely outside the scope of UAE VAT law.',
    vatRate: 'out_of_scope', vatLabel: 'OOS', boxRef: 'Box 5', reqRef: 'Req 1.8',
    color: 'slate', icon: <Minus className="h-6 w-6" />, docType: 'commercial_invoice',
  },
  {
    value: 'deemed', title: 'Deemed Supplies', subtitle: 'Treated as taxable (5%)',
    hint: 'Supplies treated as taxable under UAE VAT law — e.g. gifts, personal use, business entertainment.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 6', reqRef: 'Req 1.9',
    color: 'purple', icon: <FileCheck className="h-6 w-6" />, docType: 'tax_invoice',
  },
];

const PURCHASE_TYPES: CardType[] = [
  {
    value: 'domestic_purchase', title: 'Domestic Purchase', subtitle: 'Standard-rated (5%)',
    hint: 'Purchase of goods or services within the UAE subject to standard 5% VAT.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 10', reqRef: 'Req 1.10',
    color: 'blue', icon: <TrendingDown className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'import_outside_gcc', title: 'Import from Outside GCC', subtitle: 'Normal, suspension & deferment',
    hint: 'Imports from outside GCC — includes normal imports, under suspension, and under VAT deferment scheme.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 11', reqRef: 'Req 1.11',
    color: 'indigo', icon: <ArrowDownRight className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'intra_gcc_purchase_import', title: 'Intra-GCC Purchases', subtitle: 'Imports — suspension / deferment',
    hint: 'Intra-GCC purchases including those under suspension or VAT normal deferment scheme.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 12', reqRef: 'Req 1.12',
    color: 'violet', icon: <PackageOpen className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'other_purchase', title: 'Other Purchases', subtitle: 'Zero-rated / Exempt / Non-VAT',
    hint: 'Zero-rated purchases, disallowed expenses, purchases from non-VAT registered suppliers, and exempt supplies.',
    vatRate: 'zero', vatLabel: '0% / Exempt', boxRef: 'Box 13', reqRef: 'Req 1.13',
    color: 'teal', icon: <ShoppingBag className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'recoverable_input', title: 'Recoverable Input Tax', subtitle: 'Partial exemption method',
    hint: 'Total recoverable input tax under the partial exemption method — standard-rated purchases only.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'Box 14', reqRef: 'Req 1.14',
    color: 'emerald', icon: <BarChart2 className="h-6 w-6" />, docType: 'tax_invoice',
  },
];

// ─── Form types ───────────────────────────────────────────────────────────────

interface LineItem {
  item_name: string;
  description: string;
  product_reference: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate_type: string;
}

interface InvoiceForm {
  customer_id: string;
  transaction_type: string;
  payment_means_code: string;
  supplier_location: string;
  accounts_type: string;
  customer_location: string;
  issue_date: string;
  due_date: string;
  supply_date: string;
  tax_payment_date: string;
  invoice_number_ref: string;
  permit_number: string;
  transaction_id: string;
  purchase_order_number: string;
  reference_number: string;
  credit_note_reason_code: string;
  gl_account_id: string;
  currency: string;
  exchange_rate: string;
  discount_amount: string;
  import_subtype: string;
  is_reverse_charge: boolean;
  notes: string;
  items: LineItem[];
}

const IMPORT_SUBTYPES = [
  { value: '',           label: '— Select import type —' },
  { value: 'normal',     label: 'Normal Import' },
  { value: 'suspension', label: 'Under Suspension' },
  { value: 'deferment',  label: 'Under VAT Deferment Scheme' },
];

const VAT_RATE_MAP: Record<string, number> = {
  standard: 5,
  zero: 0,
  exempt: 0,
  out_of_scope: 0,
};

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function customerFetcher(url: string) {
  const r = await api.get<{ success: boolean; results: Customer[] }>(url);
  return r.data.results ?? [];
}

// ─── Product catalog ──────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  unit_price: string;
  vat_rate_type: string;
  unit: string;
  scope: 'global' | 'company';
}

async function productFetcher(url: string) {
  const r = await api.get<{ success: boolean; data: CatalogProduct[] }>(url);
  return r.data.data ?? [];
}

// Limit free-text fields: max 15 words, each word max 15 characters.
function limitWords(value: string, label: string, maxWords = 15, maxWordLen = 15): string | true {
  if (!value?.trim()) return true;
  const words = value.trim().split(/\s+/);
  if (words.length > maxWords) return `${label}: maximum ${maxWords} words`;
  if (words.some((w) => w.length > maxWordLen)) return `${label}: each word max ${maxWordLen} characters`;
  return true;
}

// Avatar helpers for customer cards
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-teal-500',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

const TYPE_BADGE: Record<string, string> = {
  b2b: 'bg-blue-100 text-blue-700',
  b2g: 'bg-purple-100 text-purple-700',
  b2c: 'bg-amber-100 text-amber-700',
};
const TYPE_LABEL: Record<string, string> = { b2b: 'B2B', b2g: 'B2G', b2c: 'B2C' };

// Preview invoice number shown in the form/preview. The final number is assigned
// by the backend sequence on save; this is a human-friendly draft reference.
function generateInvoiceNumber(): string {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const key  = `inv-seq-${dd}${mm}${yyyy}`;
  const seq  = parseInt(localStorage.getItem(key) ?? '0', 10) + 1;
  localStorage.setItem(key, String(seq));
  return `INV-${dd}${mm}${yyyy}-${String(seq).padStart(3, '0')}`;
}

// ─── Type card ────────────────────────────────────────────────────────────────

function TypeCard({ card, selected, onSelect }: { card: CardType; selected: boolean; onSelect: () => void }) {
  const c = C[card.color] ?? C.blue;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative text-left rounded-xl border-2 p-5 transition-all duration-150
        ${selected
          ? `${c.border} ${c.bg} ring-2 ${c.ring} shadow-md`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
      `}
    >
      {selected && (
        <span className="absolute top-3 right-3 text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl mb-4 ${selected ? c.bg : 'bg-gray-100'}`}>
        <span className={selected ? c.icon : 'text-gray-500'}>{card.icon}</span>
      </div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="font-semibold text-gray-900">{card.title}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selected ? c.badge : 'bg-gray-100 text-gray-500'}`}>
          {card.boxRef}
        </span>
      </div>
      <p className={`text-xs font-medium mb-2 ${selected ? c.icon : 'text-gray-500'}`}>{card.subtitle}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{card.hint}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
          {card.reqRef}
        </span>
        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
          VAT {card.vatLabel}
        </span>
      </div>
    </button>
  );
}

// ─── Group heading ────────────────────────────────────────────────────────────

function GroupHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, hint, tooltip, required, error, children }: {
  label: string; faf?: boolean; hint?: string; tooltip?: string;
  required?: boolean; error?: string; children: React.ReactNode;
}) {
  const info = tooltip ?? hint;
  const optionalMatch = label.match(/^(.*?)\s*\(optional\)$/i);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-gray-700">
          {optionalMatch ? (
            <>{optionalMatch[1]} <span className="text-gray-400 font-normal">(optional)</span></>
          ) : label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {info && <FieldTooltip content={info} />}
      </div>
      {children}
      {error && <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">⚠ {error}</p>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-900 via-blue-950 to-indigo-900 flex items-start gap-2.5 sm:gap-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
        {icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/30 shrink-0 relative z-10">
            {icon}
          </div>
        )}
        <div className="min-w-0 relative z-10">
          <p className="font-bold text-white text-sm tracking-tight">{title}</p>
          {subtitle && <p className="text-xs text-blue-200/80 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">{children}</div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 ${err ? 'border-red-400' : 'border-gray-300'}`;

// Reusable text rule: at most 20 words, and each word at most 15 characters.
// Blocks long gibberish strings while allowing normal multi-word text.
const wordLimit = (label: string, maxWords = 20) => ({
  validate: (v?: string) => {
    const val = (v ?? '').trim();
    if (!val) return true;
    const words = val.split(/\s+/);
    if (words.length > maxWords) return `${label}: maximum ${maxWords} words allowed.`;
    const tooLong = words.find((w) => w.length > 15);
    if (tooLong) return `${label}: each word must be 15 characters or fewer.`;
    return true;
  },
});

// Flatten a DRF error-details object (which may nest arrays/objects, e.g. per-item
// errors) into readable "field: message" lines — never renders [object Object].
function flattenServerErrors(details: unknown, prefix = ''): string[] {
  const out: string[] = [];
  if (details == null) return out;
  if (typeof details === 'string') { out.push(prefix ? `${prefix}: ${details}` : details); return out; }
  if (Array.isArray(details)) {
    details.forEach((item, i) => {
      const p = prefix ? `${prefix}[${i + 1}]` : `#${i + 1}`;
      out.push(...flattenServerErrors(item, p));
    });
    return out;
  }
  if (typeof details === 'object') {
    Object.entries(details as Record<string, unknown>).forEach(([k, v]) => {
      const label = k.replace(/_/g, ' ');
      out.push(...flattenServerErrors(v, prefix ? `${prefix} · ${label}` : label));
    });
    return out;
  }
  out.push(prefix ? `${prefix}: ${String(details)}` : String(details));
  return out;
}

// ─── Excel columns (order matters — matches sample template) ──────────────────

const EXCEL_COLS = [
  { key: 'item_name',          header: 'Item / Service Name *' },
  { key: 'description',        header: 'Description *'         },
  { key: 'product_reference',  header: 'Product Reference'      },
  { key: 'quantity',           header: 'Quantity *'             },
  { key: 'unit',               header: 'Unit (pcs/hr/kg)'       },
  { key: 'unit_price',         header: 'Unit Price (excl. VAT) *' },
  { key: 'vat_rate_type',      header: 'VAT Rate (standard/zero/exempt/out_of_scope)' },
];

const EXCEL_SAMPLE_ROWS = [
  ['IT Consulting Services', 'Monthly IT support and consulting', 'SVC-001', '1', 'hr',  '1000.00', 'standard'],
  ['Office Chair',           'Ergonomic high-back office chair',  'SKU-002', '5', 'pcs', '500.00',  'standard'],
  ['Software License',       'Annual SaaS subscription fee',      'LIC-003', '1', 'yr',  '2500.00', 'standard'],
];

function downloadSampleExcel() {
  const ws = XLSX.utils.aoa_to_sheet([
    EXCEL_COLS.map(c => c.header),
    ...EXCEL_SAMPLE_ROWS,
  ]);

  // Column widths for readability
  ws['!cols'] = [28, 35, 20, 10, 14, 22, 42, 20].map(w => ({ wch: w }));

  // Style header row (bold) — xlsx community edition doesn't support cell styles,
  // but the width hints still improve usability.

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Line Items');
  XLSX.writeFile(wb, 'e-numerak-items-template.xlsx');
}

type ItemField = {
  item_name: string; description: string; product_reference: string;
  quantity: string; unit: string; unit_price: string;
  vat_rate_type: string;
};

function parseExcelToItems(file: File): Promise<{ items: ItemField[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) {
          resolve({ items: [], errors: ['The file has no data rows. Add at least one row below the header.'] });
          return;
        }

        const header = (rows[0] as string[]).map(h => String(h).trim());
        const colMap: Record<string, number> = {};
        EXCEL_COLS.forEach(({ key }) => {
          const idx = header.findIndex(h =>
            h.toLowerCase().startsWith(key.replace(/_/g, ' ')) ||
            h.toLowerCase().includes(key.replace(/_/g, ' '))
          );
          if (idx !== -1) colMap[key] = idx;
        });

        const items: ItemField[] = [];
        const errors: string[] = [];

        rows.slice(1).forEach((row, i) => {
          const get = (key: string) => String(row[colMap[key]] ?? '').trim();
          const rowNum = i + 2;

          const name  = get('item_name');
          const desc  = get('description');
          const price = get('unit_price');

          if (!name && !desc) return; // skip blank rows silently

          if (!price || isNaN(parseFloat(price))) {
            errors.push(`Row ${rowNum}: Unit Price is missing or invalid.`);
            return;
          }

          const vat = get('vat_rate_type').toLowerCase() || 'standard';
          const validVat = ['standard', 'zero', 'exempt', 'out_of_scope'];

          items.push({
            item_name:         name,
            description:       desc || name,
            product_reference: get('product_reference'),
            quantity:          get('quantity') || '1',
            unit:              get('unit'),
            unit_price:        stripZeros(price),
            vat_rate_type:     validVat.includes(vat) ? vat : 'standard',
          });
        });

        resolve({ items, errors });
      } catch {
        resolve({ items: [], errors: ['Could not read the file. Make sure it is a valid .xlsx or .csv file.'] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function ExcelUploadButton({
  onItems, defaultVat,
}: {
  onItems: (items: ItemField[], mode: 'replace' | 'append') => void;
  defaultVat: string;
}) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [msg,    setMsg]    = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing');
    setMsg('');

    const { items, errors } = await parseExcelToItems(file);
    e.target.value = '';

    if (errors.length && !items.length) {
      setStatus('error');
      setMsg(errors.join(' · '));
      return;
    }

    if (!items.length) {
      setStatus('error');
      setMsg('No valid rows found in the file.');
      return;
    }

    const itemsWithVat = items.map(it => ({
      ...it,
      vat_rate_type: it.vat_rate_type || defaultVat,
    }));

    onItems(itemsWithVat, 'replace');
    setStatus('done');
    setMsg(`${items.length} item${items.length > 1 ? 's' : ''} imported.${errors.length ? ` (${errors.length} rows skipped)` : ''}`);
    setTimeout(() => setStatus('idle'), 4000);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Download sample */}
      <button
        type="button"
        onClick={downloadSampleExcel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
      >
        <Download className="h-3.5 w-3.5" />
        Template
      </button>

      {/* Upload */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'parsing'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-xs font-semibold text-white shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50"
      >
        {status === 'parsing'
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <Upload className="h-3.5 w-3.5" />}
        {status === 'parsing' ? 'Reading\u2026' : 'Upload Excel / CSV'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />

      {/* Status badge */}
      {status === 'done' && (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
          <CheckCircle2 className="h-3 w-3" /> {msg}
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full max-w-xs">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{msg}</span>
          <button type="button" onClick={() => setStatus('idle')}><X className="h-3 w-3" /></button>
        </span>
      )}
    </div>
  );
}

// ─── Catalog picker (one-shot trigger) ────────────────────────────────────────

function CatalogPicker({ products, onSelect }: { products: CatalogProduct[]; onSelect: (id: string) => void }) {
  const [selected, setSelected] = useState('');
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">Pick from catalog (optional)</label>
      <CustomSelect
        value={selected}
        onChange={(val) => { if (val) { onSelect(val); setSelected(''); } }}
        placeholder="— Select a saved product to auto-fill —"
        options={[
          { value: '', label: '— Select a saved product to auto-fill —' },
          ...products.map((p) => ({
            value: p.id,
            label: `${p.name}${p.unit_price ? ` — ${p.unit_price}` : ''}${p.scope === 'global' ? ' (global)' : ''}`,
          })),
        ]}
      />
    </div>
  );
}

// ─── Line item row ────────────────────────────────────────────────────────────

/** Strip trailing zeros from a numeric string: "238.0000" → "238", "5.50" → "5.5" */
function stripZeros(v: string): string {
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(n) : v;
}

function ItemRow({ idx, register, control, errors, trigger, vatLocked, onRemove, canRemove, products, setValue }: {
  idx: number;
  register: ReturnType<typeof useForm<InvoiceForm>>['register'];
  control: ReturnType<typeof useForm<InvoiceForm>>['control'];
  errors: ReturnType<typeof useForm<InvoiceForm>>['formState']['errors'];
  trigger: ReturnType<typeof useForm<InvoiceForm>>['trigger'];
  vatLocked: boolean; onRemove: () => void; canRemove: boolean;
  products: CatalogProduct[];
  setValue: ReturnType<typeof useForm<InvoiceForm>>['setValue'];
}) {
  function applyProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setValue(`items.${idx}.item_name`, p.name, { shouldValidate: true });
    setValue(`items.${idx}.description`, p.description || p.name, { shouldValidate: true });
    setValue(`items.${idx}.unit_price`, stripZeros(p.unit_price), { shouldValidate: true });
    setValue(`items.${idx}.unit`, p.unit || '', { shouldValidate: true });
    if (!vatLocked) setValue(`items.${idx}.vat_rate_type`, p.vat_rate_type || 'standard', { shouldValidate: true });
  }

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item #{idx + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      {/* Pick from saved catalog — auto-fills the fields below */}
      {products.length > 0 && (
        <CatalogPicker products={products} onSelect={applyProduct} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Item / Service Name" faf required
          error={errors.items?.[idx]?.item_name?.message}
          tooltip="Short name for this product or service. Max 5 words, 120 characters.">
          <input placeholder="e.g. IT Consulting, Office Chair…" maxLength={120}
            className={inputCls(errors.items?.[idx]?.item_name?.message)}
            {...register(`items.${idx}.item_name`, {
              required: 'Required',
              maxLength: { value: 120, message: 'Max 120 characters' },
              ...wordLimit('Item name', 5),
              onChange: () => { setTimeout(() => trigger(`items.${idx}.item_name`), 0); },
            })} />
        </Field>
        <Field label="Product / Service Reference" faf required
          error={errors.items?.[idx]?.product_reference?.message}
          tooltip="Your internal product code or SKU for this line — e.g. SKU-001 or SVC-REF. Max 5 words.">
          <input placeholder="e.g. SKU-001 or SVC-REF" maxLength={50}
            className={inputCls(errors.items?.[idx]?.product_reference?.message)}
            {...register(`items.${idx}.product_reference`, {
              required: 'Required',
              ...wordLimit('Reference', 5),
              onChange: () => { setTimeout(() => trigger(`items.${idx}.product_reference`), 0); },
            })} />
        </Field>
      </div>

      <Field label="Description of Goods / Services" faf required
        tooltip="A clear description of the goods or services supplied. Required on every line by the FTA."
        error={errors.items?.[idx]?.description?.message}>
        <input
          placeholder="Full description of goods or services supplied…"
          className={inputCls(errors.items?.[idx]?.description?.message)}
          {...register(`items.${idx}.description`, {
            required: 'Description is required',
            maxLength: { value: 300, message: 'Description must be 300 characters or fewer' },
            ...wordLimit('Description', 50),
            onChange: () => { setTimeout(() => trigger(`items.${idx}.description`), 0); },
          })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" required
          tooltip="Number of units supplied. Must be greater than 0."
          error={errors.items?.[idx]?.quantity?.message}>
          <input type="number" step="0.01" min="0.01" className={inputCls(errors.items?.[idx]?.quantity?.message)}
            {...register(`items.${idx}.quantity`, {
              required: 'Required',
              validate: (v) => (parseFloat(v) > 0) || 'Must be greater than 0',
            })} />
        </Field>
        <Field label="Unit" required tooltip="Unit of measure.">
          <Controller control={control} name={`items.${idx}.unit`} rules={{ required: 'Required' }}
            render={({ field }) => (
              <CustomSelect value={field.value} onChange={field.onChange}
                options={[
                  { value: '', label: '— Select —' },
                  { value: 'pcs', label: 'pcs' }, { value: 'hr', label: 'hr' },
                  { value: 'kg', label: 'kg' }, { value: 'g', label: 'g' },
                  { value: 'm', label: 'm' }, { value: 'm²', label: 'm²' },
                  { value: 'm³', label: 'm³' }, { value: 'L', label: 'L' },
                  { value: 'ml', label: 'ml' }, { value: 'box', label: 'box' },
                  { value: 'set', label: 'set' }, { value: 'pair', label: 'pair' },
                  { value: 'doz', label: 'doz' }, { value: 'day', label: 'day' },
                  { value: 'month', label: 'month' }, { value: 'year', label: 'year' },
                  { value: 'service', label: 'service' }, { value: 'unit', label: 'unit' },
                ]} />
            )} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit Price (excl. VAT)" required
          tooltip="Price per unit excluding VAT. Cannot be negative."
          error={errors.items?.[idx]?.unit_price?.message}>
          <input type="number" step="0.01" min="0" placeholder="0.00"
            className={inputCls(errors.items?.[idx]?.unit_price?.message)}
            {...register(`items.${idx}.unit_price`, {
              required: 'Required',
              validate: (v) => (parseFloat(v) >= 0) || 'Cannot be negative',
            })} />
        </Field>
        <Field label="VAT Rate"
          tooltip="The VAT treatment for this line: Standard 5%, Zero-rated 0%, Exempt, or Out of Scope.">
          {vatLocked ? (
            <>
              <input type="hidden" value="out_of_scope" {...register(`items.${idx}.vat_rate_type`)} />
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 font-medium h-9 flex items-center">
                Out of Scope (O) — auto
              </div>
            </>
          ) : (
            <Controller control={control} name={`items.${idx}.vat_rate_type`}
              render={({ field }) => (
                <CustomSelect value={field.value} onChange={field.onChange}
                  options={[
                    { value: 'standard', label: 'Standard 5% (S)' },
                    { value: 'zero', label: 'Zero Rate 0% (Z)' },
                    { value: 'exempt', label: 'Exempt (E)' },
                    { value: 'out_of_scope', label: 'Out of Scope (O)' },
                  ]} />
              )} />
          )}
        </Field>
      </div>
    </div>
  );
}

// ─── Form Progress Stepper ───────────────────────────────────────────────────

interface StepDef {
  label: string;
  sub: string;
  icon: React.ReactNode;
  done: boolean;
}

function FormStepper({ steps, current, onStepClick, onPrev, onNext }: { steps: StepDef[]; current?: number; onStepClick?: (idx: number) => void; onPrev?: () => void; onNext?: () => void }) {
  const activeIdx = current != null ? current : steps.findIndex((s) => !s.done);
  const allDone   = activeIdx === -1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xl shadow-gray-200/40 p-1.5 mb-5">
      <div className="flex items-stretch gap-1">
        {steps.map((s, i) => {
          const isDone    = current != null ? i < current : s.done;
          const isActive  = current != null ? i === current : (!allDone && i === activeIdx);
          const isLocked  = current != null ? i > current : !s.done && !isActive;
          const canClick  = onStepClick && isDone;
          return (
            <button
              key={i}
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(i)}
              className={`
                flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-300 min-w-0
                ${isActive
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200/50'
                  : isDone
                    ? 'bg-emerald-50/80 hover:bg-emerald-50'
                    : isLocked
                      ? 'bg-gray-50/60 opacity-40'
                      : 'bg-gray-50 hover:bg-gray-100'
                }
                ${canClick ? 'cursor-pointer group/step' : 'cursor-default'}
              `}
            >
              {/* Number / check */}
              <div className={`
                w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300
                ${isActive
                  ? 'bg-white/20 text-white'
                  : isDone
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/50'
                    : 'bg-gray-200/60 text-gray-400'
                }
                ${canClick && !isActive ? 'group-hover/step:bg-emerald-100 group-hover/step:text-emerald-600' : ''}
              `}>
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-[11px] font-black ${isActive ? '' : ''}`}>{i + 1}</span>
                )}
              </div>
              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-bold leading-tight truncate transition-colors duration-200
                  ${isActive ? 'text-white' : isDone ? 'text-emerald-700' : 'text-gray-500'}
                  ${canClick && !isActive ? 'group-hover/step:text-emerald-600' : ''}
                `}>{s.label}</p>
                <p className={`text-[9px] leading-tight mt-0.5 truncate transition-colors duration-200
                  ${isActive ? 'text-white/60' : isDone ? 'text-emerald-400' : 'text-gray-400'}
                `}>{s.sub}</p>
              </div>
              {/* Connector arrow (between steps) */}
              {i < steps.length - 1 && (
                <svg className={`w-3 h-3 shrink-0 ${isActive ? 'text-white/30' : 'text-gray-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Current step message with nav icons */}
      <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs mt-1.5
        ${allDone
          ? 'bg-emerald-50 border border-emerald-200/60 text-emerald-700'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100/60 text-indigo-700'}`}>
        {allDone ? (
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">All sections complete — ready to create invoice</span>
          </span>
        ) : (
          <span className="flex-1 min-w-0">
            <span className="font-semibold">Step {activeIdx + 1}:</span>{' '}
            {steps[activeIdx]?.label} — {steps[activeIdx]?.sub}
          </span>
        )}
        {(onPrev || onNext) && (
          <div className="flex items-center gap-1 shrink-0">
            {onPrev && (
              <button type="button" onClick={onPrev} disabled={activeIdx === 0 && !allDone}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150
                  ${activeIdx === 0 && !allDone
                    ? 'text-gray-300 cursor-not-allowed'
                    : allDone ? 'text-emerald-500 hover:bg-emerald-100' : 'text-indigo-400 hover:bg-white/60'}`}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {onNext && !allDone && (
              <button type="button" onClick={onNext}
                className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-indigo-400 hover:bg-white/60 transition-all duration-150">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Company Profile Card ─────────────────────────────────────────────────────

function CompanyProfileCard({ company }: { company: import('@/types').Company | null }) {
  const [copied, setCopied] = useState(false);

  if (!company) return null;

  const trnExpiry = company.trn_expiry_date ? new Date(company.trn_expiry_date) : null;
  const now = new Date();
  const daysUntilExpiry = trnExpiry ? Math.ceil((trnExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

  function copyTrn() {
    if (!company?.trn) return;
    navigator.clipboard.writeText(company.trn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 shadow-sm overflow-hidden">
      {/* Header band */}
      <div className="bg-white px-3 sm:px-5 py-3 space-y-2.5 sm:space-y-0 border-b border-blue-100/60">
        {/* Row 1: avatar + name */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs sm:text-sm text-blue-600 shrink-0 overflow-hidden">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="w-full h-full rounded-xl object-cover" />
            ) : (
              (company.name ?? 'CO').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-sm sm:text-base leading-tight break-words">{company.name}</p>
              {company.is_vat_group && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 shrink-0">VAT Group</span>
              )}
            </div>
            {company.legal_name && company.legal_name !== company.name && (
              <p className="text-[11px] text-gray-400 mt-0.5 break-words">{company.legal_name}</p>
            )}
          </div>
          {/* TRN right side on large screens */}
          <button type="button" onClick={copyTrn}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors duration-150 group shrink-0"
            title="Click to copy TRN">
            <span className="text-[10px] text-blue-400 uppercase tracking-wider font-medium">TRN</span>
            <span className="text-xs font-mono font-semibold text-gray-500">{company.trn || '—'}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3 text-blue-300 group-hover:text-blue-500 transition-colors" />
            )}
          </button>
        </div>
        {/* Row 2: TRN on mobile (full width below) */}
        <button type="button" onClick={copyTrn}
          className="sm:hidden inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors duration-150 group"
          title="Click to copy TRN">
          <span className="text-[10px] text-blue-400 uppercase tracking-wider font-medium">TRN</span>
          <span className="text-xs font-mono font-semibold text-gray-500">{company.trn || '—'}</span>
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3 text-blue-300 group-hover:text-blue-500 transition-colors" />
          )}
        </button>
      </div>

      <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3">
        {/* Expiry badges */}
        {(isExpired || isExpiringSoon || (trnExpiry && !isExpired && !isExpiringSoon)) && (
          <div className="flex items-center gap-2 flex-wrap">
            {isExpired && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-600">TRN Expired</span>
            )}
            {isExpiringSoon && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-600">Expiring in {daysUntilExpiry}d</span>
            )}
            {trnExpiry && !isExpired && !isExpiringSoon && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <CalendarClock className="h-3 w-3" />{company.trn_expiry_date}
              </span>
            )}
          </div>
        )}

        {/* Info list */}
        {(company.phone || company.email || company.website || company.formatted_address) && (
          <div className="rounded-xl bg-white/70 border border-blue-100/60 divide-y divide-blue-50">
            {company.phone && (
              <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700 break-all">{company.phone}</span>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700 break-all">{company.email}</span>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <Globe className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                   target="_blank" rel="noopener noreferrer"
                   className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {company.formatted_address && (
              <div className="flex items-start gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700 break-words">{company.formatted_address}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible Bank Details ─────────────────────────────────────────────────

function CollapsibleBankDetails({ company }: { company: import('@/types').Company | null }) {
  const [open, setOpen] = useState(false);
  if (!company?.bank_name && !company?.iban) return null;

  const fields = [
    company.bank_name && { label: 'Bank', value: company.bank_name },
    company.iban && { label: 'IBAN', value: company.iban, mono: true },
    company.bank_account_number && {
      label: 'Account',
      value: company.bank_account_number.length > 4 ? '•••• ' + company.bank_account_number.slice(-4) : company.bank_account_number,
      mono: true,
    },
    company.swift_code && { label: 'SWIFT', value: company.swift_code, mono: true },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  const filled = fields.length;
  const total = 4;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50/50 active:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            filled === total ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <Landmark className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800">Bank Details</p>
            <p className="text-[11px] text-gray-400">{filled} of {total} fields set</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filled === total && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}>
        <div className="overflow-hidden">
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2.5 sm:gap-y-3 border-t border-gray-100">
            {fields.map((f) => (
              <div key={f.label} className="min-w-0">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{f.label}</p>
                <p className={`font-medium text-gray-800 text-sm mt-0.5 ${f.mono ? 'font-mono break-all' : 'break-words'}`}>{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Method Cards ─────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { code: '30', label: 'Credit Transfer', icon: <Banknote className="h-6 w-6" />,       color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200' },
  { code: '10', label: 'Cash',            icon: <CircleDollarSign className="h-6 w-6" />, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  { code: '20', label: 'Cheque',          icon: <FileText className="h-6 w-6" />,         color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  { code: '48', label: 'Bank Card',       icon: <CreditCard className="h-6 w-6" />,       color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  { code: '49', label: 'Direct Debit',    icon: <Wallet className="h-6 w-6" />,           color: 'from-rose-500 to-rose-600', bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
  { code: '57', label: 'Standing Order',  icon: <RefreshCw className="h-6 w-6" />,        color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-600', ring: 'ring-cyan-200' },
  { code: '58', label: 'SEPA Transfer',   icon: <Globe className="h-6 w-6" />,            color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal-200' },
];

function PaymentMethodCards({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {PAYMENT_METHODS.map((pm) => {
        const active = value === pm.code;
        return (
          <button key={pm.code} type="button" onClick={() => onChange(pm.code)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all duration-150 ${
              active
                ? `border-indigo-400 ${pm.bg} ring-2 ${pm.ring}`
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm active:bg-gray-50'
            }`}>
            {active && (
              <span className="absolute top-1.5 right-1.5 text-indigo-500">
                <Check className="h-3 w-3" />
              </span>
            )}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pm.text}`}>
              {pm.icon}
            </div>
            <span className={`text-xs font-semibold leading-tight ${active ? 'text-indigo-700' : 'text-gray-700'}`}>
              {pm.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Live Invoice Preview ─────────────────────────────────────────────────────

interface PreviewProps {
  card: CardType;
  companyName: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  discount: string;
  items: LineItem[];
  invoiceNo: string;
}

function InvoicePreview({ card, companyName, customerName, issueDate, dueDate, currency, discount, items, invoiceNo }: PreviewProps) {
  const cur  = currency || 'AED';
  const disc = parseFloat(discount) || 0;

  const lineCalcs = items.map((it) => {
    const qty   = parseFloat(it.quantity)   || 0;
    const price = parseFloat(it.unit_price) || 0;
    const rate  = VAT_RATE_MAP[it.vat_rate_type] ?? 0;
    const net   = qty * price;
    return { net, vat: net * rate / 100, rate, qty, price };
  });

  const subtotal   = lineCalcs.reduce((s, l) => s + l.net, 0);
  const taxable    = Math.max(0, subtotal - disc);
  const totalVat   = lineCalcs.reduce((s, l) => s + l.net * l.rate / 100, 0);
  const grandTotal = taxable + totalVat;
  const hasItems   = items.some((it) => it.description || parseFloat(it.unit_price || '0') > 0);

  const fmt = (n: number) =>
    n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d: string) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const initials = companyName
    ? companyName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'CO';

  const today = fmtDate(new Date().toISOString().slice(0, 10));

  const THEME: Record<string, { header: string; accent: string; badge: string; ring: string }> = {
    blue:    { header: 'from-[#1e3a5f] to-[#1e4d8c]', accent: '#3b82f6', badge: 'bg-blue-500/20 text-blue-100',   ring: 'ring-blue-400/30' },
    amber:   { header: 'from-[#78350f] to-[#b45309]',  accent: '#f59e0b', badge: 'bg-amber-400/20 text-amber-100',  ring: 'ring-amber-400/30' },
    orange:  { header: 'from-[#7c2d12] to-[#c2410c]',  accent: '#f97316', badge: 'bg-orange-400/20 text-orange-100', ring: 'ring-orange-400/30' },
    emerald: { header: 'from-[#064e3b] to-[#065f46]',  accent: '#10b981', badge: 'bg-emerald-400/20 text-emerald-100', ring: 'ring-emerald-400/30' },
    rose:    { header: 'from-[#881337] to-[#be123c]',  accent: '#f43f5e', badge: 'bg-rose-400/20 text-rose-100',   ring: 'ring-rose-400/30' },
    violet:  { header: 'from-[#3b0764] to-[#6d28d9]',  accent: '#8b5cf6', badge: 'bg-violet-400/20 text-violet-100', ring: 'ring-violet-400/30' },
    teal:    { header: 'from-[#134e4a] to-[#0f766e]',  accent: '#14b8a6', badge: 'bg-teal-400/20 text-teal-100',   ring: 'ring-teal-400/30' },
    indigo:  { header: 'from-[#1e1b4b] to-[#3730a3]',  accent: '#6366f1', badge: 'bg-indigo-400/20 text-indigo-100', ring: 'ring-indigo-400/30' },
    purple:  { header: 'from-[#3b0764] to-[#7e22ce]',  accent: '#a855f7', badge: 'bg-purple-400/20 text-purple-100', ring: 'ring-purple-400/30' },
    slate:   { header: 'from-[#1e293b] to-[#334155]',  accent: '#94a3b8', badge: 'bg-slate-400/20 text-slate-100', ring: 'ring-slate-400/30' },
  };
  const theme = THEME.blue;

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl shadow-gray-200/40 border border-gray-200/80 text-[11px] bg-white"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${theme.header} px-4 sm:px-5 pt-4 sm:pt-5 pb-4 relative overflow-hidden`}>
        {/* Decorative */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.07] bg-white" />
        <div className="absolute top-3 -right-1 w-14 h-14 rounded-full opacity-[0.05] bg-white" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-[0.04] bg-white" />

        {/* Top row */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black text-white shrink-0 ring-2 ring-white/10"
                 style={{ background: theme.accent + '33' }}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-xs sm:text-sm leading-tight truncate max-w-[140px] sm:max-w-none">
                {companyName || 'Your Company'}
              </p>
              <p className="text-white/40 text-[9px] sm:text-[10px] mt-0.5">UAE E-Invoicing</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest shrink-0 ${theme.badge}`}>
            {card.title}
          </span>
        </div>

        {/* Invoice number + refs */}
        <div className="mt-3 relative z-10 flex items-end justify-between">
          <div>
            <p className="text-white/30 text-[8px] sm:text-[9px] uppercase tracking-[0.15em]">Invoice No.</p>
            <p className="text-white/90 font-mono font-semibold text-[11px] sm:text-xs mt-0.5">{invoiceNo}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/15">{card.boxRef}</span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/15">{card.reqRef}</span>
          </div>
        </div>
      </div>

      {/* ── Seller / Buyer ────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-3">
          {/* Seller */}
          <div className="space-y-1">
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">From</p>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
              <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate">{companyName || '—'}</p>
            </div>
            <p className="text-gray-400 text-[9px] pl-[18px]">UAE · TRN on file</p>
          </div>
          {/* Buyer */}
          <div className="space-y-1 pl-3 border-l border-gray-100">
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">To</p>
            {customerName ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
                       style={{ background: theme.accent + '15', border: `1.5px solid ${theme.accent}44` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
                  </div>
                  <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate">{customerName}</p>
                </div>
                <p className="text-gray-400 text-[9px] pl-[18px]">TRN on file</p>
              </>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200 shrink-0" />
                <p className="text-gray-300 text-[10px] italic">Select customer…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dates ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">Issue Date</p>
            <p className="font-semibold text-gray-700 text-[11px] mt-0.5">{fmtDate(issueDate) ?? today}</p>
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">Due Date</p>
            <p className="font-semibold text-gray-700 text-[11px] mt-0.5">{fmtDate(dueDate) ?? <span className="text-gray-300 font-normal">—</span>}</p>
          </div>
        </div>
      </div>

      {/* ── Line items ────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-2">
        <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Line Items</p>

        {!hasItems ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-5 sm:py-6 text-center">
            <PackageOpen className="h-6 w-6 text-gray-200 mx-auto mb-1.5" />
            <p className="text-gray-300 text-[10px]">Items will appear as you add them</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-150">
            {/* Table header — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_40px_52px_28px_60px] gap-x-1 px-3 py-1.5 text-[8px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">VAT</span>
              <span className="text-right">Amount</span>
            </div>
            {/* Rows */}
            {items.map((it, i) => {
              const name = it.item_name || it.description;
              if (!name && !parseFloat(it.unit_price || '0')) return null;
              const { net, rate } = lineCalcs[i];
              return (
                <Fragment key={i}>
                  {/* Mobile */}
                  <div className={`sm:hidden px-3 py-2 border-t border-gray-100 first:border-t-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate flex-1">{name || '—'}</p>
                      <p className="text-right font-bold text-gray-800 tabular-nums text-[11px] shrink-0">{cur} {fmt(net)}</p>
                    </div>
                    <p className="text-gray-400 text-[9px] mt-0.5">{parseFloat(it.quantity) || 0} × {fmt(parseFloat(it.unit_price) || 0)} · {rate}% VAT</p>
                  </div>
                  {/* Desktop */}
                  <div className={`hidden sm:grid grid-cols-[1fr_40px_52px_28px_60px] gap-x-1 px-3 py-1.5 items-center border-t border-gray-100 first:border-t-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate">{name || '—'}</p>
                      {it.unit && <p className="text-gray-400 text-[9px]">{it.unit}</p>}
                    </div>
                    <p className="text-right text-gray-500 tabular-nums text-[11px]">{parseFloat(it.quantity) || 0}</p>
                    <p className="text-right text-gray-500 tabular-nums text-[11px]">{fmt(parseFloat(it.unit_price) || 0)}</p>
                    <p className="text-right text-gray-400 tabular-nums text-[10px]">{rate}%</p>
                    <p className="text-right font-semibold text-gray-800 tabular-nums text-[11px]">{fmt(net)}</p>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 pt-2 pb-3 sm:pb-4">
        <div className="rounded-lg border border-gray-150 overflow-hidden">
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between items-center px-3 py-1.5">
              <span className="text-gray-400 text-[11px]">Subtotal</span>
              <span className="tabular-nums font-mono text-gray-600 text-[11px]">{cur} {fmt(subtotal)}</span>
            </div>
            {disc > 0 && (
              <>
                <div className="flex justify-between items-center px-3 py-1.5 bg-amber-50/60">
                  <span className="text-amber-600 text-[11px]">Discount</span>
                  <span className="tabular-nums font-mono text-amber-600 text-[11px]">− {cur} {fmt(disc)}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-1.5">
                  <span className="text-gray-400 text-[11px]">Taxable</span>
                  <span className="tabular-nums font-mono text-gray-600 text-[11px]">{cur} {fmt(taxable)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center px-3 py-1.5">
              <span className="text-gray-400 text-[11px]">VAT</span>
              <span className="tabular-nums font-mono text-gray-600 text-[11px]">{cur} {fmt(totalVat)}</span>
            </div>
          </div>
          {/* Grand total */}
          <div className={`flex justify-between items-center px-3 py-2.5 bg-gradient-to-r ${theme.header}`}>
            <span className="font-bold text-white text-[11px] tracking-wide">Total Due</span>
            <span className="tabular-nums font-black text-white text-xs">{cur} {fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 py-2.5 bg-gray-50/80 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[8px] sm:text-[9px] font-bold text-gray-500">FTA</span>
            </div>
            <span className="text-gray-200">·</span>
            <span className="text-[8px] sm:text-[9px] text-gray-400">BIS 3.0</span>
            <span className="text-gray-200">·</span>
            <span className="text-[8px] sm:text-[9px] text-gray-400">UBL 2.1</span>
          </div>
          <span className="text-[8px] sm:text-[9px] text-gray-300 italic">Live</span>
        </div>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router   = useRouter();
  const { activeId, activeCompany } = useCompany();
  const [selected, setSelected]       = useState<CardType | null>(null);
  const [serverError, setServerError] = useState('');
  const [serverDet, setServerDet]     = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted]     = useState(false);
  const [invoiceNo]                   = useState(generateInvoiceNumber);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('all');

  const { data: customers = [] } = useSWR<Customer[]>(
    activeId ? `/customers/?company_id=${activeId}&page_size=200` : null,
    customerFetcher,
  );

  const { data: products = [] } = useSWR<CatalogProduct[]>(
    activeId ? `/invoices/products/?company_id=${activeId}` : '/invoices/products/',
    productFetcher,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { register, control, handleSubmit, reset, watch, setValue, trigger, getValues,
    formState: { errors, isSubmitting } } = useForm<InvoiceForm>({
    defaultValues: {
      transaction_type: 'b2b', payment_means_code: '30', issue_date: today,
      currency: 'AED', exchange_rate: '1.000000', discount_amount: '0.00',
      is_reverse_charge: false, import_subtype: '',
      items: [{ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '',
                vat_rate_type: 'standard',
              }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  // ── Auto-draft (crash / power-loss proof) ─────────────────────────────────
  type DraftShape = { form: InvoiceForm; selected: CardType | null };
  const draftKey = `invoice-draft:new:${activeId ?? 'none'}`;
  const allValues = watch();
  const draftIsEmpty = useCallback(
    (d: DraftShape) =>
      !d.selected && !d.form?.customer_id && !(d.form?.items ?? []).some((it) => it?.item_name),
    [],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draftSnapshot = useMemo<DraftShape>(() => ({ form: allValues, selected }),
    [JSON.stringify(allValues), selected]);
  const [restorable,   setRestorable]   = useState<DraftEnvelope<DraftShape> | null>(null);
  const restorableRef = useRef(restorable);
  useEffect(() => { restorableRef.current = restorable; }, [restorable]);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  const serverSave = useCallback(async (snap: DraftShape) => {
    if (!activeId) return;
    await api.put('/invoices/draft-autosave/', {
      company_id: activeId, form_type: 'new', payload: snap,
    }).catch(() => {});
  }, [activeId]);

  const serverClear = useCallback(() => {
    if (!activeId) return;
    api.delete(`/invoices/draft-autosave/?company_id=${activeId}&form_type=new`).catch(() => {});
  }, [activeId]);

  useAutosaveDraft<DraftShape>({
    key: draftKey,
    data: draftSnapshot,
    enabled: !isSubmitting && !submitted && !!activeId,
    isEmpty: draftIsEmpty,
    onSaved: setDraftSavedAt,
    onServerSave: serverSave,
  });

  // Resume an unsaved draft from the server (cross-device).
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (restoreCheckedRef.current || !activeId) return;
    restoreCheckedRef.current = true;
    api.get(`/invoices/draft-autosave/?company_id=${activeId}&form_type=new`)
      .then((res) => {
        const d = res.data?.data;
        if (d?.exists && d.payload && !draftIsEmpty(d.payload)) {
          setRestorable({ data: d.payload, savedAt: Date.parse(d.updated_at) || Date.now() });
        }
      })
      .catch(() => {});
  }, [activeId, draftKey, draftIsEmpty]);

  const [restoreForm, setRestoreForm] = useState<InvoiceForm | null>(null);

  const resumeDraft = useCallback(() => {
    const envelope = restorableRef.current;
    setRestorable(null);
    if (!envelope?.data) return;
    const saved = envelope.data;
    if (saved.selected) {
      const allCards = [...DOCUMENT_TYPES, ...SALES_TYPES, ...PURCHASE_TYPES];
      const match = allCards.find(c => c.value === saved.selected!.value);
      setSelected(match ?? saved.selected);
    }
    setRestoreForm(saved.form);
  }, []);

  useEffect(() => {
    if (restoreForm && selected) {
      reset(restoreForm);
      setRestoreForm(null);
    }
  }, [restoreForm, selected, reset]);

  const discardDraft = useCallback(() => {
    serverClear();
    setRestorable(null);
  }, [serverClear]);

  // Supplier location derived from the active company's profile address.
  const supplierLoc =
    activeCompany?.formatted_address?.trim() ||
    [activeCompany?.city, activeCompany?.emirate, activeCompany?.country]
      .filter(Boolean).join(', ') || '';

  // Auto-fill supplier location from company data when form loads / company changes.
  useEffect(() => {
    if (!supplierLoc) return;
    const current = watch('supplier_location');
    if (current) return; // user already typed something — don't overwrite
    setValue('supplier_location', supplierLoc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierLoc]);

  // Watch for preview
  const watchedItems     = watch('items');
  const currency         = watch('currency');
  const discount         = watch('discount_amount');
  const issueDate        = watch('issue_date');
  const dueDate          = watch('due_date');
  const watchedCustomerId = watch('customer_id');

  const isReverse    = watch('is_reverse_charge');
  const isAED        = currency === 'AED';
  const isImport     = ['import_reverse_charge', 'import_outside_gcc', 'intra_gcc_purchase_import'].includes(selected?.value ?? '');
  const needRef      = selected?.value === 'credit_note' || selected?.value === 'debit_note';
  const vatLocked    = selected?.vatRate === 'out_of_scope';
  const accent       = selected ? (C[selected.color] ?? C.blue) : C.blue;

  const selectedCustomer = customers.find((c) => c.id === watchedCustomerId);

  const filteredCustomers = useMemo(() => {
    const q = buyerSearch.toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = !q || c.name?.toLowerCase().includes(q) || c.legal_name?.toLowerCase().includes(q)
        || c.trn?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
        || c.city?.toLowerCase().includes(q);
      const matchesType = buyerTypeFilter === 'all' || c.customer_type === buyerTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [customers, buyerSearch, buyerTypeFilter]);

  // Auto-fill customer location and transaction type when a customer is selected
  useEffect(() => {
    if (!selectedCustomer) return;
    const loc = [selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ');
    if (loc) setValue('customer_location', loc);
    if (selectedCustomer.customer_type) setValue('transaction_type', selectedCustomer.customer_type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  // ── Payment / verification QR code (shown in the "Print Code" step) ──────────
  const qrTotal = (watchedItems ?? []).reduce((sum, it) => {
    const net  = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
    const rate = VAT_RATE_MAP[it.vat_rate_type] ?? 0;
    return sum + net + net * rate / 100;
  }, 0);
  const qrText = [
    'E-NUMERAK',
    `INV:${invoiceNo}`,
    `SELLER:${activeCompany?.name ?? ''}`,
    `STRN:${activeCompany?.trn ?? ''}`,
    `BUYER:${selectedCustomer?.name ?? ''}`,
    `BTRN:${selectedCustomer?.trn ?? ''}`,
    `TOTAL:${currency || 'AED'} ${qrTotal.toFixed(2)}`,
    `DATE:${issueDate || ''}`,
  ].join('|');
  const [qrUrl, setQrUrl] = useState('');
  const [invNoCopied, setInvNoCopied] = useState(false);
  const [showQrZoom, setShowQrZoom] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(qrText, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [qrText]);

  // ── QR action handlers ────────────────────────────────────────────────────
  const handleDownloadQr = useCallback(() => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${invoiceNo || 'invoice'}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [qrUrl, invoiceNo]);

  const handleCopyInvoiceNo = useCallback(() => {
    navigator.clipboard.writeText(invoiceNo).then(() => {
      setInvNoCopied(true);
      setTimeout(() => setInvNoCopied(false), 2000);
    });
  }, [invoiceNo]);

  const handleShareQr = useCallback(async () => {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const file = new File([blob], `${invoiceNo || 'invoice'}-qr.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `QR Code — ${invoiceNo}` });
      } else {
        handleDownloadQr();
      }
    } catch {
      handleDownloadQr();
    }
  }, [qrUrl, invoiceNo, handleDownloadQr]);

  // ── Stepper completion logic ──────────────────────────────────────────────
  const hasCustomer   = !!watchedCustomerId;
  const hasIssueDate  = !!issueDate;
  const hasItems      = watchedItems.some(
    (it) => (it.description || it.item_name) && parseFloat(it.unit_price || '0') > 0
  );
  const hasCurrency   = !!currency;

  const readyToSubmit = hasCustomer && hasItems && hasCurrency && hasIssueDate;

  // ── Wizard step navigation (each step gates Next on its required fields) ─────
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 6;   // Review is the final step (it submits directly)

  const stepFields = (s: number): (keyof InvoiceForm)[] => {
    switch (s) {
      case 0: return ['supplier_location'];                     // Your Info
      case 1: return ['customer_id', 'customer_location'];     // Buyer
      case 2: return ['items'];                                 // Product Catalog — validate all line-item fields
      case 3: return [                                          // Payment & Sign
        'issue_date', 'due_date', 'exchange_rate', 'discount_amount', 'currency',
        'gl_account_id', 'permit_number', 'transaction_id', 'purchase_order_number',
        ...(needRef ? ['reference_number' as keyof InvoiceForm] : []),
      ];
      default: return [];
    }
  };

  const goNext = async () => {
    const ok = await trigger(stepFields(step), { shouldFocus: true });
    if (!ok) {
      setServerError('Please complete the required (*) fields in this step before continuing.');
      return;
    }
    if (step === 1 && selectedCustomer?.customer_type &&
        getValues('transaction_type') !== selectedCustomer.customer_type) {
      setServerError('Transaction type does not match the selected customer type. Please correct this before continuing.');
      return;
    }
    if (step === 2 && !hasItems) {
      setServerError('Add at least one line item (name, quantity and price) before continuing.');
      return;
    }
    setServerError('');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setServerError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const STEPS: StepDef[] = [
    {
      label: 'Your Info',
      sub:   'Supplier details',
      icon:  <Building2 className="h-4 w-4" />,
      done:  true,
    },
    {
      label: 'Buyer',
      sub:   'Select the customer',
      icon:  <Building2 className="h-4 w-4" />,
      done:  hasCustomer,
    },
    {
      label: 'Product Catalog',
      sub:   'Add line items',
      icon:  <Package className="h-4 w-4" />,
      done:  hasItems,
    },
    {
      label: 'Payment & Sign',
      sub:   'Currency & signature',
      icon:  <PenLine className="h-4 w-4" />,
      done:  hasCurrency,
    },
    {
      label: 'Print Code',
      sub:   'QR / verification code',
      icon:  <QrCode className="h-4 w-4" />,
      done:  readyToSubmit,
    },
    {
      label: 'Review',
      sub:   'Check details',
      icon:  <FileCheck className="h-4 w-4" />,
      done:  readyToSubmit,
    },
  ];

  function pickCard(card: CardType) {
    setSelected(card);
    reset({
      transaction_type: 'b2b', payment_means_code: '30', issue_date: today,
      currency: 'AED', exchange_rate: '1.000000', discount_amount: '0.00',
      is_reverse_charge: !!card.isReverseCharge, import_subtype: '',
      supplier_location: supplierLoc,   // keep auto-filled from company profile
      items: [{ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '',
                vat_rate_type: card.vatRate,
              }],
    });
  }

  const onSubmit = async (data: InvoiceForm) => {
    if (!selected) return;
    setServerError(''); setServerDet({});
    try {
      const fafMeta = [
        `Supply: ${selected.title} (${selected.boxRef} · ${selected.reqRef})`,
        data.import_subtype    ? `Import Type: ${data.import_subtype}`        : '',
        data.gl_account_id     ? `GL/ID: ${data.gl_account_id}`              : '',
        data.permit_number     ? `Permit: ${data.permit_number}`             : '',
        data.transaction_id    ? `Txn ID: ${data.transaction_id}`            : '',
        data.is_reverse_charge ? 'Reverse Charge: YES'                       : '',
        data.customer_location ? `Customer: ${data.customer_location}`       : '',
        data.tax_payment_date  ? `Tax Payment Date: ${data.tax_payment_date}`: '',
      ].filter(Boolean).join(' | ');

      const notes = [data.notes, fafMeta ? `[FAF] ${fafMeta}` : ''].filter(Boolean).join('\n');

      const payload: Record<string, unknown> = {
        company_id: activeId,
        customer_id: data.customer_id,
        invoice_type: selected.docType,
        transaction_type: data.transaction_type,
        payment_means_code: data.payment_means_code || '30',
        issue_date: data.issue_date,
        currency: data.currency,
        exchange_rate: data.exchange_rate || '1.000000',
        supplier_location: data.supplier_location || '',
        accounts_type: data.accounts_type || '',
        notes,
        items: data.items.map((it) => ({
          item_name: it.item_name || '',
          description: it.description,
          quantity: parseFloat(it.quantity),
          unit: it.unit || '',
          unit_price: parseFloat(it.unit_price),
          vat_rate_type: it.vat_rate_type,
        })),
      };

      if (data.due_date)              payload.due_date              = data.due_date;
      if (data.supply_date)           payload.supply_date           = data.supply_date;
      if (data.reference_number)      payload.reference_number      = data.reference_number;
      if (data.credit_note_reason_code) payload.credit_note_reason_code = data.credit_note_reason_code;
      if (data.purchase_order_number) payload.purchase_order_number = data.purchase_order_number;
      if (parseFloat(data.discount_amount || '0') > 0)
        payload.discount_amount = parseFloat(data.discount_amount);

      const res = await api.post('/invoices/', payload);
      setSubmitted(true);
      serverClear();          // invoice saved — drop the server autosave draft
      router.push(`/invoices/${res.data.data.id}`);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
      setServerError(e.response?.data?.error?.message ?? 'Failed to create invoice.');
      setServerDet(e.response?.data?.error?.details ?? {});
    }
  };

  const restoreBanner = restorable ? (
    <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-amber-800">
        You have an unsaved invoice from{' '}
        <span className="font-semibold">{new Date(restorable.savedAt).toLocaleString()}</span>. Resume where you left off?
      </p>
      <div className="flex items-center gap-2">
        <button onClick={resumeDraft}
          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold hover:from-amber-400 hover:to-amber-500 shadow-sm hover:shadow transition-all duration-200">
          Resume
        </button>
        <button onClick={discardDraft}
          className="px-4 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
          Discard
        </button>
      </div>
    </div>
  ) : null;

  const savedIndicator = draftSavedAt && !restorable ? (
    <div className="fixed bottom-4 right-4 z-40 px-3 py-1.5 rounded-full bg-gray-900/80 text-white text-xs shadow-lg">
      Draft saved · {new Date(draftSavedAt).toLocaleTimeString()}
    </div>
  ) : null;

  // ── Step 1: Select type / supply category ──────────────────────────────────
  if (!selected) {
    return (
      <div className="space-y-10">
        {restoreBanner}

        {/* Header card */}
        <AnimatedSection>
          <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Invoicing</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">New Invoice</h1>
              <p className="text-sm text-blue-200/60 mt-0.5">
                Select the invoice type — the form will show only the relevant UAE FTA fields.
              </p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <GroupHeading icon={<FileText className="h-4 w-4" />} title="Document Types"
            subtitle="UAE FTA Req 12 & 13 — Tax invoices, credit notes and debit notes" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOCUMENT_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <GroupHeading icon={<TrendingUp className="h-4 w-4" />} title="Sales / Output Supplies"
            subtitle="UAE FTA Req 1.1–1.9 — Supply categories for VAT return output tax (Boxes 1–6)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SALES_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={300}>
          <GroupHeading icon={<TrendingDown className="h-4 w-4" />} title="Purchases / Input Tax"
            subtitle="UAE FTA Req 1.10–1.14 — Purchase categories for VAT return input tax recovery (Boxes 10–14)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PURCHASE_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </AnimatedSection>
      </div>
    );
  }

  // ── Step 2: Invoice form + live preview ────────────────────────────────────
  return (
    <div className="pb-12">
      {restoreBanner}
      {savedIndicator}

      {/* Page header */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-6 relative overflow-hidden mb-5">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <button type="button" onClick={() => setSelected(null)}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium text-blue-200/70 hover:text-white
                         bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12]
                         shadow-sm hover:shadow-md transition-all duration-200 mb-4">
              <ArrowLeft className="h-3.5 w-3.5 -ml-0.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              Back to invoice types
            </button>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 shrink-0">
                  {selected.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-white tracking-tight">{selected.title}</h1>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.badge}`}>{selected.boxRef}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">{selected.reqRef}</span>
                  </div>
                  <p className="text-sm text-blue-200/60 mt-0.5">{selected.subtitle}</p>
                </div>
              </div>
              {/* Invoice quick-info card */}
              <div className="hidden sm:flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 shrink-0">
                <div className="text-right">
                  <p className="text-[9px] text-blue-200/40 uppercase tracking-widest font-medium">Invoice No.</p>
                  <p className="text-[13px] font-mono font-semibold text-white/90 mt-0.5">{invoiceNo}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-right">
                  <p className="text-[9px] text-blue-200/40 uppercase tracking-widest font-medium">Step</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[13px] font-semibold text-white/90">{step + 1}<span className="text-blue-200/40 font-normal">/6</span></p>
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Progress stepper */}
      <FormStepper steps={STEPS} current={step} onStepClick={setStep} onPrev={step === 0 ? () => router.back() : goBack} onNext={goNext} />

      {/* Two-column layout: form + preview. On the Review step we go full-width
          and show the invoice as one professional document instead. */}
      <div className={step === 5 ? '' : 'grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start'}>

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 min-w-0" noValidate>

          {/* STEP 0 — Your Info (seller) */}
          {step === 0 && (
            <AnimatedSection>
            <Section title="Your Info" icon={<Building2 className="h-4 w-4" />} subtitle="Your company (seller) details">

              <CompanyProfileCard company={activeCompany} />
              <CollapsibleBankDetails company={activeCompany} />

              <Field label="Supplier Location" required
                tooltip="Location of the supplier (your company). E.g. Dubai, UAE"
                error={errors.supplier_location?.message}>
                <input placeholder="e.g. Dubai, UAE" maxLength={120}
                  className={inputCls(errors.supplier_location?.message)}
                  {...register('supplier_location', {
                    required: 'Supplier location is required',
                    validate: (v) => limitWords(v, 'Supplier location', 50),
                    onChange: () => { setTimeout(() => trigger('supplier_location'), 0); },
                  })} />
              </Field>

              <Field label="Payment Method" required
                hint="UN/ECE UNCL 4461 — mandatory for UBL PaymentMeans element"
                error={errors.payment_means_code?.message}>
                <Controller control={control} name="payment_means_code" rules={{ required: 'Payment method is required' }}
                  render={({ field }) => (
                    <PaymentMethodCards value={field.value} onChange={field.onChange} />
                  )} />
              </Field>
            </Section>
            </AnimatedSection>
          )}

          {/* STEP 1 — Buyer */}
          {step === 1 && (
            <AnimatedSection delay={100}>
            <Section title="Buyer" icon={<Building2 className="h-4 w-4" />} subtitle="Select the customer being invoiced">
              <Controller control={control} name="customer_id" rules={{ required: 'Customer is required' }}
                render={({ field }) => {
                  if (selectedCustomer) {
                    return (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-in-scale">
                        <div className="flex items-start gap-4">
                          <div className={`h-11 w-11 rounded-xl ${getAvatarColor(selectedCustomer.name)} flex items-center justify-center shrink-0 shadow-sm`}>
                            <span className="text-white text-sm font-bold">{getInitials(selectedCustomer.name)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <UserCheck className="h-3 w-3" /> Buyer Selected
                            </p>
                            <p className="text-sm font-bold text-emerald-900 truncate">{selectedCustomer.legal_name || selectedCustomer.name}</p>
                            {selectedCustomer.legal_name && selectedCustomer.name !== selectedCustomer.legal_name && (
                              <p className="text-xs text-emerald-600 truncate">{selectedCustomer.name}</p>
                            )}
                          </div>
                          <button type="button" onClick={() => { field.onChange(''); setBuyerSearch(''); }}
                            className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 transition-all shrink-0"
                            title="Change customer">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-emerald-200/60">
                          {selectedCustomer.trn && (
                            <div>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">TRN</p>
                              <p className="text-xs font-mono font-semibold text-emerald-800">{selectedCustomer.trn}</p>
                            </div>
                          )}
                          {selectedCustomer.customer_type && (
                            <div>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Type</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase inline-block mt-0.5 ${TYPE_BADGE[selectedCustomer.customer_type] || 'bg-gray-100 text-gray-600'}`}>
                                {TYPE_LABEL[selectedCustomer.customer_type] || selectedCustomer.customer_type}
                              </span>
                            </div>
                          )}
                          {selectedCustomer.city && (
                            <div>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Location</p>
                              <p className="text-xs text-emerald-800 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{selectedCustomer.city}{selectedCustomer.country ? `, ${selectedCustomer.country}` : ''}</p>
                            </div>
                          )}
                          {selectedCustomer.phone && (
                            <div>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Phone</p>
                              <p className="text-xs text-emerald-800 flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{selectedCustomer.phone}</p>
                            </div>
                          )}
                          {selectedCustomer.email && (
                            <div className="col-span-2 sm:col-span-4">
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Email</p>
                              <p className="text-xs text-emerald-800 truncate flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{selectedCustomer.email}</p>
                            </div>
                          )}
                          {selectedCustomer.formatted_address && (
                            <div className="col-span-2 sm:col-span-4">
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Address</p>
                              <p className="text-xs text-emerald-800">{selectedCustomer.formatted_address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                          <input type="text" value={buyerSearch}
                            onChange={(e) => setBuyerSearch(e.target.value)}
                            placeholder="Search by name, TRN, email, or city..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-10 py-2.5 text-sm
                                       focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400" />
                          {buyerSearch && (
                            <button type="button" onClick={() => setBuyerSearch('')}
                              className="absolute right-3 top-2.5 p-1 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0 self-start">
                          {[{ value: 'all', label: 'All' }, { value: 'b2b', label: 'B2B' }, { value: 'b2g', label: 'B2G' }, { value: 'b2c', label: 'B2C' }].map((tf) => (
                            <button key={tf.value} type="button" onClick={() => setBuyerTypeFilter(tf.value)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all
                                ${buyerTypeFilter === tf.value
                                  ? 'bg-white text-blue-600 shadow-sm'
                                  : 'text-gray-500 hover:text-gray-700'}`}>
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(buyerSearch || buyerTypeFilter !== 'all') && filteredCustomers.length > 0 && (
                        <p className="text-[11px] text-gray-400 font-medium">
                          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[164px] overflow-y-auto pr-1">
                        {filteredCustomers.map((cu) => {
                          const isActive = field.value === cu.id;
                          return (
                            <button key={cu.id} type="button"
                              onClick={() => { field.onChange(cu.id); setBuyerSearch(''); setBuyerTypeFilter('all'); }}
                              className={`text-left rounded-xl border transition-all duration-200 group overflow-hidden
                                ${isActive
                                  ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 shadow-sm'
                                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}`}>
                              <div className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={`h-8 w-8 rounded-lg ${getAvatarColor(cu.name)} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                                    <span className="text-white text-[11px] font-bold">{getInitials(cu.name)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[13px] font-semibold truncate leading-tight ${isActive ? 'text-emerald-900' : 'text-gray-900'}`}>
                                      {cu.legal_name || cu.name}
                                    </p>
                                    {cu.legal_name && cu.name !== cu.legal_name && (
                                      <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">{cu.name}</p>
                                    )}
                                  </div>
                                  {isActive && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                                </div>
                              </div>
                              <div className={`px-3 py-2 border-t flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isActive ? 'border-emerald-200/60 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                {cu.trn && (
                                  <span className="text-[10px] font-mono text-gray-500">TRN: {cu.trn}</span>
                                )}
                                {cu.customer_type && (
                                  <span className={`text-[9px] font-bold px-1.5 py-px rounded-full uppercase ${TYPE_BADGE[cu.customer_type] || 'bg-gray-100 text-gray-600'}`}>
                                    {TYPE_LABEL[cu.customer_type] || cu.customer_type}
                                  </span>
                                )}
                                {cu.city && (
                                  <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-0.5">
                                    <MapPin className="h-2.5 w-2.5 shrink-0" />{cu.city}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        <button type="button" onClick={() => router.push('/customers/new')}
                          className="rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-1 min-h-[110px] group">
                          <div className="h-8 w-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                            <Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <span className="text-[11px] font-medium text-gray-400 group-hover:text-blue-600 transition-colors">Add Customer</span>
                        </button>
                      </div>

                      {customers.length > 0 && filteredCustomers.length === 0 && (
                        <div className="text-center py-10 bg-gray-50 rounded-xl">
                          <Search className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                          <p className="text-sm font-medium text-gray-500">No customers match</p>
                          <p className="text-xs text-gray-400 mt-1">Try a different search or filter.</p>
                          <div className="flex items-center justify-center gap-3 mt-3">
                            {buyerSearch && (
                              <button type="button" onClick={() => setBuyerSearch('')}
                                className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                                Clear search
                              </button>
                            )}
                            {buyerTypeFilter !== 'all' && (
                              <button type="button" onClick={() => setBuyerTypeFilter('all')}
                                className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                                Show all types
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {customers.length === 0 && (
                        <div className="text-center py-10 bg-gray-50 rounded-xl">
                          <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                          <p className="text-sm font-medium text-gray-500">No customers yet</p>
                          <p className="text-xs text-gray-400 mt-1">Create your first customer to get started.</p>
                          <button type="button" onClick={() => router.push('/customers/new')}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                            <Plus className="h-3.5 w-3.5" /> Add New Customer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }} />
              {errors.customer_id && (
                <p className="flex items-center gap-1 text-xs text-red-500">⚠ {errors.customer_id.message}</p>
              )}

              {/* Divider */}
              {selectedCustomer && (
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Details</span></div>
                </div>
              )}

              <Field label="Customer Location" required
                tooltip="Location of the customer. E.g. Riyadh, Saudi Arabia"
                error={errors.customer_location?.message}>
                <input placeholder="e.g. Riyadh, Saudi Arabia" maxLength={120}
                  className={inputCls(errors.customer_location?.message)}
                  {...register('customer_location', {
                    required: 'Customer location is required',
                    validate: (v) => limitWords(v, 'Customer location'),
                    onChange: () => { setTimeout(() => trigger('customer_location'), 0); },
                  })} />
              </Field>

              <Field label="Transaction Type"
                tooltip="Auto-detected from the selected customer type. You can override if needed.">
                <Controller control={control} name="transaction_type"
                  render={({ field: txField }) => {
                    const txOptions = [
                      { value: 'b2b', label: 'B2B', fullLabel: 'Business to Business', icon: Building2, desc: 'Invoice another registered business' },
                      { value: 'b2g', label: 'B2G', fullLabel: 'Business to Government', icon: Landmark, desc: 'Invoice a government entity' },
                      { value: 'b2c', label: 'B2C', fullLabel: 'Business to Consumer', icon: Users, desc: 'Invoice an individual consumer' },
                    ] as const;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {txOptions.map((opt) => {
                          const isActive = txField.value === opt.value;
                          const Icon = opt.icon;
                          return (
                            <button key={opt.value} type="button"
                              onClick={() => txField.onChange(opt.value)}
                              className={`p-3 rounded-xl border-2 text-center transition-all duration-200
                                ${isActive
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                                  : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              <div className={`h-8 w-8 rounded-lg mx-auto flex items-center justify-center mb-2 ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'} transition-colors`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <p className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>{opt.label}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight hidden sm:block">{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }} />
              </Field>

              {selectedCustomer?.customer_type &&
               watch('transaction_type') &&
               watch('transaction_type') !== selectedCustomer.customer_type && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Transaction type <strong>{watch('transaction_type')?.toUpperCase()}</strong> does not match this customer&apos;s type <strong>{selectedCustomer.customer_type.toUpperCase()}</strong>. Select the matching type to continue.</span>
                </div>
              )}
            </Section>
            </AnimatedSection>
          )}

          {/* STEP 2 — Product Catalog (supply classification + line items) */}
          {step === 2 && (
          <AnimatedSection delay={200}>
          {/* Supply Classification */}
          <Section title="Supply Classification" icon={<ShieldCheck className="h-4 w-4" />} subtitle={`UAE VAT Return ${selected.boxRef} — ${selected.reqRef}`}>
            <div className={`flex items-center gap-3 rounded-xl border-2 p-3 ${accent.border} ${accent.bg}`}>
              <span className={accent.icon}>{selected.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${accent.icon}`}>{selected.title}</p>
                <p className="text-xs text-gray-600">{selected.hint}</p>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${accent.badge}`}>VAT {selected.vatLabel}</span>
            </div>
            {isImport && (
              <Field label="Import Type" hint="FAF Req 1.11 / 1.12 — required for import transactions">
                <Controller control={control} name="import_subtype"
                  render={({ field }) => (
                    <CustomSelect value={field.value} onChange={field.onChange}
                      options={IMPORT_SUBTYPES.map((t) => ({ value: t.value, label: t.label }))} />
                  )} />
              </Field>
            )}
            <Controller control={control} name="is_reverse_charge"
              render={({ field: rcField }) => (
                <button type="button" onClick={() => rcField.onChange(!rcField.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3 w-full text-left transition-all duration-200
                    ${rcField.value
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className={`relative w-10 h-5 rounded-full shrink-0 mt-0.5 transition-colors duration-200 ${rcField.value ? 'bg-amber-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${rcField.value ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Reverse Charge Mechanism applies</p>
                    <p className="text-xs text-gray-500 mt-0.5">VAT liability transfers to the buyer — required for imports subject to reverse charge (Box 1c).</p>
                  </div>
                  {rcField.value && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">RC Active</span>}
                </button>
              )} />
          </Section>
          </AnimatedSection>
          )}

          {/* STEP 3 — Payment & Sign (dates, references, currency) */}
          {step === 3 && (
          <AnimatedSection delay={300}>
          {/* Invoice Dates */}
          <Section title="Invoice Dates" icon={<FileText className="h-4 w-4" />} subtitle="Invoice dates, transaction dates, tax payment dates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Issue Date" faf required
                tooltip="The date this invoice is issued. Required by the FTA and must not be in the future."
                error={errors.issue_date?.message}>
                <input type="date" max={today} className={inputCls(errors.issue_date?.message)}
                  {...register('issue_date', {
                    required: 'Issue date is required',
                    validate: (v) => !v || v <= today || 'Issue date cannot be in the future',
                  })} />
              </Field>
              <Field label="Due Date (optional)"
                tooltip="The date payment is due. Must be on or after the issue date."
                error={errors.due_date?.message}>
                <input type="date" className={inputCls(errors.due_date?.message)}
                  {...register('due_date', {
                    validate: (v) => !v || !issueDate || v >= issueDate || 'Due date cannot be before the issue date',
                  })} />
              </Field>
              <Field label="Date of Supply (optional)" hint="Tax point date if different from issue date">
                <input type="date" className={inputCls()} {...register('supply_date')} />
              </Field>
              <Field label="Tax Payment Date (optional)" faf hint="Date VAT/Excise was or will be paid to FTA">
                <input type="date" className={inputCls()} {...register('tax_payment_date')} />
              </Field>
            </div>
          </Section>

          {/* Document References */}
          <Section title="Document References" icon={<FileCheck className="h-4 w-4" />} subtitle="Invoice numbers, permit numbers, transaction IDs, GL/ID">
            {needRef && (
              <div className={`rounded-lg border ${accent.border} ${accent.bg} p-3 space-y-2`}>
                <p className={`text-xs font-semibold ${accent.icon}`}>
                  Original Invoice Reference — required for {selected.value === 'credit_note' ? 'Credit' : 'Debit'} Notes
                </p>
                <Field label="Original Invoice Number" faf required
                  tooltip="The number of the original tax invoice this credit/debit note adjusts. Required for credit and debit notes."
                  error={errors.reference_number?.message}>
                  <input placeholder="e.g. INV-202604-000001" className={inputCls(errors.reference_number?.message)}
                    {...register('reference_number', { required: 'Required for credit/debit notes' })} />
                </Field>
                {selected.docType === 'credit_note' && (
                  <Field label="Credit Note Reason" required
                    tooltip="Reason for issuing this credit note (BTAE-03), per UAE VAT Executive Regulation Article 61(1)."
                    error={errors.credit_note_reason_code?.message}>
                    <Controller control={control} name="credit_note_reason_code"
                      rules={{ required: 'Credit note reason is required' }}
                      render={({ field }) => (
                        <CustomSelect value={field.value} onChange={field.onChange}
                          options={[
                            { value: '', label: '— Select —' },
                            { value: 'DL8.61.1.A', label: 'Cancellation of the supply after the tax invoice was issued' },
                            { value: 'DL8.61.1.B', label: 'Essential change or alteration in the nature of the supply' },
                            { value: 'DL8.61.1.C', label: 'Change in the previously agreed consideration (e.g. discount)' },
                            { value: 'DL8.61.1.D', label: 'Full or partial return of the goods or services' },
                            { value: 'DL8.61.1.E', label: 'Taxable amount or VAT amount on the tax invoice was incorrect' },
                            { value: 'VD', label: 'Void — the entire invoice is cancelled' },
                          ]} />
                      )} />
                  </Field>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice Number" hint="System-generated reference">
                <input disabled value={invoiceNo} readOnly
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 font-mono cursor-not-allowed" />
              </Field>
              <Field label="Permit Number" faf required error={errors.permit_number?.message}
                tooltip="Regulatory permit number — required for FTA Audit File (FAF).">
                <input placeholder="e.g. UAE-PERMIT-2024-XXXX" maxLength={20}
                  className={inputCls(errors.permit_number?.message)}
                  {...register('permit_number', {
                    required: 'Permit number is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                    onChange: () => { setTimeout(() => trigger('permit_number'), 0); },
                  })} />
              </Field>
              <Field label="Transaction ID" faf required error={errors.transaction_id?.message}
                tooltip="Unique transaction reference — required for FTA Audit File (FAF).">
                <input placeholder="e.g. TXN-2024-000001" maxLength={30}
                  className={inputCls(errors.transaction_id?.message)}
                  {...register('transaction_id', {
                    required: 'Transaction ID is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                    onChange: () => { setTimeout(() => trigger('transaction_id'), 0); },
                  })} />
              </Field>
              <Field label="Purchase Order Number" required error={errors.purchase_order_number?.message}
                tooltip="Buyer purchase order reference — required for compliance.">
                <input placeholder="Buyer PO reference" maxLength={40}
                  className={inputCls(errors.purchase_order_number?.message)}
                  {...register('purchase_order_number', {
                    required: 'Purchase order number is required',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                    onChange: () => { setTimeout(() => trigger('purchase_order_number'), 0); },
                  })} />
              </Field>
              <div className="col-span-2">
                <Field label="GL / Account ID" faf required error={errors.gl_account_id?.message}
                  tooltip="General Ledger account ID — required for FTA Audit File (FAF).">
                  <input placeholder="e.g. GL-4100 or AR-001" maxLength={10}
                    className={inputCls(errors.gl_account_id?.message)}
                    {...register('gl_account_id', {
                      required: 'GL / Account ID is required for FAF',
                      pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                      onChange: () => { setTimeout(() => trigger('gl_account_id'), 0); },
                    })} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Currency & Financials */}
          <Section title="Currency & Financials" icon={<CreditCard className="h-4 w-4" />} subtitle="VAT amounts in actual currency and AED">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Currency" required
                tooltip="The currency this invoice is issued in. Non-AED invoices require an exchange rate to AED for FTA reporting."
                error={errors.currency?.message}>
                <Controller control={control} name="currency" rules={{ required: 'Currency is required' }}
                  render={({ field }) => (
                    <CustomSelect value={field.value} onChange={field.onChange}
                      options={[
                        { value: 'AED', label: 'AED — UAE Dirham' },
                        { value: 'USD', label: 'USD — US Dollar' },
                        { value: 'EUR', label: 'EUR — Euro' },
                        { value: 'GBP', label: 'GBP — British Pound' },
                        { value: 'SAR', label: 'SAR — Saudi Riyal' },
                        { value: 'QAR', label: 'QAR — Qatari Riyal' },
                      ]} />
                  )} />
              </Field>
              <Field label="Exchange Rate to AED" faf
                tooltip={isAED ? 'Always 1.0 for AED invoices.' : 'Rate used to convert all VAT amounts to AED for FTA reporting. Must be greater than 0.'}
                error={errors.exchange_rate?.message}>
                <input type="number" step="0.000001" min="0.000001" disabled={isAED}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 ${isAED ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : errors.exchange_rate ? 'border-red-400' : 'border-gray-300'}`}
                  {...register('exchange_rate', {
                    validate: (v) => {
                      if (isAED) return true;
                      const n = parseFloat(v);
                      if (isNaN(n) || n <= 0) return 'Enter a valid exchange rate greater than 0';
                      return true;
                    },
                  })} />
              </Field>
              <Field label="Invoice Discount (optional)"
                tooltip="Optional discount applied to the invoice subtotal before VAT is calculated."
                error={errors.discount_amount?.message}>
                <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls(errors.discount_amount?.message)}
                  {...register('discount_amount', {
                    validate: (v) => {
                      if (!v) return true;
                      const n = parseFloat(v);
                      if (isNaN(n) || n < 0) return 'Discount cannot be negative';
                      return true;
                    },
                  })} />
              </Field>
            </div>
            {!isAED && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Non-AED invoice: all VAT amounts must be reported in AED using the exchange rate above (UAE FTA requirement).</p>
              </div>
            )}
          </Section>
          </AnimatedSection>
          )}

          {/* STEP 2 (cont.) — Line Items */}
          {step === 2 && (
          <AnimatedSection delay={200}>
          <Section title="Line Items" icon={<Package className="h-4 w-4" />} subtitle="Description, product/service references, tax codes, debit/credit amounts, VAT amounts">

            {/* Excel toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fields.length} item{fields.length !== 1 ? 's' : ''}
              </div>
              <ExcelUploadButton
                defaultVat={vatLocked ? 'out_of_scope' : (selected?.vatRate ?? 'standard')}
                onItems={(items, mode) => {
                  if (mode === 'replace') {
                    // Remove all existing then append new
                    const count = fields.length;
                    for (let i = count - 1; i >= 0; i--) remove(i);
                    items.forEach(it => append(it));
                  } else {
                    items.forEach(it => append(it));
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              {fields.map((f, idx) => (
                <ItemRow key={f.id} idx={idx} register={register} control={control} errors={errors}
                  trigger={trigger} vatLocked={vatLocked} onRemove={() => remove(idx)} canRemove={fields.length > 1}
                  products={products} setValue={setValue} />
              ))}
            </div>

            {/* Line Items Totals */}
            {watchedItems && watchedItems.length > 0 && (() => {
              const subtotal = watchedItems.reduce((sum, it) => {
                const net = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                return sum + net;
              }, 0);
              const totalVat = watchedItems.reduce((sum, it) => {
                const net = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                const rate = VAT_RATE_MAP[it.vat_rate_type] ?? 0;
                return sum + (net * rate / 100);
              }, 0);
              const total = subtotal + totalVat;
              const hasAnyValue = subtotal > 0;
              return hasAnyValue ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Subtotal (excl. VAT)</span>
                    <span className="font-medium text-gray-900">{currency} {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">VAT Amount</span>
                    <span className="font-medium text-gray-900">{currency} {totalVat.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-base font-bold text-indigo-600">{currency} {total.toFixed(2)}</span>
                  </div>
                </div>
              ) : null;
            })()}
            <button type="button"
              onClick={() => append({ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '',
                vat_rate_type: vatLocked ? 'out_of_scope' : (selected.vatRate ?? 'standard'),
              })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         bg-indigo-600 text-white text-sm font-semibold
                         shadow-md shadow-indigo-200
                         hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-300
                         active:bg-indigo-800 active:shadow-sm
                         transition-all duration-150">
              <Plus className="h-4 w-4" />
              Add Line Item
            </button>
          </Section>
          </AnimatedSection>
          )}

          {/* STEP 5 — Review */}
          {step === 5 && (
          <AnimatedSection delay={400}>
          {/* Optional notes — compact, above the document */}
          <Section title="Notes" icon={<FileText className="h-4 w-4" />} subtitle="Optional — appended to the invoice">
            <textarea rows={2} placeholder="Optional notes…"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
              {...register('notes')} />
          </Section>

          {/* Full-width professional invoice document */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <FileCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">Review your invoice</h2>
                <p className="text-xs text-gray-400">Confirm everything is correct, then submit</p>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 via-white to-white p-4 sm:p-6 lg:p-10 flex justify-center shadow-xl shadow-gray-200/40">
              <div className="w-full max-w-lg">
                <InvoicePreview
                  card={selected}
                  companyName={activeCompany?.name ?? ''}
                  customerName={selectedCustomer?.name ?? ''}
                  issueDate={issueDate}
                  dueDate={dueDate}
                  currency={currency}
                  discount={discount}
                  items={watchedItems}
                  invoiceNo={invoiceNo}
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              Audit metadata (GL/ID, permit, transaction ID, supply category) is automatically appended on save.
            </p>
          </div>
          </AnimatedSection>
          )}

          {/* STEP 4 — Print Code */}
          {step === 4 && (
          <AnimatedSection delay={500}>
          <Section title="Print Code" icon={<QrCode className="h-4 w-4" />} subtitle="Scan-to-verify QR code — printed on the final invoice">
            {/* QR + Info card */}
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-200/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                {/* QR Code */}
                <div className="shrink-0 group">
                  <div className="rounded-2xl border-2 border-white bg-white p-4 shadow-lg shadow-gray-200/60 group-hover:shadow-xl group-hover:shadow-emerald-200/40 transition-all duration-300 relative">
                    {qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrUrl} alt="Invoice verification QR code" className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-gray-300">
                        <QrCode className="h-12 w-12" />
                      </div>
                    )}
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-2xl" />
                  </div>
                  <p className="text-center text-[11px] text-gray-400 mt-2.5 font-medium">Scan to verify</p>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <button type="button" onClick={handleDownloadQr} title="Download PNG"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm transition-all duration-150">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={handleCopyInvoiceNo} title="Copy invoice number"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm transition-all duration-150">
                      {invNoCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={handleShareQr} title="Share QR image"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition-all duration-150">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setShowQrZoom(true)} title="Zoom"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 shadow-sm transition-all duration-150">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="text-sm space-y-3 min-w-0 text-center sm:text-left">
                  {/* Status */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700">Verification code ready</span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                    This QR encodes the invoice number, seller &amp; buyer TRN, total amount and date.
                    Anyone can scan it to verify the invoice is genuine.
                  </p>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2 shadow-sm">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Invoice</p>
                      <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">{invoiceNo}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3 py-2 shadow-sm">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Total</p>
                      <p className="text-xs font-semibold text-gray-800 mt-0.5">{currency || 'AED'} {qrTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400">Review the code above, then continue.</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Zoom modal */}
          {showQrZoom && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowQrZoom(false)}>
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setShowQrZoom(false)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{invoiceNo}</p>
                  {qrUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrUrl} alt="QR code zoomed" className="w-64 h-64 rounded-xl border border-gray-200 shadow-lg" />
                  )}
                  <div className="flex items-center gap-2 mt-5">
                    <button type="button" onClick={handleDownloadQr}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button type="button" onClick={handleShareQr}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          </AnimatedSection>
          )}

          {/* STEP 6 — Submit */}
          {step === 6 && (
            <AnimatedSection delay={600}>
            <Section title="Submit" icon={<CheckCircle2 className="h-4 w-4" />} subtitle="Confirm and create the invoice">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Ready to create</p>
                  <p className="text-xs mt-0.5">Review the live preview on the right, then click “Create Invoice” to generate and submit.</p>
                </div>
              </div>
            </Section>
            </AnimatedSection>
          )}

          {/* Error */}
          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">{serverError}</p>
                {flattenServerErrors(serverDet).map((line, i) => (
                  <p key={i} className="text-xs text-red-600 mt-0.5">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Wizard navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button type="button" onClick={step === 0 ? () => router.back() : goBack}
              className="px-3 sm:px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200">
              {step === 0 ? 'Cancel' : step === 5 ? '← Edit' : '← Back'}
            </button>
            {step < 5 ? (
              <button type="button" onClick={goNext}
                className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200">
                Next →
              </button>
            ) : (
              <Button type="submit" disabled={isSubmitting || submitted}
                className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50">
                {isSubmitting || submitted
                  ? <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</span>
                  : <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Submit &amp; Create Invoice</span>
                }
              </Button>
            )}
          </div>
        </form>

        {/* ── RIGHT: Live preview — hidden on the Review step (shown full-width there). ── */}
        {step !== 5 && (
        <div className="hidden lg:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-4 shadow-2xl shadow-blue-950/20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative">
          <div className="absolute inset-0 bg-grid opacity-[0.03] pointer-events-none rounded-2xl" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/10 border border-white/10">
                  <FileText className="h-3.5 w-3.5 text-blue-200/70" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-bold text-blue-100/80 uppercase tracking-widest">Invoice Preview</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[9px] sm:text-[10px] text-blue-200/40 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">Live</span>
              </div>
            </div>
            <InvoicePreview
              card={selected}
              companyName={activeCompany?.name ?? ''}
              customerName={selectedCustomer?.name ?? ''}
              issueDate={issueDate}
              dueDate={dueDate}
              currency={currency}
              discount={discount}
              items={watchedItems}
              invoiceNo={invoiceNo}
            />
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
