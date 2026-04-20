'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import { Plus, Trash2, CheckCircle2, ArrowLeft, Send } from 'lucide-react';

interface LineItem {
  line_number: number;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate: string;
}

const DEFAULT_ITEM = (): LineItem => ({
  line_number: 1,
  description: '',
  quantity: '1',
  unit: 'EA',
  unit_price: '',
  vat_rate: '5.00',
});

function calcItem(item: LineItem) {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unit_price) || 0;
  const vat = parseFloat(item.vat_rate) || 0;
  const subtotal = qty * price;
  const vatAmt = subtotal * (vat / 100);
  return { subtotal, vatAmt, total: subtotal + vatAmt };
}

export default function SubmitInvoicePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    supplier_invoice_number: '',
    invoice_type: 'tax_invoice',
    transaction_type: 'b2b',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    currency: 'AED',
    purchase_order_ref: '',
    contract_ref: '',
    notes: '',
  });

  const [items, setItems] = useState<LineItem[]>([DEFAULT_ITEM()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; number: string } | null>(null);

  // ── Derived totals ───────────────────────────────────────────────────────────
  const totals = items.reduce(
    (acc, item) => {
      const { subtotal, vatAmt, total } = calcItem(item);
      return {
        subtotal: acc.subtotal + subtotal,
        vat: acc.vat + vatAmt,
        total: acc.total + total,
      };
    },
    { subtotal: 0, vat: 0, total: 0 }
  );

  // ── Items helpers ────────────────────────────────────────────────────────────
  const addItem = () =>
    setItems((prev) => [...prev, { ...DEFAULT_ITEM(), line_number: prev.length + 1 }]);

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, line_number: idx + 1 })));

  const updateItem = (i: number, field: keyof LineItem, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (items.some((it) => !it.description || !it.unit_price)) {
      setError('All line items must have a description and unit price.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        due_date: form.due_date || null,
        subtotal: totals.subtotal.toFixed(2),
        total_vat: totals.vat.toFixed(2),
        total_amount: totals.total.toFixed(2),
        items: items.map((it) => ({
          line_number: it.line_number,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        })),
      };

      const res = await api.post('/inbound/portal/submit/', payload);
      setSuccess({
        id: res.data.data.inbound_invoice_id,
        number: res.data.data.supplier_invoice_number,
      });
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
      const details = e.response?.data?.error?.details;
      if (details) {
        setError(Object.entries(details).map(([k, v]) => `${k}: ${v[0]}`).join(' | '));
      } else {
        setError(e.response?.data?.error?.message ?? 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Invoice submitted!</h1>
        <p className="text-gray-500 text-sm">
          Invoice <span className="font-semibold text-gray-700">{success.number}</span> has been
          received and queued for validation. You will be notified by email if any issues are found.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/supplier-portal/invoices')}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
          >
            View My Invoices
          </button>
          <button
            onClick={() => { setSuccess(null); setItems([DEFAULT_ITEM()]); setForm(f => ({ ...f, supplier_invoice_number: '' })); }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Invoice</h1>
          <p className="text-gray-500 text-sm mt-0.5">Fill in the invoice details and add line items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Invoice Header ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Invoice Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.supplier_invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, supplier_invoice_number: e.target.value }))}
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option>AED</option><option>USD</option><option>EUR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
              <select
                value={form.invoice_type}
                onChange={(e) => setForm((f) => ({ ...f, invoice_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="tax_invoice">Tax Invoice</option>
                <option value="simplified">Simplified Invoice</option>
                <option value="credit_note">Credit Note</option>
                <option value="commercial_invoice">Commercial Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <select
                value={form.transaction_type}
                onChange={(e) => setForm((f) => ({ ...f, transaction_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="b2b">B2B</option>
                <option value="b2g">B2G</option>
                <option value="b2c">B2C</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.issue_date}
                onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Reference</label>
              <input
                value={form.purchase_order_ref}
                onChange={(e) => setForm((f) => ({ ...f, purchase_order_ref: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract Ref</label>
              <input
                value={form.contract_ref}
                onChange={(e) => setForm((f) => ({ ...f, contract_ref: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* ── Line Items ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Line Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_80px_60px_120px_80px_36px] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Unit Price</span>
            <span>VAT %</span>
            <span />
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const { subtotal, vatAmt, total } = calcItem(item);
              return (
                <div key={i} className="space-y-1">
                  <div className="grid grid-cols-[2fr_80px_60px_120px_80px_36px] gap-2 items-center">
                    <input
                      required
                      value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      required
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(i, 'unit', e.target.value)}
                      placeholder="EA"
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={item.unit_price}
                      onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={item.vat_rate}
                      onChange={(e) => updateItem(i, 'vat_rate', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Row totals */}
                  {item.unit_price && (
                    <div className="text-xs text-gray-400 pl-1">
                      Subtotal: {subtotal.toFixed(2)} | VAT: {vatAmt.toFixed(2)} | Total: <span className="font-semibold text-gray-600">{total.toFixed(2)} {form.currency}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grand totals */}
          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <div className="space-y-1 text-sm min-w-[220px]">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{totals.subtotal.toFixed(2)} {form.currency}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT</span>
                <span>{totals.vat.toFixed(2)} {form.currency}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1">
                <span>Total</span>
                <span>{totals.total.toFixed(2)} {form.currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Error & Submit ───────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting…' : 'Submit Invoice'}
          </button>
        </div>

      </form>
    </div>
  );
}
