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
  Activity,
} from 'lucide-react';
import type { CornerFlowState, CornerFlowStatus } from '@/types';

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

const STATUS_ICON_COLOR: Record<CornerFlowStatus, string> = {
  idle:       'text-gray-300',
  processing: 'text-blue-500',
  complete:   'text-emerald-500',
  error:      'text-red-500',
};

const STATUS_BADGE: Record<CornerFlowStatus, { label: string; className: string }> = {
  idle:       { label: 'Waiting',    className: 'bg-gray-100 text-gray-500' },
  processing: { label: 'In Progress',className: 'bg-blue-100 text-blue-700' },
  complete:   { label: 'Complete',   className: 'bg-emerald-100 text-emerald-700' },
  error:      { label: 'Failed',     className: 'bg-red-100 text-red-700' },
};

function StatusIcon({ status }: { status: CornerFlowStatus }) {
  const cls = clsx('h-4 w-4', STATUS_ICON_COLOR[status]);
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
    case 'complete':   return 'Invoice fully processed and reported.';
    case 'error':      return `There was a problem at the \u201c${label}\u201d step.`;
    case 'processing': return `${label} in progress\u2026`;
    default:           return `Next step: ${label}.`;
  }
}

function CornerCard({ corner, isLast }: { corner: CornerFlowState; isLast: boolean }) {
  const Icon = STEP_ICONS[corner.corner] ?? FileText;
  const label = STEP_LABELS[corner.corner] ?? corner.label;
  const badge = STATUS_BADGE[corner.status];
  const ts = formatTimestamp(corner.timestamp);
  const { status } = corner;

  return (
    <div className="flex items-start flex-1 min-w-0">
      <div className="flex flex-col items-center w-full">
        <div
          className={clsx(
            'relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500',
            status === 'complete'   && 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm shadow-emerald-200',
            status === 'processing' && 'bg-blue-50 text-blue-600 border-2 border-blue-400 shadow-sm shadow-blue-200',
            status === 'error'      && 'bg-gradient-to-br from-red-400 to-red-500 text-white shadow-sm shadow-red-200',
            status === 'idle'       && 'bg-gray-50 text-gray-300 border-2 border-gray-100',
          )}
        >
          {status === 'complete'
            ? <Check className="h-5 w-5" strokeWidth={3} />
            : status === 'error'
            ? <XCircle className="h-5 w-5" />
            : <Icon className="h-5 w-5" />}

          {status === 'processing' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
            </span>
          )}
        </div>

        <div className="mt-2.5 text-center px-1">
          <p className={clsx(
            'text-xs font-semibold leading-tight',
            status === 'idle' ? 'text-gray-400' : 'text-gray-800',
          )}>
            {label}
          </p>
          <p className={clsx(
            'text-[10px] font-medium mt-1',
            status === 'complete'   ? 'text-emerald-600' :
            status === 'processing' ? 'text-blue-600' :
            status === 'error'      ? 'text-red-600' : 'text-gray-400',
          )}>
            {badge.label}
          </p>
          {ts && <p className="text-[10px] text-gray-400 mt-1">{ts}</p>}
        </div>
      </div>

      {!isLast && (
        <div className="flex-1 mt-7 px-1">
          <div
            className={clsx(
              'h-1.5 w-full rounded-full transition-all duration-700',
              status === 'complete' && 'bg-gradient-to-r from-emerald-300 to-emerald-200',
              status === 'processing' && 'bg-gradient-to-r from-blue-300 to-blue-200',
              status === 'error' && 'bg-gradient-to-r from-red-300 to-red-200',
              status === 'idle' && 'bg-gray-100',
            )}
          />
        </div>
      )}
    </div>
  );
}

interface FlowTrackerProps {
  flow: CornerFlowState[];
  compact?: boolean;
}

export function FlowTracker({ flow, compact = false }: FlowTrackerProps) {
  if (!flow || flow.length === 0) return null;

  const activeCorner = (() => {
    const inFlight = flow.find((c) => c.status === 'processing' || c.status === 'error');
    if (inFlight) return inFlight;
    const lastCompleteIdx = flow.reduce((acc, c, i) => c.status === 'complete' ? i : acc, -1);
    const nextIdle = flow.find((c, i) => i > lastCompleteIdx && c.status === 'idle');
    return nextIdle ?? flow[flow.length - 1];
  })();

  const currentStepLabel = STEP_LABELS[activeCorner?.corner] ?? activeCorner?.label;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm shrink-0">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Invoice Progress</h2>
            <p className="text-[10px] text-gray-500">5-step e-invoice flow</p>
          </div>
        </div>
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0',
            activeCorner.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
            activeCorner.status === 'processing' ? 'bg-blue-100 text-blue-700' :
            activeCorner.status === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500',
          )}
        >
          <StatusIcon status={activeCorner.status} />
          {currentStepLabel}
        </span>
      </div>

      <div className={clsx('flex items-start', compact ? 'px-4 py-5' : 'px-5 py-6')}>
        {flow.map((corner, idx) => (
          <CornerCard
            key={corner.corner}
            corner={corner}
            isLast={idx === flow.length - 1}
          />
        ))}
      </div>

      {activeCorner && (
        <div
          className={clsx(
            'px-5 py-3 border-t flex items-center gap-2.5 text-xs',
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
          <span className="flex-1 font-medium">{genericStatusMessage(activeCorner)}</span>
          {activeCorner.timestamp && (
            <span className="text-gray-400 font-normal">{formatTimestamp(activeCorner.timestamp)}</span>
          )}
        </div>
      )}
    </div>
  );
}
