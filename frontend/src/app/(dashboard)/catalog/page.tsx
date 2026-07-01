'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/context/AuthContext';
import { Input, Select } from '@/components/ui/Input';
import { AnimatedSection } from '@/app/(landing)/AnimatedSection';
import {
  Package, Plus, X, Pencil, Trash2, Globe, Building2, AlertTriangle,
  Upload, Download, RefreshCw, CheckCircle2, Loader2, Tag,
} from 'lucide-react';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { clsx } from 'clsx';

interface Product {
  id: string;
  name: string;
  description: string;
  unit_price: string;
  vat_rate_type: string;
  unit: string;
  scope: 'global' | 'company';
}

interface ProductForm {
  name: string;
  description: string;
  unit_price: string;
  vat_rate_type: string;
  unit: string;
  is_global: boolean;
}

const VAT_OPTIONS = [
  { value: 'standard', label: 'Standard 5% (S)' },
  { value: 'zero', label: 'Zero Rate 0% (Z)' },
  { value: 'exempt', label: 'Exempt (E)' },
  { value: 'out_of_scope', label: 'Out of Scope (O)' },
];

const VAT_PILLS: Record<string, string> = {
  standard: 'bg-blue-50 text-blue-700 border-blue-200',
  zero: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  exempt: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_scope: 'bg-gray-100 text-gray-600 border-gray-200',
};

async function fetcher(url: string) {
  const r = await api.get<{ success: boolean; data: Product[] }>(url);
  return r.data.data ?? [];
}

const EXCEL_HEADERS = [
  'Name *', 'Description', 'Unit Price *', 'VAT Rate (standard/zero/exempt/out_of_scope)', 'Unit (pcs/hr/kg)',
];
const EXCEL_SAMPLE = [
  ['IT Consulting Services', 'Monthly IT support and consulting', '1000.00', 'standard', 'hr'],
  ['Office Chair', 'Ergonomic high-back chair', '500.00', 'standard', 'pcs'],
  ['Software License', 'Annual SaaS subscription', '2500.00', 'standard', 'yr'],
];

function downloadCatalogTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...EXCEL_SAMPLE]);
  ws['!cols'] = [28, 35, 16, 42, 16].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalog Items');
  XLSX.writeFile(wb, 'e-numerak-catalog-template.xlsx');
}

interface ParsedRow {
  name: string; description: string; unit_price: string; vat_rate_type: string; unit: string;
}

