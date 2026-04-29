'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ChevronRight, ChevronLeft, FileText, Info, CheckCircle2,
  Eye, EyeOff, AlertCircle, ArrowLeft, Sparkles, Zap, X,
  Search, Building2, UserCheck, RotateCcw, ChevronDown,
  Plus, Trash2, Send, CreditCard, Package, Users, Calculator,
} from 'lucide-react';
import { PINT_FIELDS } from '@/data/pint-invoice-fields';
import type { PintField, MandatoryType } from '@/data/pint-invoice-fields';
import { useCompany } from '@/hooks/useCompany';
import { api } from '@/lib/api';
import type { Customer, Company } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatCategory: string;
  vatRate: string;
  discount: string;
}

// ── Steps ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'invoice',  label: 'Invoice',  icon: FileText,   desc: 'Type, number, dates & currency' },
  { id: 'supplier', label: 'Supplier', icon: Building2,  desc: 'Seller identity & address' },
  { id: 'buyer',    label: 'Buyer',    icon: Users,      desc: 'Buyer identity & address' },
  { id: 'items',    label: 'Items',    icon: Package,    desc: 'Line items & amounts' },
  { id: 'payment',  label: 'Payment',  icon: CreditCard, desc: 'Payment method & bank details' },
  { id: 'submit',   label: 'Submit',   icon: Send,       desc: 'Review & send to ASP' },
] as const;

type StepId = typeof STEPS[number]['id'];

// ── Field IDs per step ────────────────────────────────────────────────────

