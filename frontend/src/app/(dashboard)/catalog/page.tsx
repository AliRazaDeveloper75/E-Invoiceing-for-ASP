'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import {
  Package, Plus, X, Pencil, Trash2, Globe, Building2, AlertTriangle,
  Upload, Download, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';

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

async function fetcher(url: string) {
  const r = await api.get<{ success: boolean; data: Product[] }>(url);
  return r.data.data ?? [];
}

// ─── Excel template + parser ──────────────────────────────────────────────────

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
          if (!name && !price) return; // skip blank rows
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

// ─── Add / Edit form ────────────────────────────────────────────────────────

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-800">
          {mode === 'create' ? 'New Catalog Item' : `Edit — ${initial?.name}`}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
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
        <div className="grid grid-cols-3 gap-4">
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
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...register('is_global')} />
            Make this a <strong>global</strong> item (visible to all companies)
          </label>
        )}

        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{mode === 'create' ? 'Add Item' : 'Save'}</Button>
        </div>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { user } = useAuth();
  const { activeId } = useCompany();
  const isAdmin = user?.role === 'admin';

  const key = activeId ? `/invoices/products/?company_id=${activeId}` : '/invoices/products/';
  const { data: products = [], mutate } = useSWR<Product[]>(key, fetcher);

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
    setUpload({ status: 'busy', msg: 'Reading file…' });
    const { rows, errors } = await parseCatalogExcel(file);
    e.target.value = '';

    if (!rows.length) {
      setUpload({ status: 'error', msg: errors[0] ?? 'No valid rows found.' });
      return;
    }

    // Admin uploads → global catalog; company users → their company.
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
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-md">
            Saved items suppliers can pick when creating invoices. Global items are shown to all companies.
          </p>
        </div>
        {!panel && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={downloadCatalogTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download Sample</span><span className="sm:hidden">Sample</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.status === 'busy'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {upload.status === 'busy' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
            <Button onClick={() => { setEditTarget(null); setPanel('create'); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
        )}
      </div>

      {upload.status === 'done' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {upload.msg}
        </div>
      )}
      {upload.status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {upload.msg}
        </div>
      )}

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="h-10 w-10 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No catalog items yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first product to speed up invoicing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Unit Price</th>
                <th className="px-5 py-3">VAT</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>}
                  </td>
                  <td className="px-5 py-3 font-mono text-gray-700">{p.unit_price}{p.unit ? ` / ${p.unit}` : ''}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{p.vat_rate_type.replace('_', ' ')}</td>
                  <td className="px-5 py-3">
                    {p.scope === 'global' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        <Globe className="h-3 w-3" /> Global
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        <Building2 className="h-3 w-3" /> Company
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit(p) ? (
                        <>
                          <button onClick={() => { setEditTarget(p); setPanel('edit'); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDelTarget(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300">Read-only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
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
              <button onClick={() => setDelTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
              <button onClick={confirmDelete}
                className="px-5 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
