'use client';

import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
  CheckCircle2, ArrowLeft, AlertTriangle,
  TrendingUp, TrendingDown, Globe, ShieldCheck,
  PackageOpen, BarChart2, FileCheck, FileX,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Minus,
  Building2, Package, CreditCard,
  Upload, Download, FileSpreadsheet, X,
  QrCode, PenLine,
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
  tax_code: string;
  debit_amount: string;
  credit_amount: string;
}

interface InvoiceForm {
  customer_id: string;
  transaction_type: string;
  payment_means_code: string;
  accounts_type: string;
  supplier_location: string;
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
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-gray-700">
          {label}
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
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-950 to-indigo-950 flex items-start gap-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        {icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 shrink-0 relative z-10">
            {icon}
          </div>
        )}
        <div className="min-w-0 relative z-10">
          <p className="font-bold text-white text-sm tracking-tight">{title}</p>
          {subtitle && <p className="text-xs text-blue-200/60 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">{children}</div>
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
  { key: 'tax_code',           header: 'Tax Code (S/Z/E/O)'     },
];

const EXCEL_SAMPLE_ROWS = [
  ['IT Consulting Services', 'Monthly IT support and consulting', 'SVC-001', '1', 'hr',  '1000.00', 'standard', 'S'],
  ['Office Chair',           'Ergonomic high-back office chair',  'SKU-002', '5', 'pcs', '500.00',  'standard', 'S'],
  ['Software License',       'Annual SaaS subscription fee',      'LIC-003', '1', 'yr',  '2500.00', 'standard', 'S'],
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
  vat_rate_type: string; tax_code: string;
  debit_amount: string; credit_amount: string;
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
            unit_price:        parseFloat(price).toFixed(2),
            vat_rate_type:     validVat.includes(vat) ? vat : 'standard',
            tax_code:          get('tax_code'),
            debit_amount:      '',
            credit_amount:     '',
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
        Download Template
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

function ItemRow({ idx, register, control, errors, vatLocked, onRemove, canRemove, products, setValue }: {
  idx: number;
  register: ReturnType<typeof useForm<InvoiceForm>>['register'];
  control: ReturnType<typeof useForm<InvoiceForm>>['control'];
  errors: ReturnType<typeof useForm<InvoiceForm>>['formState']['errors'];
  vatLocked: boolean; onRemove: () => void; canRemove: boolean;
  products: CatalogProduct[];
  setValue: ReturnType<typeof useForm<InvoiceForm>>['setValue'];
}) {
  function applyProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setValue(`items.${idx}.item_name`, p.name, { shouldValidate: true });
    setValue(`items.${idx}.description`, p.description || p.name, { shouldValidate: true });
    setValue(`items.${idx}.unit_price`, p.unit_price, { shouldValidate: true });
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
          })}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Quantity" required
          tooltip="Number of units supplied. Must be greater than 0."
          error={errors.items?.[idx]?.quantity?.message}>
          <input type="number" step="0.0001" min="0.0001" className={inputCls(errors.items?.[idx]?.quantity?.message)}
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
        <Field label="Unit Price (excl. VAT)" required
          tooltip="Price per unit excluding VAT. Cannot be negative."
          error={errors.items?.[idx]?.unit_price?.message}>
          <input type="number" step="0.0001" min="0" placeholder="0.00"
            className={inputCls(errors.items?.[idx]?.unit_price?.message)}
            {...register(`items.${idx}.unit_price`, {
              required: 'Required',
              validate: (v) => (parseFloat(v) >= 0) || 'Cannot be negative',
            })} />
        </Field>
        <Field label="Tax Code" faf hint="S=5%, Z=0%, E=Exempt, O=OOS">
          <Controller control={control} name={`items.${idx}.tax_code`}
            render={({ field }) => (
              <CustomSelect value={field.value} onChange={field.onChange}
                options={[
                  { value: '', label: '— Select —' },
                  { value: 'S', label: 'S — Standard 5%' },
                  { value: 'Z', label: 'Z — Zero Rate 0%' },
                  { value: 'E', label: 'E — Exempt' },
                  { value: 'O', label: 'O — Out of Scope' },
                ]} />
            )} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <Field label="Debit Amount (AED)" faf required
          tooltip="FAF ledger debit amount in AED for this line.">
          <input type="number" step="0.01" min="0" placeholder="0.00"
            className={inputCls(errors.items?.[idx]?.debit_amount?.message)}
            {...register(`items.${idx}.debit_amount`, {
              required: 'Required',
              min: { value: 0, message: 'Cannot be negative' },
            })} />
        </Field>
        <Field label="Credit Amount (AED)" faf required
          tooltip="FAF ledger credit amount in AED for this line.">
          <input type="number" step="0.01" min="0" placeholder="0.00"
            className={inputCls(errors.items?.[idx]?.credit_amount?.message)}
            {...register(`items.${idx}.credit_amount`, {
              required: 'Required',
              min: { value: 0, message: 'Cannot be negative' },
            })} />
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

