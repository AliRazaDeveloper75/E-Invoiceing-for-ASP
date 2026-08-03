'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import CustomSelect from '@/components/ui/CustomSelect';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Trash2, Plus, FileText, RotateCcw, RefreshCw,
  CheckCircle2, ArrowLeft, AlertTriangle,
  PackageOpen, FileCheck,
  Building2, Package, CreditCard, UserCheck,
  Upload, Download, FileSpreadsheet, X,
  QrCode, PenLine, Phone, Mail,
  Copy, Check, ChevronLeft, ChevronRight,
  Wallet, Banknote, CircleDollarSign,
  Share2, Maximize2, Globe, ShieldCheck, Landmark,
} from 'lucide-react';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { FieldTooltip } from '@/components/ui/FieldTooltip';
import type { BuyerProfile } from '@/types';

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

// ─── Document types (buyer self-billing = tax invoice + credit note) ──────────

const BUYER_DOCUMENT_TYPES: CardType[] = [
  {
    value: 'tax_invoice', title: 'Tax Invoice', subtitle: 'Self-billed B2B',
    hint: 'Standard UAE tax invoice issued by the buyer on behalf of the supplier for goods or services received.',
    vatRate: 'standard', vatLabel: '5%', boxRef: 'UBL 380', reqRef: 'Req 12',
    color: 'blue', icon: <FileText className="h-6 w-6" />, docType: 'tax_invoice',
  },
  {
    value: 'credit_note', title: 'Credit Note', subtitle: 'Corrects a prior invoice',
    hint: 'Issued by the buyer to reduce the value of a previously issued tax invoice. Requires the original invoice number.',
    vatRate: 'standard', vatLabel: 'Varies', boxRef: 'UBL 381', reqRef: 'Req 13',
    color: 'amber', icon: <RotateCcw className="h-6 w-6" />, docType: 'credit_note',
  },
];

// ─── Form types ───────────────────────────────────────────────────────────────

interface BuyerLineItem {
  item_name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate_type: string;
}

interface BuyerInvoiceForm {
  transaction_type: string;
  payment_means_code: string;
  supplier_location: string;
  accounts_type: string;
  issue_date: string;
  due_date: string;
  supply_date: string;
  currency: string;
  exchange_rate: string;
  discount_amount: string;
  reference_number: string;
  credit_note_reason_code: string;
  purchase_order_number: string;
  permit_number: string;
  transaction_id: string;
  gl_account_id: string;
  notes: string;
  items: BuyerLineItem[];
}

const VAT_RATE_MAP: Record<string, number> = {
  standard: 5,
  zero: 0,
  exempt: 0,
  out_of_scope: 0,
};

// ─── Fetcher / helpers ────────────────────────────────────────────────────────

function buyerProfileFetcher() {
  return api.get<{ success: boolean; data: BuyerProfile }>('/buyer/me/').then((r) => r.data.data);
}