const STEP_FIELDS: Record<string, string[]> = {
  invoice:  ['IBT-003', 'BTAE-02', 'IBT-001', 'BTAE-07', 'IBT-002', 'IBT-009', 'IBT-005', 'IBT-022'],
  supplier: ['IBT-027', 'IBT-031', 'IBT-028', 'IBT-035', 'IBT-037', 'IBT-039', 'IBT-040', 'IBT-042', 'IBT-043'],
  buyer:    ['IBT-044', 'IBT-048', 'IBT-045', 'IBT-050', 'IBT-052', 'IBT-055', 'IBT-057', 'IBT-058'],
  payment:  ['IBT-081', 'IBT-082', 'IBT-083', 'IBT-084', 'IBT-085', 'IBT-086'],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function generateInvoiceNumber(): string {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const key  = `pint-inv-seq-${dd}${mm}${yyyy}`;
  const seq  = parseInt(localStorage.getItem(key) ?? '0', 10) + 1;
  localStorage.setItem(key, String(seq));
  return `INV-${dd}${mm}${yyyy}-${String(seq).padStart(3, '0')}`;
}

async function fetchCustomers(url: string) {
  const r = await api.get<{ results: Customer[] }>(url);
  return r.data.results;
}

const INV_TYPE_LABEL: Record<string, string> = {
  '380': 'Tax Invoice', '381': 'Credit Note', '480': 'Commercial Invoice', '875': 'Continuous Supply',
};

const SECTION_COLORS: Record<string, string> = {
  Shared:           'bg-blue-50   text-blue-700   border-blue-200',
  Distinct:         'bg-purple-50 text-purple-700 border-purple-200',
  Aligned:          'bg-teal-50   text-teal-700   border-teal-200',
  'Syntax Binding': 'bg-amber-50  text-amber-700  border-amber-200',
};

function computeLineAmount(qty: string, price: string, discount: string): number {
  return Math.max(0, (parseFloat(qty) || 0) * (parseFloat(price) || 0) - (parseFloat(discount) || 0));
}

function computeTotals(items: LineItem[]) {
  let subtotal = 0, totalVat = 0;
  items.forEach((item) => {
    const net = computeLineAmount(item.quantity, item.unitPrice, item.discount);
    subtotal += net;
    totalVat += net * (parseFloat(item.vatRate) || 0) / 100;
  });
  return { subtotal, totalVat, grandTotal: subtotal + totalVat };
}

// ── Seller / Buyer mappers ────────────────────────────────────────────────

function applySellerFromCompany(c: Company): Record<string, string> {
  return {
    'IBT-027': c.legal_name || c.name || '',
    'IBT-028': c.name || '',
    'IBT-030': c.trn || '',
    'IBT-031': c.trn || '',
    'IBT-034': c.email || '',
    'IBT-034-1': c.email ? 'EM' : '',
    'IBT-035': c.street_address || '',
    'IBT-037': c.city || '',
    'IBT-038': c.po_box || '',
    'IBT-039': c.emirate || '',
    'IBT-040': c.country || 'AE',
    'IBT-042': c.phone || '',
    'IBT-043': c.email || '',
  };
}

function applyBuyerFromCustomer(c: Customer): Record<string, string> {
  return {
    'IBT-044': c.legal_name || c.name || '',
    'IBT-045': c.name || '',
    'IBT-047': c.trn || '',
    'IBT-048': c.vat_number || c.trn || '',
    'IBT-049': c.email || '',
    'IBT-049-1': c.email ? 'EM' : '',
    'IBT-050': c.street_address || '',
    'IBT-052': c.city || '',
    'IBT-054': c.city || '',
    'IBT-055': c.country || 'AE',
    'IBT-057': c.phone || '',
    'IBT-058': c.email || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1.5">
      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                       hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded-xl
                       px-3 py-2.5 leading-relaxed shadow-2xl">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

function MandatoryBadge({ type }: { type: MandatoryType }) {
  if (type === 'Mandatory') return <span className="text-red-500 ml-0.5 font-bold">*</span>;
  if (type === 'Mandatory-If Applicable')
    return <span className="text-amber-500 ml-1 text-[10px] font-bold tracking-tight">*cond</span>;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// FieldRenderer
// ─────────────────────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange, error, isActive, onFocus, onBlur }: {
  field: PintField; value: string;
  onChange: (id: string, val: string) => void;
  error?: string; isActive: boolean;
  onFocus: (id: string) => void; onBlur: () => void;
}) {
  const inputCls = [
    'w-full rounded-xl border-2 px-3.5 py-2.5 text-sm transition-all outline-none',
    isActive ? 'border-brand-500 ring-2 ring-brand-100 bg-white'
      : error ? 'border-red-300 bg-red-50'
      : 'border-gray-200 bg-white hover:border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
  ].join(' ');

  const wrapCls = [
    'rounded-xl border p-4 transition-all duration-200',
    isActive ? 'border-brand-100 bg-brand-50/50 shadow-sm' : 'border-transparent',
  ].join(' ');

  return (
    <div className={wrapCls}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <label className="flex items-center text-sm font-medium text-gray-800 leading-tight flex-1">
          {field.businessTerm}
          <MandatoryBadge type={field.mandatory} />
          <Tooltip text={field.definition} />
        </label>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
            ${SECTION_COLORS[field.uaePintSection] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {field.uaePintSection}
          </span>
          <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
            {field.id}
          </span>
        </div>
      </div>

      {field.inputType === 'select' ? (
        <select value={value} onChange={(e) => onChange(field.id, e.target.value)}
          onFocus={() => onFocus(field.id)} onBlur={onBlur}
          className={inputCls + ' cursor-pointer'}>
          <option value="">Select {field.businessTerm}…</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.inputType === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(field.id, e.target.value)}
          onFocus={() => onFocus(field.id)} onBlur={onBlur}
          placeholder={field.placeholder} rows={3}
          className={inputCls + ' resize-none'} />
      ) : (
        <input type={field.inputType} value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          onFocus={() => onFocus(field.id)} onBlur={onBlur}
          placeholder={field.placeholder}
          step={field.inputType === 'number' ? 'any' : undefined}
          className={inputCls} />
      )}

      {error && (
        <p className="flex items-center gap-1 mt-1.5 text-xs text-red-600 font-medium">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
      <p className="text-[10px] text-gray-400 mt-1.5">
        Cardinality: {field.cardinality}
        {field.mandatory === 'Optional' && ' — optional'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SellerCard
// ─────────────────────────────────────────────────────────────────────────
function SellerCard({ company, onRefill }: { company: Company; onRefill: () => void }) {
  return (
    <div className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 mb-1">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-brand-800 uppercase tracking-wider mb-0.5">Pre-filled from active company</p>
          <p className="text-sm font-semibold text-brand-900 truncate">{company.legal_name || company.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {company.trn && <span className="text-xs text-brand-600">TRN: {company.trn}</span>}
            {company.email && <span className="text-xs text-brand-600 truncate">{company.email}</span>}
            {company.city && <span className="text-xs text-brand-500">{company.city}, {company.country || 'AE'}</span>}
          </div>
        </div>
        <button onClick={onRefill} title="Re-fill from company"
          className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-100 transition-colors shrink-0">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BuyerPicker
// ─────────────────────────────────────────────────────────────────────────
function BuyerPicker({ activeId, selectedCustomer, onSelect, onClear }: {
  activeId: string; selectedCustomer: Customer | null;
  onSelect: (c: Customer) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const { data: customers = [] } = useSWR(
    activeId ? `/customers/?company_id=${activeId}&page_size=200` : null,
    fetchCustomers,
  );

  const filtered = customers.filter((c) => {
    const q = query.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.legal_name?.toLowerCase().includes(q)
      || c.trn?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  if (selectedCustomer) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-1">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <UserCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Buyer selected</p>
            <p className="text-sm font-semibold text-emerald-900 truncate">{selectedCustomer.legal_name || selectedCustomer.name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {selectedCustomer.trn && <span className="text-xs text-emerald-600">TRN: {selectedCustomer.trn}</span>}
              {selectedCustomer.email && <span className="text-xs text-emerald-600">{selectedCustomer.email}</span>}
            </div>
          </div>
          <button onClick={onClear}
            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-100 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-emerald-500 mt-2 ml-12">Fields pre-filled — edit below to override.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-1">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5" /> Search existing customers
      </p>
      <div className="relative">
        <input type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, TRN, or email…"
          className="w-full rounded-xl border-2 border-gray-200 px-3.5 py-2.5 text-sm
                     focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 pr-10" />
        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200
                            rounded-xl shadow-xl max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  {customers.length === 0 ? 'No customers found.' : 'No matches.'}
                </div>
              ) : filtered.map((c) => (
                <button key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); setQuery(''); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                  <p className="text-sm font-semibold text-gray-900">{c.legal_name || c.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    {c.trn && <span className="text-xs text-gray-500">TRN: {c.trn}</span>}
                    {c.city && <span className="text-xs text-gray-400">{c.city}</span>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Or skip search and fill buyer fields manually below.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Line Items Editor
// ─────────────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: 'EA', label: 'EA' }, { value: 'DAY', label: 'DAY' },
  { value: 'HUR', label: 'HUR' }, { value: 'MIN', label: 'MIN' },
  { value: 'MTR', label: 'MTR' }, { value: 'KGM', label: 'KGM' },
  { value: 'LTR', label: 'LTR' }, { value: 'PCE', label: 'PCE' },
  { value: 'SET', label: 'SET' }, { value: 'BX', label: 'BX' },
  { value: 'LS', label: 'LS' },
];

const VAT_OPTIONS = [
  { value: 'S',  label: 'S — Standard (5%)', rate: '5' },
  { value: 'Z',  label: 'Z — Zero rated',    rate: '0' },
  { value: 'E',  label: 'E — Exempt',         rate: '0' },
  { value: 'AE', label: 'AE — Reverse Charge',rate: '0' },
  { value: 'O',  label: 'O — Not subject',    rate: '0' },
];

const EMPTY_LINE: Omit<LineItem, 'id'> = {
  name: '', description: '', quantity: '1', unit: 'EA',
  unitPrice: '', vatCategory: 'S', vatRate: '5', discount: '',
};

function LineItemsEditor({ items, currency, onChange }: {
  items: LineItem[]; currency: string; onChange: (items: LineItem[]) => void;
}) {
  const addItem = () => onChange([...items, { ...EMPTY_LINE, id: crypto.randomUUID() }]);

  const removeItem = (id: string) => onChange(items.filter((i) => i.id !== id));

  const updateItem = (id: string, field: keyof LineItem, value: string) => {
    onChange(items.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'vatCategory') {
        const opt = VAT_OPTIONS.find((o) => o.value === value);
        if (opt) updated.vatRate = opt.rate;
      }
      return updated;
    }));
  };

  const { subtotal, totalVat, grandTotal } = computeTotals(items);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Package className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">No line items yet</p>
          <p className="text-xs text-gray-300 mt-1">Click "Add Line Item" to begin</p>
        </div>
      ) : items.map((item, idx) => {
        const net    = computeLineAmount(item.quantity, item.unitPrice, item.discount);
        const vatAmt = net * (parseFloat(item.vatRate) || 0) / 100;

        return (
          <div key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold text-gray-700 truncate max-w-[200px]">
                  {item.name || `Item ${idx + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {net > 0 && (
                  <span className="text-sm font-bold text-gray-900">
                    {net.toFixed(2)}
                    {vatAmt > 0 && (
                      <span className="text-xs text-blue-600 ml-1.5">+{vatAmt.toFixed(2)} VAT</span>
                    )}
                  </span>
                )}
                <button onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Fields */}
            <div className="p-4 space-y-3">
              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    placeholder="e.g. Consulting Services"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                  <input type="text" value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Optional details"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
              </div>

              {/* Qty, Unit, Price, Discount */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Qty <span className="text-red-500">*</span>
                  </label>
                  <input type="number" value={item.quantity} min="0" step="any"
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit</label>
                  <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 cursor-pointer">
                    {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <input type="number" value={item.unitPrice} min="0" step="any"
                    onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Discount</label>
                  <input type="number" value={item.discount} min="0" step="any"
                    onChange={(e) => updateItem(item.id, 'discount', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
              </div>

              {/* VAT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    VAT Category <span className="text-red-500">*</span>
                  </label>
                  <select value={item.vatCategory} onChange={(e) => updateItem(item.id, 'vatCategory', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 cursor-pointer">
                    {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">VAT Rate (%)</label>
                  <input type="number" value={item.vatRate} min="0" max="100" step="0.01"
                    onChange={(e) => updateItem(item.id, 'vatRate', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm
                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                </div>
              </div>

              {/* Line summary row */}
              {net > 0 && (
                <div className="flex items-center justify-end gap-5 pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span>Net: <span className="font-bold text-gray-900">{currency} {net.toFixed(2)}</span></span>
                  <span>VAT: <span className="font-bold text-blue-600">+{vatAmt.toFixed(2)}</span></span>
                  <span>Total: <span className="font-bold text-brand-700">{(net + vatAmt).toFixed(2)}</span></span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add item */}
      <button onClick={addItem}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl
                   border-2 border-dashed border-brand-200 text-brand-600 font-semibold text-sm
                   hover:border-brand-400 hover:bg-brand-50 transition-all">
        <Plus className="h-4 w-4" /> Add Line Item
      </button>

      {/* Totals */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-bold text-gray-700">Invoice Totals</p>
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal (ex-VAT)</span>
              <span className="font-mono">{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-blue-600">
              <span>Total VAT</span>
              <span className="font-mono">+{totalVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-brand-700 pt-2 border-t-2 border-gray-200">
              <span>Amount Due</span>
              <span className="font-mono">{currency} {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Review & Submit step
// ─────────────────────────────────────────────────────────────────────────
function ReviewStep({ values, lineItems, hasBuyer, onSubmit, isSubmitting, submitError, onBack }: {
  values: Record<string, string>; lineItems: LineItem[];
  hasBuyer: boolean;
  onSubmit: () => void; isSubmitting: boolean;
  submitError: string | null; onBack: () => void;
}) {
  const v = (id: string) => values[id] || '';
  const { subtotal, totalVat, grandTotal } = computeTotals(lineItems);
  const currency = v('IBT-005') || 'AED';

  const sections = [
    {
      title: 'Invoice Details',
      rows: [
        { label: 'Invoice Number', value: v('IBT-001') },
        { label: 'Type',           value: INV_TYPE_LABEL[v('IBT-003')] ?? v('IBT-003') },
        { label: 'Issue Date',     value: v('IBT-002') },
        { label: 'Due Date',       value: v('IBT-009') },
        { label: 'Currency',       value: v('IBT-005') },
        { label: 'Transaction',    value: v('BTAE-02') },
        { label: 'Note',           value: v('IBT-022') },
      ],
    },
    {
      title: 'Supplier',
      rows: [
        { label: 'Name',    value: v('IBT-027') },
        { label: 'TRN',     value: v('IBT-031') },
        { label: 'Address', value: [v('IBT-035'), v('IBT-037'), v('IBT-040')].filter(Boolean).join(', ') },
        { label: 'Email',   value: v('IBT-043') },
        { label: 'Phone',   value: v('IBT-042') },
      ],
    },
    {
      title: 'Buyer',
      rows: [
        { label: 'Name',    value: v('IBT-044') },
        { label: 'TRN',     value: v('IBT-048') },
        { label: 'Address', value: [v('IBT-050'), v('IBT-052'), v('IBT-055')].filter(Boolean).join(', ') },
        { label: 'Email',   value: v('IBT-058') },
        { label: 'Phone',   value: v('IBT-057') },
      ],
    },
    {
      title: 'Payment',
      rows: [
        { label: 'Terms',     value: v('IBT-081') },
        { label: 'Reference', value: v('IBT-083') },
        { label: 'IBAN',      value: v('IBT-084') },
        { label: 'Bank',      value: v('IBT-085') },
        { label: 'BIC',       value: v('IBT-086') },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">{section.title}</p>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {section.rows.filter((r) => r.value).map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500 shrink-0">{row.label}</span>
                <span className="font-medium text-gray-900 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-700">Line Items ({lineItems.length})</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {lineItems.map((item, idx) => {
            const net = computeLineAmount(item.quantity, item.unitPrice, item.discount);
            return (
              <div key={item.id} className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="text-gray-400 mr-1.5">#{idx + 1}</span>{item.name || '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.quantity} {item.unit} × {item.unitPrice} · VAT {item.vatCategory} {item.vatRate}%
                  </p>
                </div>
                <span className="text-sm font-bold font-mono text-gray-900 shrink-0">{net.toFixed(2)}</span>
              </div>
            );
          })}
          <div className="pt-3 space-y-1.5 border-t-2 border-gray-200">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span className="font-mono">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-blue-600">
              <span>Total VAT</span><span className="font-mono">+{totalVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-brand-700">
              <span>Amount Due</span>
              <span className="font-mono">{currency} {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer not linked warning */}
      {!hasBuyer && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Buyer not linked to a customer record</p>
            <p className="text-xs text-amber-600 mt-1">
              Go back to <strong>Step 3 (Buyer)</strong> and use the search to select an existing customer.
              The invoice cannot be submitted without a linked customer.
            </p>
          </div>
        </div>
      )}

      {/* ASP submit card */}
      <div className="bg-gradient-to-br from-[#0f1b35] to-[#1a3460] rounded-2xl px-6 py-6 text-white">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Send className="h-6 w-6 text-blue-300" />
          </div>
          <div>
            <h3 className="text-base font-bold">Submit to PEPPOL via ASP</h3>
            <p className="text-sm text-blue-300 mt-1">
              This invoice will be submitted to the UAE FTA PEPPOL network through your Accredited Service Provider.
              Ensure all details are correct before proceeding.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[['Standard', 'UAE PINT'], ['Network', 'PEPPOL'], ['Format', 'UBL 2.1']].map(([label, val]) => (
            <div key={label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-blue-400 uppercase tracking-wider">{label}</p>
              <p className="text-sm font-black text-white mt-0.5">{val}</p>
            </div>
          ))}
        </div>

        {submitError && (
          <div className="mb-4 rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3">
            <p className="text-sm text-red-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />{submitError}
            </p>
          </div>
        )}

        <button onClick={onSubmit} disabled={isSubmitting || !hasBuyer}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
                     bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:cursor-not-allowed
                     text-white font-bold text-sm transition-colors shadow-lg">
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Submitting to ASP…
            </>
          ) : (
            <><Send className="h-4 w-4" /> Submit Invoice to ASP</>
          )}
        </button>

        <p className="text-center text-[11px] text-blue-400/60 mt-3">
          By submitting you confirm this invoice is accurate and compliant with UAE VAT regulations.
        </p>
      </div>

      <button onClick={onBack}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                   border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Payment
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live Invoice Preview
// ─────────────────────────────────────────────────────────────────────────
function InvoicePreview({ values, lineItems, activeFieldId }: {
  values: Record<string, string>; lineItems: LineItem[]; activeFieldId: string | null;
}) {
  const hl  = (ids: string[]) => ids.includes(activeFieldId ?? '');
  const v   = (id: string)    => values[id] || '';
  const { subtotal, totalVat, grandTotal } = computeTotals(lineItems);
  const typeLabel      = INV_TYPE_LABEL[v('IBT-003')] ?? 'Tax Invoice';
  const sellerInitials = (v('IBT-027') || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const buyerInitials  = (v('IBT-044') || 'B').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hasAny = Object.values(values).some((x) => x?.trim()) || lineItems.length > 0;

  return (
    <div className="sticky top-[156px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Live Preview
        </h3>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Auto-updates</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#0f1b35] to-[#1a3460] px-5 pt-5 pb-4 text-white">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0
                ${hl(['IBT-027']) ? 'bg-yellow-400 text-yellow-900' : 'bg-white/15 text-white'}`}>
                {sellerInitials}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold leading-tight truncate ${hl(['IBT-027']) ? 'text-yellow-300' : 'text-white'}`}>
                  {v('IBT-027') || <span className="text-white/30 font-normal italic text-xs">Your company…</span>}
                </p>
                {v('IBT-031') && (
                  <p className={`text-[10px] mt-0.5 font-mono ${hl(['IBT-031']) ? 'text-yellow-300' : 'text-blue-300'}`}>
                    TRN: {v('IBT-031')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${hl(['IBT-003']) ? 'text-yellow-400' : 'text-blue-400'}`}>
                {typeLabel}
              </p>
              <p className={`text-sm font-black font-mono ${hl(['IBT-001']) ? 'text-yellow-300' : 'text-white'}`}>
                {v('IBT-001') || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <div className={`flex items-center gap-1 ${hl(['IBT-002']) ? 'text-yellow-300' : 'text-blue-300'}`}>
              <span className="text-blue-500">Issued</span>
              <span className="font-semibold">{v('IBT-002') || '—'}</span>
            </div>
            {v('IBT-009') && (
              <>
                <span className="text-white/20">·</span>
                <div className={`flex items-center gap-1 ${hl(['IBT-009']) ? 'text-yellow-300' : 'text-blue-300'}`}>
                  <span className="text-blue-500">Due</span>
                  <span className="font-semibold">{v('IBT-009')}</span>
                </div>
              </>
            )}
            <div className="ml-auto flex gap-1">
              {v('IBT-005') && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black
                  ${hl(['IBT-005']) ? 'bg-yellow-400 text-yellow-900' : 'bg-white/15 text-blue-200'}`}>
                  {v('IBT-005')}
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/30 text-emerald-300">FTA</span>
            </div>
          </div>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div className={`px-4 py-3 transition-all ${hl(['IBT-027','IBT-031','IBT-035','IBT-037']) ? 'bg-yellow-50' : 'bg-gray-50/60'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">From</p>
            <p className={`text-xs font-bold leading-tight ${hl(['IBT-027']) ? 'text-yellow-700' : 'text-gray-900'}`}>
              {v('IBT-027') || <span className="text-gray-300 font-normal italic">Seller name…</span>}
            </p>
            {v('IBT-035') && (
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                {[v('IBT-035'), v('IBT-037'), v('IBT-040')].filter(Boolean).join(', ')}
              </p>
            )}
            {v('IBT-031') && (
              <p className={`text-[10px] font-mono mt-1 ${hl(['IBT-031']) ? 'text-yellow-600' : 'text-gray-400'}`}>
                TRN: {v('IBT-031')}
              </p>
            )}
          </div>
          <div className={`px-4 py-3 transition-all ${hl(['IBT-044','IBT-048','IBT-050']) ? 'bg-yellow-50' : 'bg-white'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Bill To</p>
            {v('IBT-044') ? (
              <>
                <p className={`text-xs font-bold leading-tight ${hl(['IBT-044']) ? 'text-yellow-700' : 'text-gray-900'}`}>
                  {v('IBT-044')}
                </p>
                {v('IBT-050') && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {[v('IBT-050'), v('IBT-052'), v('IBT-055')].filter(Boolean).join(', ')}
                  </p>
                )}
                {v('IBT-048') && (
                  <p className={`text-[10px] font-mono mt-1 ${hl(['IBT-048']) ? 'text-yellow-600' : 'text-gray-400'}`}>
                    TRN: {v('IBT-048')}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-300">
                  {buyerInitials}
                </div>
                <p className="text-[10px] text-gray-300 italic">Buyer not set…</p>
              </div>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="px-4 pt-3 pb-2">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left font-black text-gray-400 uppercase tracking-wider pb-1.5">Item</th>
                <th className="text-center font-black text-gray-400 uppercase tracking-wider pb-1.5 w-10">Qty</th>
                <th className="text-right font-black text-gray-400 uppercase tracking-wider pb-1.5 w-16">Price</th>
                <th className="text-right font-black text-gray-400 uppercase tracking-wider pb-1.5 w-16">Net</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length > 0 ? lineItems.map((item) => {
                const net = computeLineAmount(item.quantity, item.unitPrice, item.discount);
                return (
                  <tr key={item.id} className="border-b border-dashed border-gray-100">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-gray-800 leading-tight">{item.name || '—'}</p>
                      {item.description && <p className="text-gray-400 text-[9px] mt-0.5">{item.description}</p>}
                      <span className="inline-block mt-0.5 px-1 py-px rounded text-[8px] font-bold bg-blue-50 text-blue-600">
                        {item.vatCategory} {item.vatRate}%
                      </span>
                    </td>
                    <td className="py-2 text-center text-gray-600">{item.quantity} {item.unit}</td>
                    <td className="py-2 text-right font-mono text-gray-600">{item.unitPrice || '—'}</td>
                    <td className="py-2 text-right font-mono font-bold text-gray-900">
                      {net > 0 ? net.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-300 italic">
                    Line items appear here…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 border bg-gray-50 border-gray-100">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Subtotal (ex-VAT)</span>
            <span className="font-mono">{subtotal > 0 ? subtotal.toFixed(2) : '—'}</span>
          </div>
          <div className="flex justify-between text-[10px] text-blue-600 mb-2">
            <span>VAT</span>
            <span className="font-mono">+{totalVat.toFixed(2)}</span>
          </div>
          <div className="border-t-2 border-gray-300 pt-2 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700">Amount Due</span>
            <span className="text-base font-black font-mono text-brand-700">
              {v('IBT-005') || 'AED'} {grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
            </span>
          </div>
          {v('IBT-081') && (
            <p className="text-[9px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
              Payment: {v('IBT-081')}
            </p>
          )}
        </div>

        {/* Note */}
        {v('IBT-022') && (
          <div className={`mx-4 mb-4 rounded-xl px-3 py-2.5 text-[10px] transition-all
            ${hl(['IBT-022']) ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-gray-50 border border-gray-100 text-gray-600'}`}>
            <span className="font-bold uppercase tracking-wider mr-1.5">Note:</span>{v('IBT-022')}
          </div>
        )}

        {/* Compliance footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">UAE PINT · PEPPOL BIS 3.0</p>
            {v('IBT-001') && <p className="text-[8px] font-mono text-gray-300 mt-0.5">{v('IBT-001')}</p>}
          </div>
          <div className="flex gap-1">
            {['UBL 2.1', 'FTA', 'VAT'].map((b) => (
              <span key={b} className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-black border border-brand-100">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!hasAny && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-5 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-200" />
          <p className="text-xs font-medium text-gray-400">Fill in the form to see preview</p>
        </div>
      )}

      {activeFieldId && (
        <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3.5 py-3">
          <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">Editing field</p>
          <p className="text-xs font-mono text-brand-600 font-semibold">{activeFieldId}</p>
          <p className="text-[11px] text-brand-500 mt-0.5 leading-snug">
            {PINT_FIELDS.find((f) => f.id === activeFieldId)?.businessTerm}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────
export default function PintCreatePage() {
  const router = useRouter();
  const { activeCompany, activeId } = useCompany();
  const [currentStep, setCurrentStep] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const [values, setValues] = useState<Record<string, string>>(() => ({
    'IBT-001':    generateInvoiceNumber(),
    'IBT-002':    today,
    'IBT-005':    'AED',
    'IBT-003':    '380',
    'BTAE-02':    'B2B',
    'IBT-031-1':  'VAT',
    'IBT-167':    'VAT',
    'IBT-040':    'AE',
    'IBT-055':    'AE',
  }));
  const [lineItems,     setLineItems]     = useState<LineItem[]>([]);
  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [showOptional,  setShowOptional]  = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [autofillDone,  setAutofillDone]  = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<Customer | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const autoFilledRef = useRef(false);
  const topRef        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCompany || autoFilledRef.current) return;
    autoFilledRef.current = true;
    setValues((prev) => ({ ...prev, ...applySellerFromCompany(activeCompany) }));
  }, [activeCompany]);

  const handleSellerRefill = useCallback(() => {
    if (!activeCompany) return;
    setValues((prev) => ({ ...prev, ...applySellerFromCompany(activeCompany) }));
  }, [activeCompany]);

  const handleBuyerSelect = useCallback((c: Customer) => {
    setSelectedBuyer(c);
    setValues((prev) => ({ ...prev, ...applyBuyerFromCustomer(c) }));
  }, []);

  const handleBuyerClear = useCallback(() => {
    setSelectedBuyer(null);
    const keys = ['IBT-044','IBT-045','IBT-047','IBT-048','IBT-049','IBT-049-1',
                   'IBT-050','IBT-052','IBT-054','IBT-055','IBT-057','IBT-058'];
    setValues((prev) => { const n = { ...prev }; keys.forEach((k) => { n[k] = ''; }); return n; });
  }, []);

  const handleChange = useCallback((id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const step         = STEPS[currentStep];
  const stepFieldIds = STEP_FIELDS[step.id] ?? [];
  const stepFields   = stepFieldIds
    .map((id) => PINT_FIELDS.find((f) => f.id === id))
    .filter(Boolean) as PintField[];
  const visibleFields   = showOptional ? stepFields : stepFields.filter((f) => f.mandatory !== 'Optional');
  const mandatoryFields = stepFields.filter((f) => f.mandatory === 'Mandatory');
  const filledMandatory = mandatoryFields.filter((f) => values[f.id]?.trim()).length;
  const stepPct         = mandatoryFields.length > 0
    ? Math.round((filledMandatory / mandatoryFields.length) * 100) : 100;
  const totalPct = Math.round(((currentStep + stepPct / 100) / STEPS.length) * 100);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const validate = (): boolean => {
    if (step.id === 'items') {
      if (lineItems.length === 0) {
        setErrors({ _items: 'Add at least one line item.' });
        return false;
      }
      const errs: Record<string, string> = {};
      lineItems.forEach((item, idx) => {
        if (!item.name.trim())      errs[`item_${idx}_name`]  = `Item ${idx + 1}: name is required`;
        if (!item.unitPrice.trim()) errs[`item_${idx}_price`] = `Item ${idx + 1}: unit price is required`;
      });
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    if (step.id === 'payment' || step.id === 'submit') return true;
    const errs: Record<string, string> = {};
    mandatoryFields.forEach((f) => {
      if (!values[f.id]?.trim()) errs[f.id] = `${f.businessTerm} is required`;
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstId = Object.keys(errs)[0];
      document.getElementById(`field-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    setErrors({});
    setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
    scrollTop();
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((s) => Math.max(0, s - 1));
    scrollTop();
  };

  const handleSubmit = async () => {
    if (!activeCompany) {
      setSubmitError('No active company selected. Go to Companies and set an active company.');
      return;
    }
    if (!selectedBuyer) {
      setSubmitError('No buyer selected. Go back to Step 3 and search for a customer to link.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // PINT code → backend enum maps
    const INV_TYPE_MAP: Record<string, string> = {
      '380': 'tax_invoice', '381': 'credit_note',
      '480': 'commercial_invoice', '875': 'continuous_supply',
    };
    const TX_TYPE_MAP: Record<string, string> = {
      'B2B': 'b2b', 'B2G': 'b2g', 'B2C': 'b2c',
    };
    const VAT_MAP: Record<string, string> = {
      'S': 'standard', 'Z': 'zero', 'E': 'exempt', 'AE': 'exempt', 'O': 'exempt',
    };

    try {
      const payload = {
        company_id:       activeCompany.id,
        customer_id:      selectedBuyer.id,
        invoice_type:     INV_TYPE_MAP[values['IBT-003']] ?? 'tax_invoice',
        transaction_type: TX_TYPE_MAP[values['BTAE-02']]  ?? 'b2b',
        issue_date:       values['IBT-002'] || new Date().toISOString().slice(0, 10),
        due_date:         values['IBT-009'] || undefined,
        currency:         values['IBT-005'] || 'AED',
        reference_number: values['IBT-001'] || '',   // user invoice number as ref
        notes:            [values['IBT-022'], values['IBT-081']].filter(Boolean).join(' | '),
        items: lineItems.map((item, idx) => ({
          item_name:    item.name,
          description:  item.description || item.name,   // backend requires non-blank
          quantity:     parseFloat(item.quantity)  || 1,
          unit:         item.unit || 'EA',
          unit_price:   parseFloat(item.unitPrice) || 0,
          vat_rate_type: VAT_MAP[item.vatCategory] ?? 'standard',
          sort_order:   idx,
        })),
      };

      await api.post('/invoices/', payload);
      router.push('/invoices');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string; details?: unknown } } };
      const msg = apiErr?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = values['IBT-005'] || 'AED';

  return (
    <div className="min-h-screen bg-gray-50" ref={topRef}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">

          {/* Row 1 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => router.push('/invoices')}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Invoices
              </button>
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-900">New PINT Invoice</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 uppercase tracking-wider">
                UAE PINT
              </span>
            </div>
            {step.id !== 'items' && step.id !== 'submit' && (
              <button onClick={() => setShowOptional((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900
                           px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                {showOptional
                  ? <Eye className="h-3.5 w-3.5 text-brand-500" />
                  : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                {showOptional ? 'All fields' : 'Required only'}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
            <div className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${totalPct}%` }} />
          </div>

          {/* Step tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {STEPS.map((s, idx) => {
              const done    = idx < currentStep;
              const current = idx === currentStep;
              const Icon    = s.icon;
              return (
                <button key={s.id}
                  onClick={() => { if (done) { setCurrentStep(idx); scrollTop(); } }}
                  disabled={idx > currentStep}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    current  ? 'bg-brand-50 text-brand-700 border border-brand-100 shadow-sm' : '',
                    done     ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer' : '',
                    !current && !done ? 'text-gray-400 cursor-not-allowed' : '',
                  ].join(' ')}>
                  {done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <Icon className={`h-3.5 w-3.5 ${current ? 'text-brand-500' : 'text-gray-300'}`} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Autofill banner */}
      {activeCompany && !autofillDone && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">
                Supplier pre-filled from <span className="font-bold">{activeCompany.name}</span>
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Name, TRN, address &amp; contact pre-populated — review Step 2 to confirm.
              </p>
            </div>
            <button onClick={() => setAutofillDone(true)}
              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-100 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

          {/* ── Left: Form ──────────────────────────────────────────────── */}
          <div className="space-y-3">

            {/* Step header */}
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                    {(() => { const Icon = step.icon; return <Icon className="h-5 w-5 text-brand-600" />; })()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Step {currentStep + 1}: {step.label}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
                {step.id !== 'items' && step.id !== 'submit' && mandatoryFields.length > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{filledMandatory} / {mandatoryFields.length} required</p>
                    <div className="w-28 bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${stepPct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                        style={{ width: `${stepPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step-specific content */}
            {step.id === 'supplier' && activeCompany && (
              <SellerCard company={activeCompany} onRefill={handleSellerRefill} />
            )}
            {step.id === 'buyer' && activeId && (
              <BuyerPicker
                activeId={activeId}
                selectedCustomer={selectedBuyer}
                onSelect={handleBuyerSelect}
                onClear={handleBuyerClear}
              />
            )}

            {step.id === 'items' ? (
              <LineItemsEditor items={lineItems} currency={currency} onChange={setLineItems} />
            ) : step.id === 'submit' ? (
              <ReviewStep
                values={values}
                lineItems={lineItems}
                hasBuyer={selectedBuyer !== null}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onBack={handleBack}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
                {visibleFields.length === 0 ? (
                  <div className="text-center py-14 text-gray-400">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                    <p className="text-sm font-medium text-gray-500">No required fields in this step.</p>
                    <button onClick={() => setShowOptional(true)}
                      className="mt-2 text-xs text-brand-600 hover:underline font-medium">
                      Show all optional fields →
                    </button>
                  </div>
                ) : visibleFields.map((field) => (
                  <div key={field.id} id={`field-${field.id}`}>
                    <FieldRenderer
                      field={field}
                      value={values[field.id] ?? ''}
                      onChange={handleChange}
                      error={errors[field.id]}
                      isActive={activeFieldId === field.id}
                      onFocus={setActiveFieldId}
                      onBlur={() => setActiveFieldId(null)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Validation errors */}
            {Object.keys(errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {Object.keys(errors).length} issue{Object.keys(errors).length > 1 ? 's' : ''} to fix
                </p>
                <ul className="space-y-1">
                  {Object.entries(errors).map(([id, msg]) => (
                    <li key={id} className="text-xs text-red-600 flex items-center gap-1.5">
                      <span className="font-mono bg-red-100 px-1 rounded">{id}</span>{msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation */}
            {step.id !== 'submit' && (
              <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                <button onClick={handleBack} disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium
                             text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="text-xs text-gray-400">Step {currentStep + 1} of {STEPS.length}</div>
                <button onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700
                             text-white text-sm font-semibold transition-colors shadow-sm">
                  {currentStep === STEPS.length - 2 ? 'Review & Submit' : 'Next'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Preview ──────────────────────────────────────────── */}
          <div>
            <InvoicePreview values={values} lineItems={lineItems} activeFieldId={activeFieldId} />
          </div>
        </div>
      </div>
    </div>
  );
}