function parseCatalogExcel(file: File): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (raw.length < 2) { resolve({ rows: [], errors: ['No data rows found below the header.'] }); return; }

        const rows: ParsedRow[] = [];
        const errors: string[] = [];
        const validVat = ['standard', 'zero', 'exempt', 'out_of_scope'];
        raw.slice(1).forEach((r, i) => {
          const name = String(r[0] ?? '').trim();
          const price = String(r[2] ?? '').trim();
          if (!name && !price) return;
          const rowNum = i + 2;
          if (!name) { errors.push(`Row ${rowNum}: Name is missing.`); return; }
          if (!price || isNaN(parseFloat(price))) { errors.push(`Row ${rowNum}: Unit Price is missing/invalid.`); return; }
          const vat = String(r[3] ?? '').trim().toLowerCase() || 'standard';
          rows.push({
            name: name.slice(0, 150),
            description: String(r[1] ?? '').trim().slice(0, 500),
            unit_price: parseFloat(price).toFixed(2),
            vat_rate_type: validVat.includes(vat) ? vat : 'standard',
            unit: String(r[4] ?? '').trim().slice(0, 12),
          });
        });
        resolve({ rows, errors });
      } catch {
        resolve({ rows: [], errors: ['Could not read the file. Use a valid .xlsx or .csv.'] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function ProductFormPanel({
  mode, initial, isAdmin, activeId, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: Product;
  isAdmin: boolean;
  activeId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      unit_price: initial?.unit_price ?? '',
      vat_rate_type: initial?.vat_rate_type ?? 'standard',
      unit: initial?.unit ?? '',
      is_global: initial?.scope === 'global',
    },
  });

  const onSubmit = async (data: ProductForm) => {
    setServerError('');
    try {
      const payload = {
        name: data.name,
        description: data.description,
        unit_price: data.unit_price,
        vat_rate_type: data.vat_rate_type,
        unit: data.unit,
        ...(mode === 'create'
          ? (data.is_global && isAdmin ? { is_global: true } : { company_id: activeId })
          : {}),
      };
      if (mode === 'create') await api.post('/invoices/products/', payload);
      else await api.put(`/invoices/products/${initial!.id}/`, payload);
      onSaved();
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setServerError(e.response?.data?.error?.message ?? `Failed to ${mode} product.`);
    }
  };

  return (
    <AnimatedSection>
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              {mode === 'create' ? 'New Catalog Item' : `Edit — ${initial?.name}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Item / Service Name" required
            placeholder="e.g. IT Consulting"
            error={errors.name?.message}
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'At least 2 characters' },
              maxLength: { value: 150, message: 'Max 150 characters' },
            })}
          />
          <Input
            label="Description"
            placeholder="Optional description"
            error={errors.description?.message}
            {...register('description', { maxLength: { value: 500, message: 'Max 500 characters' } })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Unit Price (excl. VAT)" required
              type="number" step="0.01" min="0" placeholder="0.00"
              error={errors.unit_price?.message}
              {...register('unit_price', {
                required: 'Required',
                validate: (v) => parseFloat(v) >= 0 || 'Cannot be negative',
              })}
            />
            <Select label="VAT Rate" {...register('vat_rate_type')}>
              {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Input label="Unit" placeholder="pcs / hr / kg" maxLength={12} {...register('unit')} />
          </div>

          {isAdmin && mode === 'create' && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                {...register('is_global')} />
              Make this a <strong>global</strong> item (visible to all companies)
            </label>
          )}

          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {mode === 'create' ? 'Add Item' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </AnimatedSection>
  );
}

export default function CatalogPage() {
  const { user } = useAuth();
  const { activeId, activeCompany } = useCompany();
  const isAdmin = user?.role === 'admin';

  const key = activeId ? `/invoices/products/?company_id=${activeId}` : '/invoices/products/';
  const { data: products = [], mutate, isLoading } = useSWR<Product[]>(key, fetcher);

  const [panel, setPanel] = useState<null | 'create' | 'edit'>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [delTarget, setDelTarget] = useState<Product | null>(null);
  const [upload, setUpload] = useState<{ status: 'idle' | 'busy' | 'done' | 'error'; msg: string }>({ status: 'idle', msg: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  async function confirmDelete() {
    if (!delTarget) return;
    try { await api.delete(`/invoices/products/${delTarget.id}/`); mutate(); }
    finally { setDelTarget(null); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpload({ status: 'busy', msg: 'Reading file\u2026' });
    const { rows, errors } = await parseCatalogExcel(file);
    e.target.value = '';

    if (!rows.length) {
      setUpload({ status: 'error', msg: errors[0] ?? 'No valid rows found.' });
      return;
    }

    let ok = 0; let failed = 0;
    for (const row of rows) {
      try {
        await api.post('/invoices/products/', {
          ...row,
          ...(isAdmin ? { is_global: true } : { company_id: activeId }),
        });
        ok++;
      } catch { failed++; }
    }
    mutate();
    setUpload({
      status: failed ? 'error' : 'done',
      msg: `${ok} item${ok !== 1 ? 's' : ''} imported${failed ? `, ${failed} failed` : ''}${errors.length ? ` (${errors.length} rows skipped)` : ''}.`,
    });
    setTimeout(() => setUpload({ status: 'idle', msg: '' }), 6000);
  }

  const canEdit = (p: Product) => p.scope === 'company' || isAdmin;

  return (
    <div className="space-y-6">

      {/* ── Header card ── */}
      <AnimatedSection>
        <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Catalog</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Product Catalog</h1>
              <p className="text-sm text-blue-200/60 mt-0.5 max-w-md">
                Saved items suppliers can pick when creating invoices
              </p>
            </div>
            {!panel && (
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={downloadCatalogTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-medium text-blue-200 hover:text-white hover:bg-white/20 transition-all"
                >
                  <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download Sample</span><span className="sm:hidden">Sample</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.status === 'busy'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-blue-200 hover:text-white hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  {upload.status === 'busy' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Excel
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
                <button
                  onClick={() => { setEditTarget(null); setPanel('create'); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <Plus className="h-4 w-4" /> Add Item
                </button>
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>

      {/* Upload status banners */}
      {(upload.status === 'done' || upload.status === 'error') && (
        <AnimatedSection>
          <div className={clsx(
            'flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm shadow-lg',
            upload.status === 'done'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100/30'
              : 'bg-red-50 border-red-200 text-red-700 shadow-red-100/20',
          )}>
            {upload.status === 'done'
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {upload.msg}
          </div>
        </AnimatedSection>
      )}

      {/* Add / Edit form */}
      {panel && (
        <ProductFormPanel
          mode={panel}
          initial={editTarget ?? undefined}
          isAdmin={isAdmin}
          activeId={activeId}
          onClose={() => setPanel(null)}
          onSaved={() => mutate()}
        />
      )}

      {/* ── Table Card ── */}
      <AnimatedSection delay={80}>
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">All Items</h2>
            {products.length > 0 && (
              <span className="text-xs text-gray-400 font-medium ml-auto">{products.length} item{products.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Package className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-base font-semibold text-gray-900">No catalog items yet</p>
              <p className="text-sm text-gray-500 mt-1">Add your first product to speed up invoicing.</p>
              <button
                onClick={() => { setEditTarget(null); setPanel('create'); }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {products.map((p) => (
                  <div key={p.id} className="px-5 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                        {p.description && <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>}
                      </div>
                      <span className={clsx(
                        'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ml-2 shrink-0',
                        VAT_PILLS[p.vat_rate_type],
                      )}>
                        {p.vat_rate_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900">{p.unit_price}</span>
                        {p.unit && <span className="text-xs text-gray-400">/ {p.unit}</span>}
                        <span className={clsx(
                          'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1',
                          p.scope === 'global'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200',
                        )}>
                          {p.scope === 'global' ? <Globe className="h-2.5 w-2.5" /> : <Building2 className="h-2.5 w-2.5" />}
                          {p.scope === 'global' ? 'Global' : 'Local'}
                        </span>
                      </div>
                      {canEdit(p) && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditTarget(p); setPanel('edit'); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDelTarget(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50/60 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-950 to-indigo-950">
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Unit Price</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">VAT</th>
                      <th className="px-5 py-4 text-left text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Scope</th>
                      <th className="px-5 py-4 text-right text-[11px] font-semibold text-blue-200 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p, idx) => (
                      <tr
                        key={p.id}
                        className={clsx(
                          'transition-all duration-200',
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                          'hover:bg-blue-50/30 hover:shadow-inner',
                        )}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          {p.description && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{p.description}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono font-bold text-gray-900">{p.unit_price}</span>
                          {p.unit && <span className="text-gray-400 text-xs"> / {p.unit}</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={clsx(
                            'inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-md border',
                            VAT_PILLS[p.vat_rate_type],
                          )}>
                            {p.vat_rate_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {p.scope === 'global' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                              <Globe className="h-3 w-3" /> Global
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200/60">
                              <Building2 className="h-3 w-3" /> Company
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit(p) ? (
                              <>
                                <button
                                  onClick={() => { setEditTarget(p); setPanel('edit'); }}
                                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDelTarget(p)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50/60 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-gray-300 font-medium px-2">Read-only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </AnimatedSection>

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDelTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">Delete Item</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Remove <span className="font-semibold text-gray-700">{delTarget.name}</span> from the catalog?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setDelTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
