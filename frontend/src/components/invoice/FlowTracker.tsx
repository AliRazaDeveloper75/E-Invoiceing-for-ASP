'use client';

import { clsx } from 'clsx';
import {
  FileText,
  ShieldCheck,
  Send,
  Inbox,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from 'lucide-react';
import type { CornerFlowState, CornerFlowStatus } from '@/types';

// ─── Step Icons + generic labels ────────────────────────────────────────────
// We intentionally present a neutral, status-oriented progress view here and do
// NOT expose the underlying transmission architecture (corners / network / ASP).

const STEP_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: FileText,
  2: ShieldCheck,
  3: Send,
  4: Inbox,
  5: CheckCircle2,
};

const STEP_LABELS: Record<number, string> = {
  1: 'Created',
  2: 'Validated',
  3: 'Sent',
  4: 'Delivered',
  5: 'Reported',
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON_COLOR: Record<CornerFlowStatus, string> = {
  idle:       'text-gray-300',
  processing: 'text-blue-500',
  complete:   'text-emerald-500',
  error:      'text-red-500',
};

const STATUS_BADGE: Record<CornerFlowStatus, { label: string; className: string }> = {
  idle:       { label: 'Waiting',    className: 'bg-gray-100 text-gray-400' },
  processing: { label: 'In Progress',className: 'bg-blue-100 text-blue-600' },
  complete:   { label: 'Complete',   className: 'bg-emerald-100 text-emerald-700' },
  error:      { label: 'Failed',     className: 'bg-red-100 text-red-700' },
};

function StatusIcon({ status }: { status: CornerFlowStatus }) {
  const cls = clsx('h-5 w-5', STATUS_ICON_COLOR[status]);
  if (status === 'complete')   return <CheckCircle2 className={cls} />;
  if (status === 'error')      return <XCircle className={cls} />;
  if (status === 'processing') return <Loader2 className={clsx(cls, 'animate-spin')} />;
  return <Circle className={clsx(cls)} />;
}

function formatTimestamp(ts: string): string {
  if (!ts) return '';
  try {
    return new Intl.DateTimeFormat('en-AE', {
      month: 'short',
      day:   'numeric',
      hour:  '2-digit',
      minute:'2-digit',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

function genericStatusMessage(corner: CornerFlowState): string {
  const label = STEP_LABELS[corner.corner] ?? corner.label;
  switch (corner.status) {
    case 'complete':   return 'Invoice fully processed.';
    case 'error':      return `There was a problem at the “${label}” step.`;
    case 'processing': return `${label} in progress…`;
    default:           return `Next step: ${label}.`;
  }
}

// ─── Corner Card ──────────────────────────────────────────────────────────────

function CornerCard({ corner, isLast }: { corner: CornerFlowState; isLast: boolean }) {
  const Icon = STEP_ICONS[corner.corner] ?? FileText;
  const label = STEP_LABELS[corner.corner] ?? corner.label;
  const badge = STATUS_BADGE[corner.status];
  const ts = formatTimestamp(corner.timestamp);
  const { status } = corner;

  return (
    <div className="flex items-start flex-1 min-w-0">
      {/* Step (icon + labels) */}
      <div className="flex flex-col items-center w-full">
        {/* Circle */}
        <div
          className={clsx(
            'relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300',
            status === 'complete'   && 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-200',
            status === 'processing' && 'bg-white text-blue-600 border-2 border-blue-500 ring-4 ring-blue-100',
            status === 'error'      && 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-200',
            status === 'idle'       && 'bg-gray-100 text-gray-400 border border-gray-200',
          )}
        >
          {status === 'complete'
            ? <Check className="h-5 w-5" strokeWidth={3} />
            : status === 'error'
            ? <XCircle className="h-5 w-5" />
            : <Icon className="h-5 w-5" />}

          {/* Live pulse on the current step */}
          {status === 'processing' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
          )}
        </div>

        {/* Labels */}
        <div className="mt-2.5 text-center px-1">
          <p className={clsx(
            'text-xs font-semibold leading-tight',
            status === 'idle' ? 'text-gray-400' : 'text-gray-800',
          )}>
            {label}
          </p>
          <p className={clsx(
            'text-[10px] font-medium mt-0.5',
            status === 'complete'   ? 'text-emerald-600' :
            status === 'processing' ? 'text-blue-600' :
            status === 'error'      ? 'text-red-600' : 'text-gray-400',
          )}>
            {badge.label}
          </p>
          {ts && <p className="text-[10px] text-gray-300 mt-0.5">{ts}</p>}
        </div>
      </div>

      {/* Connector — fills as the flow progresses */}
      {!isLast && (
        <div className="flex-1 mt-6 px-1">
          <div className={clsx(
            'h-1 w-full rounded-full transition-colors duration-500',
            status === 'complete' ? 'bg-emerald-400' :
            status === 'error'    ? 'bg-red-300' : 'bg-gray-200',
          )} />
        </div>
      )}
    </div>
  );
}

// ─── Flow Tracker ─────────────────────────────────────────────────────────────

interface FlowTrackerProps {
  flow: CornerFlowState[];
  /** Display in compact (condensed) mode */
  compact?: boolean;
}

export function FlowTracker({ flow, compact = false }: FlowTrackerProps) {
  if (!flow || flow.length === 0) return null;

  // Priority: in-progress / error → first idle after last complete → last corner
  const activeCorner = (() => {
    const inFlight = flow.find((c) => c.status === 'processing' || c.status === 'error');
    if (inFlight) return inFlight;
    // Find the first idle corner that comes after all completed corners
    const lastCompleteIdx = flow.reduce((acc, c, i) => c.status === 'complete' ? i : acc, -1);
    const nextIdle = flow.find((c, i) => i > lastCompleteIdx && c.status === 'idle');
    return nextIdle ?? flow[flow.length - 1];
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            Invoice Progress
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Current status of your invoice</p>
        </div>
        {/* Active step indicator */}
        <div className="text-right">
          <p className="text-xs text-gray-500">
            Current: <span className="font-medium text-gray-700">{STEP_LABELS[activeCorner?.corner] ?? activeCorner?.label}</span>
          </p>
        </div>
      </div>

      {/* Step cards */}
      <div className="px-5 py-6 flex items-start">
        {flow.map((corner, idx) => (
          <CornerCard
            key={corner.corner}
            corner={corner}
            isLast={idx === flow.length - 1}
          />
        ))}
      </div>

      {/* Status bar (generic — no architecture details exposed) */}
      {activeCorner && (
        <div
          className={clsx(
            'px-5 py-3 border-t text-xs flex items-center gap-2',
            activeCorner.status === 'error'
              ? 'bg-red-50 border-red-100 text-red-700'
              : activeCorner.status === 'complete'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : activeCorner.status === 'processing'
              ? 'bg-blue-50 border-blue-100 text-blue-700'
              : 'bg-gray-50 border-gray-100 text-gray-500',
          )}
        >
          <StatusIcon status={activeCorner.status} />
          <span>{genericStatusMessage(activeCorner)}</span>
        </div>
      )}
    </div>
  );
}
