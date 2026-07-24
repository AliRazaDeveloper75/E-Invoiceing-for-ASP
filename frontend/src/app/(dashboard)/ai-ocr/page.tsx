'use client';

import { useState, useCallback, useRef } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import {
  Upload, FileText, CheckCircle, XCircle, Clock, RefreshCw, Eye, AlertTriangle,
  ScanLine, Loader2, ChevronRight, ArrowUpRight, Zap,
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  uploaded:   { label: 'Queued',     color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200', icon: Clock },
  processing: { label: 'Processing', color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200', icon: RefreshCw },
  completed:  { label: 'Completed',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200', icon: XCircle },
  reviewed:   { label: 'Reviewed',   color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200', icon: Eye },
};

const STAT_CARDS = [
  { label: 'Total Uploads', key: 'total' as const,       icon: FileText,    color: 'blue' },
  { label: 'Completed',     key: 'completed' as const,    icon: CheckCircle, color: 'emerald' },
  { label: 'Processing',    key: 'processing' as const,   icon: RefreshCw,   color: 'blue' },
  { label: 'Failed',        key: 'failed' as const,       icon: XCircle,     color: 'red' },
];

const STAT_GRADIENTS: Record<string, string> = {
  blue:    'from-blue-400 to-blue-600',
  emerald: 'from-emerald-400 to-emerald-500',
  red:     'from-red-400 to-red-600',
};

const STAT_SHADOWS: Record<string, string> = {
  blue:    'shadow-blue-500/25',
  emerald: 'shadow-emerald-500/25',
  red:     'shadow-red-500/25',
};

const STAT_TEXT: Record<string, string> = {
  blue:    'text-blue-600',
  emerald: 'text-emerald-600',
  red:     'text-red-600',
};

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-sm font-bold',
      pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600',
    )}>
      <span className={clsx(
        'h-1.5 w-1.5 rounded-full',
        pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500',
      )} />
      {pct}%
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OCRResultModal({ doc, onClose }: { doc: OCRDocument; onClose: () => void }) {
  const r = doc.result;
  if (!r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100/60 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <ScanLine className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">Extracted Data</h2>
              <p className="text-xs text-gray-400 truncate">{doc.original_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors shrink-0">
            <XCircle className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Confidence */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border border-blue-100/40 p-4 grid grid-cols-4 gap-3">
            {([
              ['Overall', r.confidence.overall],
              ['Supplier TRN', r.confidence.supplier_trn],
              ['Customer TRN', r.confidence.customer_trn],
              ['Amounts', r.confidence.amounts],
            ] as const).map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="text-[11px] text-gray-500 font-medium mb-1">{label}</p>
                <ConfidenceBadge score={val} />
              </div>
            ))}
          </div>

          {/* Warnings */}
          {r.warnings.length > 0 && (
            <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-4">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" /> Warnings
              </div>
              <ul className="space-y-1">
                {r.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-gradient-to-br from-blue-50/80 to-blue-50/30 border border-blue-200/60 p-4">
              <h3 className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider mb-2">Supplier</h3>
              <p className="text-sm font-semibold text-gray-900">{r.supplier_name || '—'}</p>
              {r.supplier_trn && <p className="text-xs text-gray-500 mt-1 font-mono">TRN: {r.supplier_trn}</p>}
            </div>
            <div className="rounded-xl bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 border border-emerald-200/60 p-4">
              <h3 className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-2">Customer</h3>
              <p className="text-sm font-semibold text-gray-900">{r.customer_name || '—'}</p>
              {r.customer_trn && <p className="text-xs text-gray-500 mt-1 font-mono">TRN: {r.customer_trn}</p>}
            </div>
          </div>

          {/* Invoice fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              ['Invoice #', r.invoice_number],
              ['Issue Date', r.issue_date],
              ['Currency', r.currency],
              ['Total Amount', r.total_amount ? `${r.currency} ${r.total_amount.toFixed(2)}` : null],
              ['VAT', r.total_vat ? `${r.currency} ${r.total_vat.toFixed(2)}` : null],
              ['Needs Review', r.needs_review ? 'Yes' : 'No'],
            ] as const).map(([label, val]) => (
              <div key={label} className="rounded-xl bg-white border border-blue-100/40 p-3">
                <p className="text-[11px] text-gray-500 font-medium mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          {r.line_items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Line Items ({r.line_items.length})</h3>
              <div className="overflow-x-auto rounded-xl border border-blue-100/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 border-b border-blue-100/60">
                      {['Description', 'Qty', 'Unit Price', 'Total'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100/40">
                    {r.line_items.map((li, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/10'}>
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{li.description}</td>
                        <td className="px-3 py-2.5 text-gray-500">{li.quantity}</td>
                        <td className="px-3 py-2.5 text-gray-500 tabular-nums">{li.unit_price?.toFixed(2)}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900 tabular-nums">{li.line_total?.toFixed(2)}</td>
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

function DocRow({ doc, onRetry, onView }: {
  doc: OCRDocument;
  onRetry: (id: string) => void;
  onView: (doc: OCRDocument) => void;
}) {
  const cfg = STATUS_CONFIG[doc.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/40 transition-colors border-b border-blue-100/40 last:border-0 group">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.original_name}</p>
          {doc.result?.needs_review && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md shrink-0">
              <AlertTriangle className="h-2.5 w-2.5" /> Review
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{formatBytes(doc.file_size_bytes)}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
          {doc.result && (
            <>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                Confidence: <ConfidenceBadge score={doc.result.confidence.overall} />
              </span>
            </>
          )}
        </div>
        {doc.error_detail && (
          <p className="text-xs text-red-500 mt-1 truncate">{doc.error_detail}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={clsx(
          'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border',
          cfg.bg, cfg.color, cfg.border,
        )}>
          <StatusIcon className={clsx('h-3 w-3', doc.status === 'processing' && 'animate-spin')} />
          {cfg.label}
        </span>

        {doc.status === 'completed' && doc.result && (
          <button
            onClick={() => onView(doc)}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/60 px-2.5 py-1.5 rounded-lg transition-all"
          >
            View <ChevronRight className="h-3 w-3" />
          </button>
        )}

        {doc.status === 'failed' && (
          <button
            onClick={() => onRetry(doc.id)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50/60 hover:bg-amber-100/60 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

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
      className={clsx(
        'cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200',
        dragging
          ? 'border-blue-400 bg-blue-50/60 shadow-[0_0_20px_-8px_rgba(59,130,246,0.3)]'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/20',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }}
      />
      <div className={clsx(
        'h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-200',
        dragging
          ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/25 scale-110'
          : 'bg-gradient-to-br from-blue-50 to-blue-100',
      )}>
        <Upload className={clsx('h-7 w-7', dragging ? 'text-white' : 'text-blue-500')} />
      </div>
      <p className="text-sm font-semibold text-gray-700">
        {dragging ? 'Drop your file here' : 'Drag & drop your invoice here, or browse'}
      </p>
      <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG up to 25 MB</p>
    </div>
  );
}

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
      // silently swallow
    }
  }

  const stats = {
    total:     docs.length,
    completed: docs.filter(d => d.status === 'completed' || d.status === 'reviewed').length,
    processing: docs.filter(d => d.status === 'processing' || d.status === 'uploaded').length,
    failed:    docs.filter(d => d.status === 'failed').length,
  };

  const statValues = [stats.total, stats.completed, stats.processing, stats.failed];

  return (
    <RoleGuard allowedRoles={['admin', 'accountant']}>
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-950 to-indigo-950 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <ScanLine className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300/70 uppercase tracking-[0.12em]">AI Scanner</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Document Scanner</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">
              Upload PDF or image invoices — AI extracts supplier, customer, amounts, and line items automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.key}
            className={clsx(
              'group relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-5',
              'shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_-8px_rgba(59,130,246,0.2),0_2px_6px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-[3px] transition-all duration-300',
              'before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className={clsx('text-2xl font-bold tracking-tight mt-1.5', STAT_TEXT[card.color])}>
                  {statValues[i] ?? 0}
                </p>
              </div>
              <div className={clsx(
                'h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg',
                STAT_GRADIENTS[card.color], STAT_SHADOWS[card.color],
              )}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className={clsx(
              'absolute inset-x-3 bottom-0 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left',
              `bg-gradient-to-r ${STAT_GRADIENTS[card.color]}`,
            )} />
          </div>
        ))}
      </div>

      {/* ── Upload Card ──────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-6 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Upload className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Upload Invoice Document</h2>
        </div>
        {uploading ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 animate-pulse">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Uploading & processing…</p>
              <p className="text-xs text-gray-400 mt-0.5">Queuing for AI extraction</p>
            </div>
          </div>
        ) : (
          <UploadZone onUpload={handleUpload} />
        )}
        {uploadError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50/80 border border-red-200/60 rounded-xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {uploadError}
          </div>
        )}
      </div>

      {/* ── Document List ────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] overflow-hidden relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-blue-100/60">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Scanned Documents</h2>
          {docs.length > 0 && (
            <span className="text-xs text-gray-400 font-medium ml-auto">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-blue-400" />
            </div>
            <p className="text-base font-semibold text-gray-900">No documents yet</p>
            <p className="text-sm text-gray-500 mt-1">Upload your first invoice above to get started.</p>
          </div>
        ) : (
          <div>
            {docs.map((doc) => (
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
    </RoleGuard>
  );
}
