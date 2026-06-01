'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Clock, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OCRDocument {
  id: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'reviewed';
  error_detail: string;
  created_at: string;
  processing_duration_ms: number | null;
  linked_invoice_id: string | null;
  result: OCRResult | null;
}

interface OCRResult {
  supplier_name: string;
  supplier_trn: string;
  customer_name: string;
  customer_trn: string;
  invoice_number: string;
  issue_date: string | null;
  total_amount: number | null;
  total_vat: number | null;
  currency: string;
  confidence: {
    overall: number;
    supplier_trn: number;
    customer_trn: number;
    amounts: number;
  };
  warnings: string[];
  needs_review: boolean;
  is_reviewed: boolean;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  uploaded:   { label: 'Queued',     color: 'bg-gray-100 text-gray-600',  icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700',  icon: RefreshCw },
  completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'bg-red-100 text-red-700',    icon: XCircle },
  reviewed:   { label: 'Reviewed',   color: 'bg-purple-100 text-purple-700', icon: Eye },
};

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`font-semibold ${color}`}>{pct}%</span>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── OCR Result Modal ──────────────────────────────────────────────────────────

function OCRResultModal({ doc, onClose }: { doc: OCRDocument; onClose: () => void }) {
  const r = doc.result;
  if (!r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Extracted Data — {doc.original_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Confidence */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-4 gap-3">
            {[
              ['Overall', r.confidence.overall],
              ['Supplier TRN', r.confidence.supplier_trn],
              ['Customer TRN', r.confidence.customer_trn],
              ['Amounts', r.confidence.amounts],
            ].map(([label, val]) => (
              <div key={label as string} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{label as string}</div>
                <ConfidenceBadge score={val as number} />
              </div>
            ))}
          </div>

          {/* Warnings */}
          {r.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-yellow-700 font-medium text-sm mb-2">
                <AlertTriangle className="w-4 h-4" /> Warnings
              </div>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-blue-700 uppercase mb-2">Supplier</h3>
              <p className="text-sm font-medium text-gray-900">{r.supplier_name || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">TRN: {r.supplier_trn || '—'}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-green-700 uppercase mb-2">Customer</h3>
              <p className="text-sm font-medium text-gray-900">{r.customer_name || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">TRN: {r.customer_trn || '—'}</p>
            </div>
          </div>

          {/* Invoice fields */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              ['Invoice #', r.invoice_number],
              ['Issue Date', r.issue_date],
              ['Currency', r.currency],
              ['Total Amount', r.total_amount ? `${r.currency} ${r.total_amount.toFixed(2)}` : '—'],
              ['VAT', r.total_vat ? `${r.currency} ${r.total_vat.toFixed(2)}` : '—'],
              ['Needs Review', r.needs_review ? 'Yes' : 'No'],
            ].map(([label, val]) => (
              <div key={label as string} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{label as string}</div>
                <div className="font-medium text-gray-900">{val || '—'}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          {r.line_items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Line Items ({r.line_items.length})</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.line_items.map((li, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{li.description}</td>
                        <td className="px-3 py-2 text-gray-600">{li.quantity}</td>
                        <td className="px-3 py-2 text-gray-600">{li.unit_price?.toFixed(2)}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{li.line_total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document Row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onRetry, onView }: {
  doc: OCRDocument;
  onRetry: (id: string) => void;
  onView: (doc: OCRDocument) => void;
}) {
  const cfg = STATUS_CONFIG[doc.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.original_name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-400">{formatBytes(doc.file_size_bytes)}</span>
          <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
          {doc.result && (
            <span className="text-xs text-gray-400">
              Confidence: <ConfidenceBadge score={doc.result.confidence.overall} />
            </span>
          )}
        </div>
        {doc.error_detail && (
          <p className="text-xs text-red-500 mt-1 truncate">{doc.error_detail}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
          <StatusIcon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
          {cfg.label}
        </span>

        {doc.status === 'completed' && doc.result && (
          <button
            onClick={() => onView(doc)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            View
          </button>
        )}

        {doc.status === 'failed' && (
          <button
            onClick={() => onRetry(doc.id)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium px-2.5 py-1 rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }}
      />
      <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} />
      <p className="text-sm font-medium text-gray-700">
        Drag & drop your invoice here, or <span className="text-blue-600">browse</span>
      </p>
      <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG up to 25 MB</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => api.get(url).then(r => r.data.data);

export default function AIocrPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<OCRDocument | null>(null);
  const { data, isLoading } = useSWR('/ocr/', fetcher, { refreshInterval: 5000 });

  const docs: OCRDocument[] = data?.results ?? [];

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/ocr/upload/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      mutate('/ocr/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg || 'Upload failed. Check file type and size.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRetry(id: string) {
    try {
      await api.post(`/ocr/${id}/retry/`);
      mutate('/ocr/');
    } catch {
      // silently swallow; user can try again
    }
  }

  const stats = {
    total:     docs.length,
    completed: docs.filter(d => d.status === 'completed' || d.status === 'reviewed').length,
    processing: docs.filter(d => d.status === 'processing' || d.status === 'uploaded').length,
    failed:    docs.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Document Scanner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload PDF or image invoices — AI extracts supplier, customer, amounts, and line items automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700' },
          { label: 'Completed', value: stats.completed, color: 'text-green-600' },
          { label: 'Processing', value: stats.processing, color: 'text-blue-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Upload Invoice Document</h2>
        {uploading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-blue-600">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Uploading and queuing for AI extraction…</span>
          </div>
        ) : (
          <UploadZone onUpload={handleUpload} />
        )}
        {uploadError && (
          <p className="text-sm text-red-500 mt-3 text-center">{uploadError}</p>
        )}
      </div>

      {/* Document list */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Scanned Documents</h2>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents yet. Upload your first invoice above.</p>
          </div>
        ) : (
          <div>
            {docs.map(doc => (
              <DocRow
                key={doc.id}
                doc={doc}
                onRetry={handleRetry}
                onView={setViewDoc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Result modal */}
      {viewDoc && (
        <OCRResultModal doc={viewDoc} onClose={() => setViewDoc(null)} />
      )}
    </div>
  );
}
