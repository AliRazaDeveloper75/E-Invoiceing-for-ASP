'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import {
  Trash2, Plus, FileText, RotateCcw, RefreshCw,
  CheckCircle2, ArrowLeft, AlertTriangle,
  TrendingUp, TrendingDown, Globe, ShieldCheck,
  PackageOpen, BarChart2, FileCheck, FileX,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Minus,
  Building2, Package, CreditCard,
  Upload, Download, FileSpreadsheet, X,
} from 'lucide-react';
import { AxiosError } from 'axios';
import type { Customer } from '@/types';
import * as XLSX from 'xlsx';

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
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 text-gray-600 shrink-0">
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

function Field({ label, faf, hint, error, children }: {
  label: string; faf?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {faf && (
          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 leading-none">
            FAF
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-400' : 'border-gray-300'}`;

const selectCls = 'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

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
        EXCEL_COLS.forEach(({ key, header: label }) => {
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Download Template
      </button>

      {/* Upload */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'parsing'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {status === 'parsing'
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <Upload className="h-3.5 w-3.5" />}
        {status === 'parsing' ? 'Reading…' : 'Upload Excel / CSV'}
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

// ─── Line item row ────────────────────────────────────────────────────────────

function ItemRow({ idx, register, errors, vatLocked, onRemove, canRemove }: {
  idx: number;
  register: ReturnType<typeof useForm<InvoiceForm>>['register'];
  errors: ReturnType<typeof useForm<InvoiceForm>>['formState']['errors'];
  vatLocked: boolean; onRemove: () => void; canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item #{idx + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Item / Service Name" faf hint="Short name for this product or service">
          <input placeholder="e.g. IT Consulting, Office Chair…" className={inputCls()} {...register(`items.${idx}.item_name`)} />
        </Field>
        <Field label="Product / Service Reference" faf>
          <input placeholder="e.g. SKU-001 or SVC-REF" className={inputCls()} {...register(`items.${idx}.product_reference`)} />
        </Field>
      </div>

      <Field label="Description of Goods / Services" faf error={errors.items?.[idx]?.description?.message}>
        <input
          placeholder="Full description of goods or services supplied…"
          className={inputCls(errors.items?.[idx]?.description?.message)}
          {...register(`items.${idx}.description`, { required: 'Required' })}
        />
      </Field>

      <div className="grid grid-cols-4 gap-3">
        <Field label="Quantity" error={errors.items?.[idx]?.quantity?.message}>
          <input type="number" step="0.0001" min="0.0001" className={inputCls(errors.items?.[idx]?.quantity?.message)}
            {...register(`items.${idx}.quantity`, { required: 'Required' })} />
        </Field>
        <Field label="Unit">
          <input placeholder="pcs / hr / kg" className={inputCls()} {...register(`items.${idx}.unit`)} />
        </Field>
        <Field label="Unit Price (excl. VAT)" error={errors.items?.[idx]?.unit_price?.message}>
          <input type="number" step="0.0001" min="0" placeholder="0.00"
            className={inputCls(errors.items?.[idx]?.unit_price?.message)}
            {...register(`items.${idx}.unit_price`, { required: 'Required' })} />
        </Field>
        <Field label="Tax Code" faf hint="S=5%, Z=0%, E=Exempt, O=OOS">
          <input placeholder="S / Z / E / O" className={inputCls()} {...register(`items.${idx}.tax_code`)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="VAT Rate">
          {vatLocked ? (
            <>
              <input type="hidden" value="out_of_scope" {...register(`items.${idx}.vat_rate_type`)} />
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 font-medium h-9 flex items-center">
                Out of Scope (O) — auto
              </div>
            </>
          ) : (
            <select className={selectCls} {...register(`items.${idx}.vat_rate_type`)}>
              <option value="standard">Standard 5% (S)</option>
              <option value="zero">Zero Rate 0% (Z)</option>
              <option value="exempt">Exempt (E)</option>
              <option value="out_of_scope">Out of Scope (O)</option>
            </select>
          )}
        </Field>
        <Field label="Debit Amount (AED)" faf>
          <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls()} {...register(`items.${idx}.debit_amount`)} />
        </Field>
        <Field label="Credit Amount (AED)" faf>
          <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls()} {...register(`items.${idx}.credit_amount`)} />
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

function FormStepper({ steps }: { steps: StepDef[] }) {
  const activeIdx = steps.findIndex((s) => !s.done);
  const allDone   = activeIdx === -1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
      {/* Progress bar track */}
      <div className="relative mb-4">
        {/* Background track */}
        <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-gray-100 mx-6" />
        {/* Filled track */}
        <div
          className="absolute top-[18px] left-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 mx-6 transition-all duration-500"
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
            const isDone    = step.done;
            const isActive  = !allDone && i === activeIdx;
            const isUpcoming = !isDone && !isActive;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 min-w-0">
                {/* Circle */}
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center z-10 transition-all duration-300 shrink-0
                  ${isDone    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-200' : ''}
                  ${isActive  ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-200 ring-4 ring-blue-100' : ''}
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
                    ${isDone ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-gray-400'}`}>
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
          : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
        {allDone ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">All sections complete — ready to create invoice</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
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
}

function InvoicePreview({ card, companyName, customerName, issueDate, dueDate, currency, discount, items }: PreviewProps) {
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
            <p className="text-white/80 font-mono font-semibold text-xs mt-0.5">
              DRAFT — Auto-generated
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
            <div className="grid grid-cols-[1fr_32px_52px_24px_56px] gap-x-1 px-3 py-2 text-[9px] font-black text-gray-400 uppercase tracking-wide bg-gray-50">
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
                <div key={i}
                  className={`grid grid-cols-[1fr_32px_52px_24px_56px] gap-x-1 px-3 py-2 items-center
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
            <span className="text-[9px] text-gray-400">PEPPOL BIS 3.0</span>
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

  const { data: customers = [] } = useSWR<Customer[]>(
    activeId ? `/customers/?company_id=${activeId}&page_size=200` : null,
    customerFetcher,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { register, control, handleSubmit, reset, watch,
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

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

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

  // ── Stepper completion logic ──────────────────────────────────────────────
  const hasCustomer   = !!watchedCustomerId;
  const hasIssueDate  = !!issueDate;
  const hasItems      = watchedItems.some(
    (it) => (it.description || it.item_name) && parseFloat(it.unit_price || '0') > 0
  );
  const hasCurrency   = !!currency;

  const STEPS: StepDef[] = [
    {
      label: 'Type',
      sub:   'Invoice type selected',
      icon:  <FileText className="h-4 w-4" />,
      done:  true,
    },
    {
      label: 'Parties',
      sub:   'Select a customer',
      icon:  <Building2 className="h-4 w-4" />,
      done:  hasCustomer,
    },
    {
      label: 'Dates',
      sub:   'Set issue date',
      icon:  <FileText className="h-4 w-4" />,
      done:  hasIssueDate,
    },
    {
      label: 'Items',
      sub:   'Add line items',
      icon:  <Package className="h-4 w-4" />,
      done:  hasItems,
    },
    {
      label: 'Currency',
      sub:   'Set currency',
      icon:  <CreditCard className="h-4 w-4" />,
      done:  hasCurrency,
    },
    {
      label: 'Submit',
      sub:   'Create invoice',
      icon:  <CheckCircle2 className="h-4 w-4" />,
      done:  submitted,
    },
  ];

  function pickCard(card: CardType) {
    setSelected(card);
    reset({
      transaction_type: 'b2b', payment_means_code: '30', issue_date: today,
      currency: 'AED', exchange_rate: '1.000000', discount_amount: '0.00',
      is_reverse_charge: !!card.isReverseCharge, accounts_type: '', import_subtype: '',
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
      router.push(`/invoices/${res.data.data.id}`);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
      setServerError(e.response?.data?.error?.message ?? 'Failed to create invoice.');
      setServerDet(e.response?.data?.error?.details ?? {});
    }
  };

  // ── Step 1: Select type / supply category ──────────────────────────────────
  if (!selected) {
    return (
      <div className="max-w-5xl space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select the invoice type — the form will show only the relevant UAE FTA fields.
          </p>
        </div>

        <div>
          <GroupHeading icon={<FileText className="h-4 w-4" />} title="Document Types"
            subtitle="UAE FTA Req 12 & 13 — Tax invoices, credit notes and debit notes" />
          <div className="grid grid-cols-3 gap-4">
            {DOCUMENT_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </div>

        <div>
          <GroupHeading icon={<TrendingUp className="h-4 w-4" />} title="Sales / Output Supplies"
            subtitle="UAE FTA Req 1.1–1.9 — Supply categories for VAT return output tax (Boxes 1–6)" />
          <div className="grid grid-cols-3 gap-4">
            {SALES_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </div>

        <div>
          <GroupHeading icon={<TrendingDown className="h-4 w-4" />} title="Purchases / Input Tax"
            subtitle="UAE FTA Req 1.10–1.14 — Purchase categories for VAT return input tax recovery (Boxes 10–14)" />
          <div className="grid grid-cols-3 gap-4">
            {PURCHASE_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Invoice form + live preview ────────────────────────────────────
  return (
    <div className="pb-12">

      {/* Page header */}
      <div className="mb-5">
        <button type="button" onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to invoice types
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${accent.bg}`}>
            <span className={accent.icon}>{selected.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{selected.title}</h1>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.badge}`}>{selected.boxRef}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">{selected.reqRef}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">FAF Compliant</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{selected.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <FormStepper steps={STEPS} />

      {/* Two-column layout: form + preview */}
      <div className="grid grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">

          {/* Parties */}
          <Section title="Parties" subtitle="FAF: Company name, TRN, locations of suppliers and customers, accounts receivable/payable">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Customer (Buyer)" faf error={errors.customer_id?.message}>
                  <select className={inputCls(errors.customer_id?.message)} {...register('customer_id', { required: 'Customer is required' })}>
                    <option value="">Select a customer…</option>
                    {customers.map((cu) => (
                      <option key={cu.id} value={cu.id}>
                        {cu.name}{cu.trn ? ` — TRN: ${cu.trn}` : ''}{cu.city ? ` (${cu.city})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Transaction Type">
                <select className={selectCls} {...register('transaction_type')}>
                  <option value="b2b">B2B — Business to Business</option>
                  <option value="b2g">B2G — Business to Government</option>
                </select>
              </Field>
              <Field label="Payment Method" faf hint="UN/ECE UNCL 4461 — mandatory for UBL PaymentMeans element">
                <select className={selectCls} {...register('payment_means_code')}>
                  <option value="30">30 — Credit Transfer</option>
                  <option value="10">10 — Cash</option>
                  <option value="20">20 — Cheque</option>
                  <option value="48">48 — Bank Card</option>
                  <option value="49">49 — Direct Debit</option>
                  <option value="57">57 — Standing Order</option>
                  <option value="58">58 — SEPA Credit Transfer</option>
                </select>
              </Field>
              <Field label="Accounts Receivable / Payable" faf>
                <select className={selectCls} {...register('accounts_type')}>
                  <option value="">— Not specified —</option>
                  <option value="receivable">Accounts Receivable (AR)</option>
                  <option value="payable">Accounts Payable (AP)</option>
                </select>
              </Field>
              <Field label="Supplier Location" faf hint="FAF: Locations of suppliers">
                <input placeholder="e.g. Dubai, UAE" className={inputCls()} {...register('supplier_location')} />
              </Field>
              <Field label="Customer Location" faf hint="FAF: Locations of customers">
                <input placeholder="e.g. Riyadh, Saudi Arabia" className={inputCls()} {...register('customer_location')} />
              </Field>
            </div>
          </Section>

          {/* Supply Classification */}
          <Section title="Supply Classification" subtitle={`UAE VAT Return ${selected.boxRef} — ${selected.reqRef}`}>
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${accent.border} ${accent.bg}`}>
              <span className={accent.icon}>{selected.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${accent.icon}`}>{selected.title}</p>
                <p className="text-xs text-gray-600">{selected.hint}</p>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${accent.badge}`}>VAT {selected.vatLabel}</span>
            </div>
            {isImport && (
              <Field label="Import Type" hint="FAF Req 1.11 / 1.12 — required for import transactions">
                <select className={selectCls} {...register('import_subtype')}>
                  {IMPORT_SUBTYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            )}
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...register('is_reverse_charge')} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Reverse Charge Mechanism applies</p>
                <p className="text-xs text-gray-500 mt-0.5">VAT liability transfers to the buyer — required for imports subject to reverse charge (Box 1c).</p>
              </div>
              {isReverse && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">RC Active</span>}
            </label>
          </Section>

          {/* Invoice Dates */}
          <Section title="Invoice Dates" subtitle="FAF: Invoice dates, transaction dates, tax payment dates">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue Date" faf>
                <input type="date" className={inputCls()} {...register('issue_date')} />
              </Field>
              <Field label="Due Date (optional)">
                <input type="date" className={inputCls()} {...register('due_date')} />
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
          <Section title="Document References" subtitle="FAF: Invoice numbers, permit numbers, transaction IDs, GL/ID">
            {needRef && (
              <div className={`rounded-lg border ${accent.border} ${accent.bg} p-3 space-y-2`}>
                <p className={`text-xs font-semibold ${accent.icon}`}>
                  Original Invoice Reference — required for {selected.value === 'credit_note' ? 'Credit' : 'Debit'} Notes
                </p>
                <Field label="Original Invoice Number" faf error={errors.reference_number?.message}>
                  <input placeholder="e.g. INV-202604-000001" className={inputCls(errors.reference_number?.message)}
                    {...register('reference_number', { required: 'Required for credit/debit notes' })} />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Number" hint="Auto-generated on save">
                <input disabled placeholder="Auto-generated on save"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400 cursor-not-allowed" />
              </Field>
              <Field label="Permit Number" faf>
                <input placeholder="e.g. UAE-PERMIT-2024-XXXX" className={inputCls()} {...register('permit_number')} />
              </Field>
              <Field label="Transaction ID" faf>
                <input placeholder="e.g. TXN-2024-000001" className={inputCls()} {...register('transaction_id')} />
              </Field>
              <Field label="Purchase Order Number">
                <input placeholder="Buyer PO reference" className={inputCls()} {...register('purchase_order_number')} />
              </Field>
              <div className="col-span-2">
                <Field label="GL / Account ID" faf hint="General Ledger account ID — required for FTA Audit File (FAF)">
                  <input placeholder="e.g. GL-4100 or AR-001" className={inputCls()} {...register('gl_account_id')} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Currency & Financials */}
          <Section title="Currency & Financials" subtitle="FAF: VAT amounts in actual currency and AED">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Currency">
                <select className={selectCls} {...register('currency')}>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="QAR">QAR — Qatari Riyal</option>
                </select>
              </Field>
              <Field label="Exchange Rate to AED" faf hint={isAED ? 'Always 1.0 for AED invoices' : 'Convert VAT amounts to AED for FTA reporting'}>
                <input type="number" step="0.000001" min="0.000001" disabled={isAED}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAED ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  {...register('exchange_rate')} />
              </Field>
              <Field label="Invoice Discount (optional)">
                <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls()} {...register('discount_amount')} />
              </Field>
            </div>
            {!isAED && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Non-AED invoice: all VAT amounts must be reported in AED using the exchange rate above (UAE FTA requirement).</p>
              </div>
            )}
          </Section>

          {/* Line Items */}
          <Section title="Line Items" subtitle="FAF: Description, product/service references, tax codes, debit/credit amounts, VAT amounts">

            {/* Excel toolbar */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-100">
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
                <ItemRow key={f.id} idx={idx} register={register} errors={errors}
                  vatLocked={vatLocked} onRemove={() => remove(idx)} canRemove={fields.length > 1} />
              ))}
            </div>
            <button type="button"
              onClick={() => append({ item_name: '', description: '', product_reference: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: vatLocked ? 'out_of_scope' : (selected.vatRate ?? 'standard'),
                tax_code: '', debit_amount: '', credit_amount: '' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300
                         text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-700 w-full justify-center">
              <Plus className="h-4 w-4" /> Add Line Item
            </button>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea rows={3} placeholder="Optional notes…"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              {...register('notes')} />
            <p className="text-xs text-gray-400">FAF metadata (GL/ID, permit, transaction ID, supply category) is automatically appended on save.</p>
          </Section>

          {/* Error */}
          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">{serverError}</p>
                {Object.entries(serverDet).map(([k, v]) => (
                  <p key={k} className="text-xs text-red-600 mt-0.5"><span className="font-medium">{k}:</span> {Array.isArray(v) ? v.join(', ') : String(v)}</p>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting} className="px-8">
              {isSubmitting
                ? <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</span>
                : <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Create Invoice</span>
              }
            </Button>
          </div>
        </form>

        {/* ── RIGHT: Live preview (sticky) ── */}
        <div className="sticky top-20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Invoice Preview</p>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Updates live</span>
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
          />
        </div>

      </div>
    </div>
  );
}