// Limit free-text fields: max 15 words, each word max 15 characters.
function limitWords(value: string, label: string, maxWords = 15, maxWordLen = 15): string | true {
  if (!value?.trim()) return true;
  const words = value.trim().split(/\s+/);
  if (words.length > maxWords) return `${label}: maximum ${maxWords} words`;
  if (words.some((w) => w.length > maxWordLen)) return `${label}: each word max ${maxWordLen} characters`;
  return true;
}

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
  label: string; hint?: string; tooltip?: string;
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
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 via-blue-950 to-indigo-900 flex items-start gap-3 relative overflow-hidden">
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
          {subtitle && <p className="text-xs text-blue-200/80 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-6 md:p-7 space-y-5">{children}</div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 ${err ? 'border-red-400' : 'border-gray-300'}`;

// Reusable text rule: at most 20 words, and each word at most 15 characters.
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

// Flatten a DRF error-details object into readable "field: message" lines.
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

/** Strip trailing zeros from a numeric string: "238.0000" → "238", "5.50" → "5.5" */
function stripZeros(v: string): string {
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(n) : v;
}

// ─── Excel columns (order matters — matches sample template) ──────────────────

const EXCEL_COLS = [
  { key: 'item_name',     header: 'Item / Service Name *' },
  { key: 'description',   header: 'Description *'         },
  { key: 'quantity',      header: 'Quantity *'            },
  { key: 'unit',          header: 'Unit (pcs/hr/kg)'      },
  { key: 'unit_price',    header: 'Unit Price (excl. VAT) *' },
  { key: 'vat_rate_type', header: 'VAT Rate (standard/zero/exempt/out_of_scope)' },
];

const EXCEL_SAMPLE_ROWS = [
  ['IT Consulting Services', 'Monthly IT support and consulting', '1', 'hr',  '1000.00', 'standard'],
  ['Office Chair',           'Ergonomic high-back office chair',  '5', 'pcs', '500.00',  'standard'],
  ['Software License',       'Annual SaaS subscription fee',      '1', 'yr',  '2500.00', 'standard'],
];

function downloadSampleExcel() {
  const ws = XLSX.utils.aoa_to_sheet([
    EXCEL_COLS.map((c) => c.header),
    ...EXCEL_SAMPLE_ROWS,
  ]);
  ws['!cols'] = [28, 35, 10, 14, 22, 42].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Line Items');
  XLSX.writeFile(wb, 'e-numerak-items-template.xlsx');
}

type ItemField = {
  item_name: string; description: string;
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

        const header = (rows[0] as string[]).map((h) => String(h).trim());
        const colMap: Record<string, number> = {};
        EXCEL_COLS.forEach(({ key }) => {
          const idx = header.findIndex((h) =>
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

          if (!name && !desc) return;

          if (!price || isNaN(parseFloat(price))) {
            errors.push(`Row ${rowNum}: Unit Price is missing or invalid.`);
            return;
          }

          const vat = get('vat_rate_type').toLowerCase() || 'standard';
          const validVat = ['standard', 'zero', 'exempt', 'out_of_scope'];

          items.push({
            item_name:    name,
            description:  desc || name,
            quantity:     get('quantity') || '1',
            unit:         get('unit'),
            unit_price:   stripZeros(price),
            vat_rate_type: validVat.includes(vat) ? vat : 'standard',
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

    const itemsWithVat = items.map((it) => ({
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
      <button
        type="button"
        onClick={downloadSampleExcel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
      >
        <Download className="h-3.5 w-3.5" />
        Template
      </button>

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

function ItemRow({ idx, register, control, errors, trigger, onRemove, canRemove, setValue }: {
  idx: number;
  register: ReturnType<typeof useForm<BuyerInvoiceForm>>['register'];
  control: ReturnType<typeof useForm<BuyerInvoiceForm>>['control'];
  errors: ReturnType<typeof useForm<BuyerInvoiceForm>>['formState']['errors'];
  trigger: ReturnType<typeof useForm<BuyerInvoiceForm>>['trigger'];
  onRemove: () => void; canRemove: boolean;
  setValue: ReturnType<typeof useForm<BuyerInvoiceForm>>['setValue'];
}) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item #{idx + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Item / Service Name" required
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
        <Field label="Unit" required tooltip="Unit of measure."
          error={errors.items?.[idx]?.unit?.message}>
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

      <Field label="Description of Goods / Services" required
        tooltip="A clear description of the goods or services received. Required on every line by the FTA."
        error={errors.items?.[idx]?.description?.message}>
        <input
          placeholder="Full description of goods or services received…"
          className={inputCls(errors.items?.[idx]?.description?.message)}
          {...register(`items.${idx}.description`, {
            required: 'Description is required',
            maxLength: { value: 300, message: 'Description must be 300 characters or fewer' },
            ...wordLimit('Description', 50),
            onChange: () => { setTimeout(() => trigger(`items.${idx}.description`), 0); },
          })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity" required
          tooltip="Number of units received. Must be greater than 0."
          error={errors.items?.[idx]?.quantity?.message}>
          <input type="number" step="0.01" min="0.01" className={inputCls(errors.items?.[idx]?.quantity?.message)}
            {...register(`items.${idx}.quantity`, {
              required: 'Required',
              validate: (v) => (parseFloat(v) > 0) || 'Must be greater than 0',
            })} />
        </Field>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="VAT Rate"
          tooltip="The VAT treatment for this line: Standard 5%, Zero-rated 0%, Exempt, or Out of Scope.">
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
                  <span className="text-[11px] font-black">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-bold leading-tight truncate transition-colors duration-200
                  ${isActive ? 'text-white' : isDone ? 'text-emerald-700' : 'text-gray-500'}
                `}>{s.label}</p>
                <p className={`text-[9px] leading-tight mt-0.5 truncate transition-colors duration-200
                  ${isActive ? 'text-white/60' : isDone ? 'text-emerald-400' : 'text-gray-400'}
                `}>{s.sub}</p>
              </div>
              {i < steps.length - 1 && (
                <svg className={`w-3 h-3 shrink-0 ${isActive ? 'text-white/30' : 'text-gray-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

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

// ─── Seller (supplier company) card ───────────────────────────────────────────

function SellerProfileCard({ profile }: { profile: BuyerProfile | null }) {
  if (!profile) return null;
  const fields = [
    profile.company_trn && { label: 'TRN', value: profile.company_trn, mono: true },
    profile.company_email && { label: 'Email', value: profile.company_email },
    profile.company_phone && { label: 'Phone', value: profile.company_phone },
    profile.company_address && { label: 'Address', value: profile.company_address },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 shadow-sm overflow-hidden">
      <div className="bg-white px-3 sm:px-5 py-3 space-y-2.5 sm:space-y-0 border-b border-blue-100/60">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs sm:text-sm text-blue-600 shrink-0">
            {(profile.company_name ?? 'CO').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-gray-900 text-sm sm:text-base leading-tight break-words">{profile.company_name}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0">Supplier</span>
            </div>
            {profile.company_legal_name && profile.company_legal_name !== profile.company_name && (
              <p className="text-[11px] text-gray-400 mt-0.5 break-words">{profile.company_legal_name}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        {fields.length > 0 && (
          <div className="rounded-xl bg-white/70 border border-blue-100/60 divide-y divide-blue-50">
            {fields.map((f) => (
              <div key={f.label} className="flex items-start gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider shrink-0 w-16 mt-0.5">{f.label}</span>
                <span className={`text-xs sm:text-sm text-gray-700 break-all ${f.mono ? 'font-mono' : ''}`}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Buyer (own customer record) card — fixed ─────────────────────────────────

function BuyerInfoCard({ profile }: { profile: BuyerProfile | null }) {
  if (!profile) return null;
  const type = ['b2b', 'b2g', 'b2c'].includes(profile.customer_type) ? profile.customer_type : '';
  const typeCls = 'bg-blue-100 text-blue-700';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-in-scale">
      <div className="flex items-start gap-4">
        <div className={`h-11 w-11 rounded-xl ${getAvatarColor(profile.customer_name)} flex items-center justify-center shrink-0 shadow-sm`}>
          <span className="text-white text-sm font-bold">{getInitials(profile.customer_name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <UserCheck className="h-3 w-3" /> Buyer (you) — fixed
          </p>
          <p className="text-sm font-bold text-emerald-900 truncate">{profile.customer_legal_name || profile.customer_name}</p>
          {profile.customer_legal_name && profile.customer_name !== profile.customer_legal_name && (
            <p className="text-xs text-emerald-600 truncate">{profile.customer_name}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-emerald-200/60">
        {profile.customer_trn && (
          <div>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">TRN</p>
            <p className="text-xs font-mono font-semibold text-emerald-800">{profile.customer_trn}</p>
          </div>
        )}
        {type && (
          <div>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Type</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase inline-block mt-0.5 ${typeCls}`}>
              {TYPE_LABEL[type] || type}
            </span>
          </div>
        )}
        {profile.customer_phone && (
          <div>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Phone</p>
            <p className="text-xs text-emerald-800 flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{profile.customer_phone}</p>
          </div>
        )}
        {profile.customer_email && (
          <div>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Email</p>
            <p className="text-xs text-emerald-800 truncate flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{profile.customer_email}</p>
          </div>
        )}
        {profile.customer_address && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Address</p>
            <p className="text-xs text-emerald-800">{profile.customer_address}</p>
          </div>
        )}
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
  items: BuyerLineItem[];
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

  const THEME: Record<string, { header: string; accent: string; badge: string }> = {
    blue:    { header: 'from-[#1e3a5f] to-[#1e4d8c]', accent: '#3b82f6', badge: 'bg-blue-500/20 text-blue-100' },
    amber:   { header: 'from-[#78350f] to-[#b45309]',  accent: '#f59e0b', badge: 'bg-amber-400/20 text-amber-100' },
    orange:  { header: 'from-[#7c2d12] to-[#c2410c]',  accent: '#f97316', badge: 'bg-orange-400/20 text-orange-100' },
    indigo:  { header: 'from-[#1e1b4b] to-[#3730a3]',  accent: '#6366f1', badge: 'bg-indigo-400/20 text-indigo-100' },
    emerald: { header: 'from-[#064e3b] to-[#065f46]',  accent: '#10b981', badge: 'bg-emerald-400/20 text-emerald-100' },
    rose:    { header: 'from-[#881337] to-[#be123c]',  accent: '#f43f5e', badge: 'bg-rose-400/20 text-rose-100' },
    violet:  { header: 'from-[#3b0764] to-[#6d28d9]',  accent: '#8b5cf6', badge: 'bg-violet-400/20 text-violet-100' },
    teal:    { header: 'from-[#134e4a] to-[#0f766e]',  accent: '#14b8a6', badge: 'bg-teal-400/20 text-teal-100' },
    slate:   { header: 'from-[#1e293b] to-[#334155]',  accent: '#94a3b8', badge: 'bg-slate-400/20 text-slate-100' },
  };
  const theme = THEME[card.color] ?? THEME.blue;

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl shadow-gray-200/40 border border-gray-200/80 text-[11px] bg-white"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${theme.header} px-4 sm:px-5 pt-4 sm:pt-5 pb-4 relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.07] bg-white" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-[0.04] bg-white" />

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
              <p className="text-white/40 text-[9px] sm:text-[10px] mt-0.5">Buyer Self-Billed · UAE E-Invoicing</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest shrink-0 ${theme.badge}`}>
            {card.title}
          </span>
        </div>

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
          <div className="space-y-1">
            <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">From</p>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
              <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate">{companyName || '—'}</p>
            </div>
            <p className="text-gray-400 text-[9px] pl-[18px]">UAE · TRN on file</p>
          </div>
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
              <p className="text-gray-300 text-[10px] italic mt-0.5">—</p>
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
            <div className="hidden sm:grid grid-cols-[1fr_40px_52px_28px_60px] gap-x-1 px-3 py-1.5 text-[8px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">VAT</span>
              <span className="text-right">Amount</span>
            </div>
            {items.map((it, i) => {
              const name = it.item_name || it.description;
              if (!name && !parseFloat(it.unit_price || '0')) return null;
              const { net, rate } = lineCalcs[i];
              return (
                <Fragment key={i}>
                  <div className={`sm:hidden px-3 py-2 border-t border-gray-100 first:border-t-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800 text-[11px] leading-tight truncate flex-1">{name || '—'}</p>
                      <p className="text-right font-bold text-gray-800 tabular-nums text-[11px] shrink-0">{cur} {fmt(net)}</p>
                    </div>
                    <p className="text-gray-400 text-[9px] mt-0.5">{parseFloat(it.quantity) || 0} × {fmt(parseFloat(it.unit_price) || 0)} · {rate}% VAT</p>
                  </div>
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
          <span className="text-[8px] sm:text-[9px] text-gray-300 italic">Self-billed</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewBuyerInvoicePage() {
  const router = useRouter();
  const [selected, setSelected]       = useState<CardType | null>(null);
  const [serverError, setServerError] = useState('');
  const [serverDet, setServerDet]     = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted]     = useState(false);
  const [invoiceNo]                   = useState(generateInvoiceNumber);
  const [loadError, setLoadError]     = useState('');

  const { data: profile, isLoading: profileLoading } = useSWR<BuyerProfile>(
    '/buyer/me/',
    buyerProfileFetcher,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { register, control, handleSubmit, reset, watch, setValue, trigger,
    formState: { errors, isSubmitting } } = useForm<BuyerInvoiceForm>({
    defaultValues: {
      transaction_type: 'b2b', payment_means_code: '30', issue_date: today,
      currency: 'AED', exchange_rate: '1.000000', discount_amount: '0.00',
      accounts_type: '',
      reference_number: '', credit_note_reason_code: '', purchase_order_number: '',
      permit_number: '', transaction_id: '', gl_account_id: '',
      notes: '',
      items: [{ item_name: '', description: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: 'standard' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // If the profile fails to load (e.g. not a buyer), the layout already redirects;
  // keep a graceful error just in case.
  useEffect(() => {
    if (!profileLoading && !profile && !loadError) {
      setLoadError('Could not load your buyer profile. Please refresh the page.');
    }
  }, [profileLoading, profile, loadError]);

  // Auto-fill supplier location from the linked supplier company's address.
  useEffect(() => {
    if (!profile?.company_address) return;
    const current = watch('supplier_location');
    if (current) return;
    setValue('supplier_location', profile.company_address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_address]);

  // Transaction type defaults to the buyer's own customer type (b2b / b2g / b2c).
  useEffect(() => {
    if (profile?.customer_type && ['b2b', 'b2g', 'b2c'].includes(profile.customer_type)) {
      setValue('transaction_type', profile.customer_type);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.customer_type]);

  // Watch for preview
  const watchedItems = watch('items');
  const currency     = watch('currency');
  const discount     = watch('discount_amount');
  const issueDate    = watch('issue_date');
  const dueDate      = watch('due_date');

  const isAED    = currency === 'AED';
  const needRef  = selected?.docType === 'credit_note';
  const accent   = selected ? (C[selected.color] ?? C.blue) : C.blue;

  // ── Payment / verification QR code (shown in the "Print Code" step) ──────────
  const qrTotal = (watchedItems ?? []).reduce((sum, it) => {
    const net  = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
    const rate = VAT_RATE_MAP[it.vat_rate_type] ?? 0;
    return sum + net + net * rate / 100;
  }, 0);
  const qrText = [
    'E-NUMERAK',
    `INV:${invoiceNo}`,
    `SELLER:${profile?.company_name ?? ''}`,
    `STRN:${profile?.company_trn ?? ''}`,
    `BUYER:${profile?.customer_name ?? ''}`,
    `BTRN:${profile?.customer_trn ?? ''}`,
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
  const handleDownloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${invoiceNo || 'invoice'}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyInvoiceNo = () => {
    navigator.clipboard.writeText(invoiceNo).then(() => {
      setInvNoCopied(true);
      setTimeout(() => setInvNoCopied(false), 2000);
    });
  };

  const handleShareQr = async () => {
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
  };

  // ── Stepper completion logic ──────────────────────────────────────────────
  const hasIssueDate = !!issueDate;
  const hasItems     = watchedItems.some(
    (it) => (it.description || it.item_name) && parseFloat(it.unit_price || '0') > 0
  );
  const hasCurrency  = !!currency;

  const readyToSubmit = hasItems && hasCurrency && hasIssueDate;

  // ── Wizard step navigation ────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 6;   // Review is the final step (it submits directly)

  const stepFields = (s: number): (keyof BuyerInvoiceForm)[] => {
    switch (s) {
      case 0: return ['supplier_location'];                     // Your Info
      case 1: return [];                                        // Buyer (fixed)
      case 2: return ['items'];                                 // Line Items
      case 3: return [                                          // Payment & Sign
        'issue_date', 'due_date', 'exchange_rate', 'discount_amount', 'currency',
        'purchase_order_number', 'permit_number', 'transaction_id', 'gl_account_id',
        ...(needRef ? ['reference_number' as keyof BuyerInvoiceForm, 'credit_note_reason_code' as keyof BuyerInvoiceForm] : []),
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
      sub:   'Your company (fixed)',
      icon:  <Building2 className="h-4 w-4" />,
      done:  true,
    },
    {
      label: 'Line Items',
      sub:   'Goods / services',
      icon:  <Package className="h-4 w-4" />,
      done:  hasItems,
    },
    {
      label: 'Payment & Sign',
      sub:   'Currency & dates',
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
      accounts_type: '',
      supplier_location: profile?.company_address ?? '',
      reference_number: '', credit_note_reason_code: '', purchase_order_number: '',
      permit_number: '', transaction_id: '', gl_account_id: '',
      notes: '',
      items: [{ item_name: '', description: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: card.vatRate }],
    });
  }

  const onSubmit = async (data: BuyerInvoiceForm) => {
    if (!selected) return;
    setServerError(''); setServerDet({});
    try {
      const payload: Record<string, unknown> = {
        invoice_type: selected.docType,
        transaction_type: data.transaction_type || 'b2b',
        payment_means_code: data.payment_means_code || '30',
        supplier_location: data.supplier_location || '',
        accounts_type: data.accounts_type || '',
        issue_date: data.issue_date,
        currency: data.currency,
        exchange_rate: data.exchange_rate || '1.000000',
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

      const fafMeta = [
        data.gl_account_id  ? `GL/ID: ${data.gl_account_id}`   : '',
        data.permit_number  ? `Permit: ${data.permit_number}`  : '',
        data.transaction_id ? `Txn ID: ${data.transaction_id}` : '',
      ].filter(Boolean).join(' | ');

      if (data.notes || fafMeta)
        payload.notes = [data.notes, fafMeta ? `[FAF] ${fafMeta}` : ''].filter(Boolean).join('\n');

      const res = await api.post('/buyer/invoices/', payload);
      setSubmitted(true);
      router.push(`/buyer/invoices/${res.data.data.id}`);
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
      setServerError(e.response?.data?.error?.message ?? 'Failed to create invoice.');
      setServerDet(e.response?.data?.error?.details ?? {});
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 animate-pulse-soft">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">{loadError || 'Profile not found.'}</p>
            <button type="button" onClick={() => router.push('/buyer/dashboard')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Select document type ──────────────────────────────────────────
  if (!selected) {
    return (
      <div className="space-y-10">
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
              <h1 className="text-xl font-bold text-white tracking-tight">New Self-Billed Invoice</h1>
              <p className="text-sm text-blue-200/60 mt-0.5">
                You are creating an invoice on behalf of <span className="text-white font-semibold">{profile.company_name}</span>,
                billed to <span className="text-white font-semibold">{profile.customer_name}</span>. It is saved as a draft for the
                supplier to review before it is submitted.
              </p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <GroupHeading icon={<FileText className="h-4 w-4" />} title="Document Types"
            subtitle="UAE FTA Req 12 & 13 — Tax invoices and credit notes" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {BUYER_DOCUMENT_TYPES.map((t) => <TypeCard key={t.value} card={t} selected={false} onSelect={() => pickCard(t)} />)}
          </div>
        </AnimatedSection>
      </div>
    );
  }

  // ── Step 2: Invoice form + live preview ────────────────────────────────────
  return (
    <div className="pb-12">
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
              Back to document types
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

      {/* Two-column layout: form + preview. On the Review step we go full-width. */}
      <div className={step === 5 ? '' : 'grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start'}>

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6 min-w-0" noValidate>

          {/* STEP 0 — Your Info (seller) */}
          {step === 0 && (
            <AnimatedSection>
            <Section title="Your Info" icon={<Building2 className="h-4 w-4" />} subtitle="The supplier company (seller) issuing this invoice">
              <SellerProfileCard profile={profile} />

              <Field label="Supplier Location" required
                tooltip="Location of the supplier (the company you are invoicing for). E.g. Dubai, UAE"
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

          {/* STEP 1 — Buyer (fixed) */}
          {step === 1 && (
            <AnimatedSection delay={100}>
            <Section title="Buyer" icon={<Building2 className="h-4 w-4" />} subtitle="The buyer record this invoice is billed to — fixed">
              <BuyerInfoCard profile={profile} />

              <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                <Landmark className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-800 leading-relaxed">
                  This is a self-billed invoice: you (the buyer) are the recipient and{' '}
                  <strong>{profile.company_name}</strong> is the seller. These details are fixed for this invoice.
                </p>
              </div>
            </Section>
            </AnimatedSection>
          )}

          {/* STEP 2 — Line Items */}
          {step === 2 && (
          <AnimatedSection delay={200}>
          <Section title="Line Items" icon={<Package className="h-4 w-4" />} subtitle="Goods or services received — description, quantity, unit price, VAT">

            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fields.length} item{fields.length !== 1 ? 's' : ''}
              </div>
              <ExcelUploadButton
                defaultVat={selected.vatRate ?? 'standard'}
                onItems={(items, mode) => {
                  if (mode === 'replace') {
                    const count = fields.length;
                    for (let i = count - 1; i >= 0; i--) remove(i);
                    items.forEach((it) => append(it));
                  } else {
                    items.forEach((it) => append(it));
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              {fields.map((f, idx) => (
                <ItemRow key={f.id} idx={idx} register={register} control={control} errors={errors}
                  trigger={trigger} onRemove={() => remove(idx)} canRemove={fields.length > 1}
                  setValue={setValue} />
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
              onClick={() => append({ item_name: '', description: '', quantity: '1', unit: '',
                unit_price: '', vat_rate_type: selected.vatRate ?? 'standard' })}
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

          {/* STEP 3 — Payment & Sign (dates, references, currency) */}
          {step === 3 && (
          <AnimatedSection delay={300} className="space-y-5 sm:space-y-6">
          <Section title="Invoice Dates" icon={<FileText className="h-4 w-4" />} subtitle="Issue and due dates for this invoice">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Issue Date" required
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
            </div>
          </Section>

          {needRef && (
          <Section title="Original Invoice Reference" icon={<RotateCcw className="h-4 w-4" />} subtitle="Required for credit notes (UAE VAT Executive Regulation Article 61(1))">
            <Field label="Original Invoice Number" required
              tooltip="The number of the original tax invoice this credit note adjusts."
              error={errors.reference_number?.message}>
              <input placeholder="e.g. INV-202604-000001" className={inputCls(errors.reference_number?.message)}
                {...register('reference_number', { required: 'Required for credit notes' })} />
            </Field>
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
          </Section>
          )}

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
              <Field label="Exchange Rate to AED"
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

          <Section title="References" icon={<FileCheck className="h-4 w-4" />} subtitle="Invoice numbers, permit numbers, transaction IDs, GL/ID">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice Number" hint="System-generated reference">
                <input disabled value={invoiceNo} readOnly
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 font-mono cursor-not-allowed" />
              </Field>
              <Field label="Purchase Order Number (optional)"
                tooltip="Your internal purchase order reference for this supply.">
                <input placeholder="Buyer PO reference" maxLength={40}
                  className={inputCls(errors.purchase_order_number?.message)}
                  {...register('purchase_order_number', {
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                  })} />
              </Field>
              <Field label="Permit Number" required error={errors.permit_number?.message}
                tooltip="Regulatory permit number — required for FTA Audit File (FAF).">
                <input placeholder="e.g. UAE-PERMIT-2024-XXXX" maxLength={20}
                  className={inputCls(errors.permit_number?.message)}
                  {...register('permit_number', {
                    required: 'Permit number is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                    onChange: () => { setTimeout(() => trigger('permit_number'), 0); },
                  })} />
              </Field>
              <Field label="Transaction ID" required error={errors.transaction_id?.message}
                tooltip="Unique transaction reference — required for FTA Audit File (FAF).">
                <input placeholder="e.g. TXN-2024-000001" maxLength={30}
                  className={inputCls(errors.transaction_id?.message)}
                  {...register('transaction_id', {
                    required: 'Transaction ID is required for FAF',
                    pattern: { value: /^[A-Za-z0-9\-/ ]*$/, message: 'Letters, numbers, - or / only' },
                    onChange: () => { setTimeout(() => trigger('transaction_id'), 0); },
                  })} />
              </Field>
              <div className="col-span-2">
                <Field label="GL / Account ID" required error={errors.gl_account_id?.message}
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
          </AnimatedSection>
          )}

          {/* STEP 5 — Review */}
          {step === 5 && (
          <AnimatedSection delay={400}>
          <Section title="Notes" icon={<FileText className="h-4 w-4" />} subtitle="Optional — appended to the invoice">
            <textarea rows={2} placeholder="Optional notes…"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
              {...register('notes')} />
          </Section>

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
                  companyName={profile.company_name ?? ''}
                  customerName={profile.customer_name ?? ''}
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
              The invoice is saved as a draft. The supplier verifies it, then sends it to you to review and confirm
              before it is submitted for FTA processing.
            </p>
          </div>
          </AnimatedSection>
          )}

          {/* STEP 4 — Print Code */}
          {step === 4 && (
          <AnimatedSection delay={500}>
          <Section title="Print Code" icon={<QrCode className="h-4 w-4" />} subtitle="Scan-to-verify QR code — printed on the final invoice">
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-200/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
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
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-2xl" />
                  </div>
                  <p className="text-center text-[11px] text-gray-400 mt-2.5 font-medium">Scan to verify</p>

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

                <div className="text-sm space-y-3 min-w-0 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700">Verification code ready</span>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                    This QR encodes the invoice number, seller &amp; buyer TRN, total amount and date.
                    Anyone can scan it to verify the invoice is genuine.
                  </p>

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
              companyName={profile.company_name ?? ''}
              customerName={profile.customer_name ?? ''}
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