function FormStepper({ steps, current }: { steps: StepDef[]; current?: number }) {
  const activeIdx = current != null ? current : steps.findIndex((s) => !s.done);
  const allDone   = activeIdx === -1;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 px-3 sm:px-5 py-3 sm:py-4 mb-5">
      {/* Progress bar track */}
      <div className="relative mb-4">
        {/* Background track */}
        <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-gray-100 mx-6" />
        {/* Filled track */}
        <div
          className="absolute top-[18px] left-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 mx-6 transition-all duration-500"
          style={{
            width: allDone
              ? 'calc(100% - 3rem)'
              : activeIdx === 0
              ? '0%'
              : `calc(${((activeIdx) / (steps.length - 1)) * 100}% - ${(activeIdx / (steps.length - 1)) * 3}rem)`,
          }}
        />
        {/* Step dots */}
        <div className="relative flex justify-between">
          {steps.map((step, i) => {
            const isDone    = current != null ? i < current : step.done;
            const isActive  = current != null ? i === current : (!allDone && i === activeIdx);
            const isUpcoming = !isDone && !isActive;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 min-w-0">
                {/* Circle */}
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center z-10 transition-all duration-300 shrink-0
                  ${isDone    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200' : ''}
                  ${isActive  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-indigo-200 ring-4 ring-indigo-100' : ''}
                  ${isUpcoming? 'bg-gray-100 border-2 border-gray-200' : ''}
                `}>
                  {isDone ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-xs font-black ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                  )}
                </div>
                {/* Label */}
                <div className="text-center max-w-[72px]">
                  <p className={`text-[10px] font-bold leading-tight truncate
                    ${isDone ? 'text-emerald-600' : isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  <p className="text-[9px] text-gray-400 leading-tight mt-0.5 truncate hidden sm:block">
                    {step.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step message */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs
        ${allDone
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : 'bg-indigo-50 border border-indigo-100 text-indigo-700'}`}>
        {allDone ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">All sections complete — ready to create invoice</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <span>
              <span className="font-semibold">Step {activeIdx + 1}:</span>{' '}
              {steps[activeIdx]?.label} — {steps[activeIdx]?.sub}
            </span>
          </>
        )}
      </div>
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

  /* colour theme per invoice type */
  const THEME: Record<string, { header: string; accent: string; badge: string; dot: string }> = {
    blue:    { header: 'from-[#1e3a5f] to-[#1e4d8c]', accent: '#3b82f6', badge: 'bg-blue-500/20 text-blue-200',   dot: 'bg-blue-400'    },
    amber:   { header: 'from-[#78350f] to-[#b45309]',  accent: '#f59e0b', badge: 'bg-amber-400/20 text-amber-200', dot: 'bg-amber-400'   },
    orange:  { header: 'from-[#7c2d12] to-[#c2410c]',  accent: '#f97316', badge: 'bg-orange-400/20 text-orange-200', dot: 'bg-orange-400' },
    emerald: { header: 'from-[#064e3b] to-[#065f46]',  accent: '#10b981', badge: 'bg-emerald-400/20 text-emerald-200', dot: 'bg-emerald-400' },
    rose:    { header: 'from-[#881337] to-[#be123c]',  accent: '#f43f5e', badge: 'bg-rose-400/20 text-rose-200',   dot: 'bg-rose-400'    },
    violet:  { header: 'from-[#3b0764] to-[#6d28d9]',  accent: '#8b5cf6', badge: 'bg-violet-400/20 text-violet-200', dot: 'bg-violet-400' },
    teal:    { header: 'from-[#134e4a] to-[#0f766e]',  accent: '#14b8a6', badge: 'bg-teal-400/20 text-teal-200',   dot: 'bg-teal-400'    },
    indigo:  { header: 'from-[#1e1b4b] to-[#3730a3]',  accent: '#6366f1', badge: 'bg-indigo-400/20 text-indigo-200', dot: 'bg-indigo-400' },
    purple:  { header: 'from-[#3b0764] to-[#7e22ce]',  accent: '#a855f7', badge: 'bg-purple-400/20 text-purple-200', dot: 'bg-purple-400' },
    slate:   { header: 'from-[#1e293b] to-[#334155]',  accent: '#94a3b8', badge: 'bg-slate-400/20 text-slate-200', dot: 'bg-slate-400'   },
  };
  const theme = THEME[card.color] ?? THEME.blue;

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/60 text-[11px] bg-white"
         style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Dark gradient header ─────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${theme.header} px-5 pt-5 pb-4 relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 bg-white" />
        <div className="absolute top-2 -right-2 w-12 h-12 rounded-full opacity-10 bg-white" />

        {/* Top row: logo + doc type */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          {/* Company avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                 style={{ background: theme.accent + '33', border: `2px solid ${theme.accent}66` }}>
              {initials}
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">
                {companyName || 'Your Company'}
              </p>
              <p className="text-white/50 text-[10px] mt-0.5">UAE E-Invoicing Platform</p>
            </div>
          </div>

          {/* Invoice type badge */}
          <div className="text-right shrink-0">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${theme.badge}`}>
              {card.title}
            </span>
          </div>
        </div>

        {/* Invoice number row */}
        <div className="mt-4 relative z-10 flex items-end justify-between">
          <div>
            <p className="text-white/40 text-[9px] uppercase tracking-widest">Invoice Number</p>
            <p className="text-white/90 font-mono font-semibold text-xs mt-0.5">
              {invoiceNo}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/70 border border-white/20">
              {card.boxRef}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/70 border border-white/20">
              {card.reqRef}
            </span>
          </div>
        </div>
      </div>

      {/* ── Seller / Buyer ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 px-5 py-4 border-b border-gray-100 gap-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">From — Seller</p>
          <div className="flex items-center gap-2">
            <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
            <p className="font-semibold text-gray-800 leading-tight">{companyName || '—'}</p>
          </div>
          <p className="text-gray-400 pl-5">UAE · TRN on file</p>
        </div>
        <div className="space-y-0.5 pl-3 border-l border-gray-100">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">To — Buyer</p>
          {customerName ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
                     style={{ background: theme.accent + '22', border: `1px solid ${theme.accent}55` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
                </div>
                <p className="font-semibold text-gray-800 leading-tight">{customerName}</p>
              </div>
              <p className="text-gray-400 pl-5">TRN on file</p>
            </>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded-full bg-gray-100 shrink-0" />
              <p className="text-gray-300 italic">Select customer…</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Dates ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60 gap-3">
        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Issue Date</p>
          <p className="font-semibold text-gray-700 mt-1">{fmtDate(issueDate) ?? today}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Due Date</p>
          <p className="font-semibold text-gray-700 mt-1">{fmtDate(dueDate) ?? <span className="text-gray-300">—</span>}</p>
        </div>
      </div>

      {/* ── Line items table ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Line Items</p>

        {!hasItems ? (
          <div className="rounded-xl border-2 border-dashed border-gray-100 py-6 text-center">
            <p className="text-gray-300 text-[11px]">Items will appear here as you fill them in</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-gray-100">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_32px_52px_24px_56px] gap-x-1 px-3 py-2 text-[9px] font-black text-gray-400 uppercase tracking-wide bg-gray-50">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">%</span>
              <span className="text-right">Total</span>
            </div>
            {/* Rows */}
            {items.map((it, i) => {
              const name = it.item_name || it.description;
              if (!name && !parseFloat(it.unit_price || '0')) return null;
              const { net, vat, rate } = lineCalcs[i];
              return (
                <Fragment key={i}>
                  {/* Mobile row */}
                  <div className={`sm:hidden flex items-center justify-between gap-2 px-3 py-2
                    ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                    border-t border-gray-100 first:border-t-0`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate leading-tight">{name || '—'}</p>
                      <p className="text-gray-400 text-[9px]">{parseFloat(it.quantity) || 0} × {fmt(parseFloat(it.unit_price) || 0)}</p>
                    </div>
                    <p className="text-right font-semibold text-gray-800 tabular-nums text-xs shrink-0">{fmt(net + vat)}</p>
                  </div>
                  {/* Desktop row */}
                  <div className={`hidden sm:grid grid-cols-[1fr_32px_52px_24px_56px] gap-x-1 px-3 py-2 items-center
                    ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                    border-t border-gray-100 first:border-t-0`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate leading-tight">{name || '—'}</p>
                      {it.unit && <p className="text-gray-400 text-[9px]">{it.unit}</p>}
                    </div>
                    <p className="text-right text-gray-600 tabular-nums">{parseFloat(it.quantity) || 0}</p>
                    <p className="text-right text-gray-600 tabular-nums">{fmt(parseFloat(it.unit_price) || 0)}</p>
                    <p className="text-right text-gray-400 tabular-nums">{rate}%</p>
                    <p className="text-right font-semibold text-gray-800 tabular-nums">{fmt(net + vat)}</p>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Totals ──────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-4">
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-50/60">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums font-mono text-gray-700">{cur} {fmt(subtotal)}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between items-center px-4 py-2 bg-amber-50">
                <span className="text-amber-700">Discount</span>
                <span className="tabular-nums font-mono text-amber-700">− {cur} {fmt(disc)}</span>
              </div>
            )}
            {disc > 0 && (
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50/60">
                <span className="text-gray-500">Taxable Amount</span>
                <span className="tabular-nums font-mono text-gray-700">{cur} {fmt(taxable)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-2 bg-gray-50/60">
              <span className="text-gray-500">VAT</span>
              <span className="tabular-nums font-mono text-gray-700">{cur} {fmt(totalVat)}</span>
            </div>
          </div>
          {/* Grand total highlight */}
          <div className={`flex justify-between items-center px-4 py-3 bg-gradient-to-r ${theme.header}`}>
            <span className="font-bold text-white text-xs tracking-wide">TOTAL DUE</span>
            <span className="tabular-nums font-black text-white text-sm">{cur} {fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-bold text-gray-500">FTA Certified</span>
            </div>
            <span className="text-gray-300">·</span>
            <span className="text-[9px] text-gray-400">BIS 3.0</span>
            <span className="text-gray-300">·</span>
            <span className="text-[9px] text-gray-400">UBL 2.1</span>
          </div>
          <span className="text-[9px] text-gray-300 italic">Live Preview</span>
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

  const { data: customers = [] } = useSWR<Customer[]>(
    activeId ? `/customers/?company_id=${activeId}&page_size=200` : null,
    customerFetcher,
  );

  const { data: products = [] } = useSWR<CatalogProduct[]>(
    activeId ? `/invoices/products/?company_id=${activeId}` : '/invoices/products/',
    productFetcher,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { register, control, handleSubmit, reset, watch, setValue, trigger,
    formState: { errors, isSubmitting } } = useForm<InvoiceForm>({
    defaultValues: {
      transaction_type: 'b2b', payment_means_code: '30', issue_date: today,
      currency: 'AED', exchange_rate: '1.000000', discount_amount: '0.00',
      is_reverse_charge: false, accounts_type: '', import_subtype: '',
      items: [{ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: 'standard', tax_code: '',
                debit_amount: '', credit_amount: '' }],
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

  // Auto-fill customer location when a customer is selected
  useEffect(() => {
    if (!selectedCustomer) return;
    const loc = [selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ');
    if (loc) setValue('customer_location', loc);
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
  useEffect(() => {
    QRCode.toDataURL(qrText, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [qrText]);

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
      case 0: return ['supplier_location', 'accounts_type'];   // Your Info
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
      is_reverse_charge: !!card.isReverseCharge, accounts_type: '', import_subtype: '',
      supplier_location: supplierLoc,   // keep auto-filled from company profile
      items: [{ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: card.vatRate, tax_code: '',
                debit_amount: '', credit_amount: '' }],
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
        data.accounts_type     ? `Ledger: ${data.accounts_type}`             : '',
        data.supplier_location ? `Supplier: ${data.supplier_location}`       : '',
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
              className="flex items-center gap-1.5 text-sm text-blue-200/70 hover:text-white mb-3 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to invoice types
            </button>
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
          </div>
        </div>
      </AnimatedSection>

      {/* Progress stepper */}
      <FormStepper steps={STEPS} current={step} />

      {/* Two-column layout: form + preview. On the Review step we go full-width
          and show the invoice as one professional document instead. */}
      <div className={step === 5 ? '' : 'grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start'}>

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0" noValidate>

          {/* STEP 0 — Your Info (seller) */}
          {step === 0 && (
            <AnimatedSection>
            <Section title="Your Info" icon={<Building2 className="h-4 w-4" />} subtitle="Your company (seller) details">
              <div className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
                  {(activeCompany?.name ?? 'CO').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{activeCompany?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">TRN: {activeCompany?.trn || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Supplier Location" required
                  tooltip="Location of the supplier (your company). E.g. Dubai, UAE"
                  error={errors.supplier_location?.message}>
                  <input placeholder="e.g. Dubai, UAE" maxLength={120}
                    className={inputCls(errors.supplier_location?.message)}
                    {...register('supplier_location', {
                      required: 'Supplier location is required',
                      validate: (v) => limitWords(v, 'Supplier location'),
                    })} />
                </Field>
                <Field label="Accounts Receivable / Payable" required
                  error={errors.accounts_type?.message}>
                  <Controller control={control} name="accounts_type" rules={{ required: 'Required for audit file' }}
                    render={({ field }) => (
                      <CustomSelect value={field.value} onChange={field.onChange}
                        options={[
                          { value: '', label: '— Select —' },
                          { value: 'receivable', label: 'Accounts Receivable (AR)' },
                          { value: 'payable', label: 'Accounts Payable (AP)' },
                        ]} />
                    )} />
                </Field>
                <Field label="Transaction Type">
                  <Controller control={control} name="transaction_type"
                    render={({ field }) => (
                      <CustomSelect value={field.value} onChange={field.onChange}
                        options={[
                          { value: 'b2b', label: 'B2B — Business to Business' },
                          { value: 'b2g', label: 'B2G — Business to Government' },
                        ]} />
                    )} />
                </Field>
                <Field label="Payment Method" required
                  hint="UN/ECE UNCL 4461 — mandatory for UBL PaymentMeans element"
                  error={errors.payment_means_code?.message}>
                  <Controller control={control} name="payment_means_code" rules={{ required: 'Payment method is required' }}
                    render={({ field }) => (
                      <CustomSelect value={field.value} onChange={field.onChange}
                        options={[
                          { value: '30', label: '30 — Credit Transfer' },
                          { value: '10', label: '10 — Cash' },
                          { value: '20', label: '20 — Cheque' },
                          { value: '48', label: '48 — Bank Card' },
                          { value: '49', label: '49 — Direct Debit' },
                          { value: '57', label: '57 — Standing Order' },
                          { value: '58', label: '58 — SEPA Credit Transfer' },
                        ]} />
                    )} />
                </Field>
              </div>
            </Section>
            </AnimatedSection>
          )}

          {/* STEP 1 — Buyer */}
          {step === 1 && (
            <AnimatedSection delay={100}>
            <Section title="Buyer" icon={<Building2 className="h-4 w-4" />} subtitle="Select the customer being invoiced">
              <Field label="Customer (Buyer)" required
                tooltip="The business or person being invoiced. For B2B/B2G the customer must have a valid 15-digit TRN. Pick '+ Add new customer' to create one."
                error={errors.customer_id?.message}>
                <Controller control={control} name="customer_id" rules={{ required: 'Customer is required' }}
                  render={({ field }) => (
                    <CustomSelect value={field.value}
                      onChange={(val) => {
                        if (val === '__add_customer__') {
                          router.push('/customers/new');
                        } else {
                          field.onChange(val);
                        }
                      }}
                      options={[
                        { value: '', label: 'Select a customer…' },
                        ...customers.map((cu) => ({
                          value: cu.id,
                          label: `${cu.name}${cu.trn ? ` — TRN: ${cu.trn}` : ''}${cu.city ? ` (${cu.city})` : ''}`,
                        })),
                        { value: '__add_customer__', label: '+ Add new customer' },
                      ]} />
                  )} />
              </Field>
              <Field label="Customer Location" required
                tooltip="Location of the customer. E.g. Riyadh, Saudi Arabia"
                error={errors.customer_location?.message}>
                <input placeholder="e.g. Riyadh, Saudi Arabia" maxLength={120}
                  className={inputCls(errors.customer_location?.message)}
                  {...register('customer_location', {
                    required: 'Customer location is required',
                    validate: (v) => limitWords(v, 'Customer location'),
                  })} />
              </Field>
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
            <label className="flex items-start gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 cursor-pointer hover:border-gray-300 transition-colors">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/30" {...register('is_reverse_charge')} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Reverse Charge Mechanism applies</p>
                <p className="text-xs text-gray-500 mt-0.5">VAT liability transfers to the buyer — required for imports subject to reverse charge (Box 1c).</p>
              </div>
              {isReverse && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">RC Active</span>}
            </label>
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
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice Number" hint="System-generated reference">
                <input disabled value={invoiceNo} readOnly
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 font-mono cursor-not-allowed" />
              </Field>
              <Field label="Permit Number" faf required error={errors.permit_number?.message}
                tooltip="Regulatory permit number — required for FTA Audit File (FAF).">
                <input placeholder="e.g. UAE-PERMIT-2024-XXXX" maxLength={40}
                  className={inputCls(errors.permit_number?.message)}
                  {...register('permit_number', {
                    required: 'Permit number is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                  })} />
              </Field>
              <Field label="Transaction ID" faf required error={errors.transaction_id?.message}
                tooltip="Unique transaction reference — required for FTA Audit File (FAF).">
                <input placeholder="e.g. TXN-2024-000001" maxLength={40}
                  className={inputCls(errors.transaction_id?.message)}
                  {...register('transaction_id', {
                    required: 'Transaction ID is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                  })} />
              </Field>
              <Field label="Purchase Order Number" required error={errors.purchase_order_number?.message}
                tooltip="Buyer purchase order reference — required for compliance.">
                <input placeholder="Buyer PO reference" maxLength={40}
                  className={inputCls(errors.purchase_order_number?.message)}
                  {...register('purchase_order_number', {
                    required: 'Purchase order number is required',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                  })} />
              </Field>
              <div className="col-span-2">
                <Field label="GL / Account ID" faf required error={errors.gl_account_id?.message}
                  tooltip="General Ledger account ID — required for FTA Audit File (FAF).">
                  <input placeholder="e.g. GL-4100 or AR-001" maxLength={40}
                    className={inputCls(errors.gl_account_id?.message)}
                    {...register('gl_account_id', {
                      required: 'GL / Account ID is required for FAF',
                      pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
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
                  vatLocked={vatLocked} onRemove={() => remove(idx)} canRemove={fields.length > 1}
                  products={products} setValue={setValue} />
              ))}
            </div>
            <button type="button"
              onClick={() => append({ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: vatLocked ? 'out_of_scope' : (selected.vatRate ?? 'standard'),
                tax_code: '', debit_amount: '', credit_amount: '' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300
                         text-sm font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 w-full justify-center transition-all duration-200">
              <Plus className="h-4 w-4" /> Add Line Item
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
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                <FileCheck className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Review your invoice</h2>
              <span className="text-xs text-gray-400">— confirm everything is correct, then submit</span>
            </div>
            <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-b from-gray-50 via-white to-white p-3 sm:p-5 lg:p-8 xl:p-12 flex justify-center shadow-lg shadow-gray-200/50">
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
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="shrink-0 rounded-xl border-2 border-gray-200 bg-white p-3 shadow-lg shadow-gray-200/50">
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrUrl} alt="Invoice verification QR code" className="w-36 h-36" />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-gray-300">
                    <QrCode className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600 space-y-1.5 min-w-0">
                <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Verification code ready
                </p>
                <p className="text-xs leading-relaxed">
                  This QR encodes the invoice number, seller &amp; buyer TRN, total amount and date.
                  Anyone can scan it to verify the invoice is genuine.
                </p>
                <div className="text-xs text-gray-500 grid grid-cols-1 gap-0.5 pt-1">
                  <span><span className="text-gray-400">Invoice:</span> <span className="font-medium text-gray-700">{invoiceNo}</span></span>
                  <span><span className="text-gray-400">Total:</span> <span className="font-medium text-gray-700">{currency || 'AED'} {qrTotal.toFixed(2)}</span></span>
                </div>
                <p className="text-[11px] text-gray-400 pt-1">Review the code above, then continue.</p>
              </div>
            </div>
          </Section>
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
        <div className="hidden lg:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950 to-indigo-950 p-4 shadow-xl shadow-blue-950/30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="absolute inset-0 bg-grid opacity-[0.03] pointer-events-none rounded-2xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-blue-200/70 uppercase tracking-widest">Invoice Preview</p>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <span className="text-[10px] text-blue-200/40 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">Updates live</span>
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
