'use client';

import { clsx } from 'clsx';
import {
  Building2,
  ShieldCheck,
  Network,
  Building,
  Landmark,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from 'lucide-react';
import type { CornerFlowState, CornerFlowStatus } from '@/types';

// ─── Corner Icons ─────────────────────────────────────────────────────────────

const CORNER_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Building2,
  2: ShieldCheck,
  3: Network,
  4: Building,
  5: Landmark,
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_RING: Record<CornerFlowStatus, string> = {
  idle:       'border-gray-200 bg-gray-50',
  processing: 'border-brand-400 bg-brand-50',
  complete:   'border-emerald-400 bg-emerald-50',
  error:      'border-red-400 bg-red-50',
};

const STATUS_ICON_COLOR: Record<CornerFlowStatus, string> = {
  idle:       'text-gray-300',
  processing: 'text-brand-500',
  complete:   'text-emerald-500',
  error:      'text-red-500',
};


const STATUS_CONNECTOR: Record<CornerFlowStatus, string> = {
  idle:       'bg-gray-200',
  processing: 'bg-brand-300',
  complete:   'bg-emerald-400',
  error:      'bg-red-300',
};

const STATUS_BADGE: Record<CornerFlowStatus, { label: string; className: string }> = {
  idle:       { label: 'Waiting',    className: 'bg-gray-100 text-gray-400' },
  processing: { label: 'In Progress',className: 'bg-brand-100 text-brand-600' },
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

// ─── Corner Card ──────────────────────────────────────────────────────────────

function CornerCard({ corner, isLast }: { corner: CornerFlowState; isLast: boolean }) {
  const Icon = CORNER_ICONS[corner.corner] ?? Building2;
  const badge = STATUS_BADGE[corner.status];
  const ts = formatTimestamp(corner.timestamp);

  return (
    <div className="flex items-start gap-0">
      {/* Card */}
      <div className="flex flex-col items-center w-full">
        {/* Circle + icon */}
        <div
          className={clsx(
            'relative flex items-center justify-center',
            'w-14 h-14 rounded-full border-2 shadow-sm transition-all duration-300',
            STATUS_RING[corner.status],
          )}
        >
          <Icon className={clsx('h-6 w-6 transition-colors', STATUS_ICON_COLOR[corner.status])} />

          {/* Status overlay badge (top-right) */}
          <span className="absolute -top-1 -right-1">
            <StatusIcon status={corner.status} />
          </span>

          {/* Corner number badge (bottom-left) */}
          <span
            className={clsx(
              'absolute -bottom-1 -left-1',
              'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              'border border-white shadow-sm',
              corner.status === 'idle'       ? 'bg-gray-200 text-gray-500' :
              corner.status === 'processing' ? 'bg-brand-500 text-white' :
              corner.status === 'complete'   ? 'bg-emerald-500 text-white' :
                                               'bg-red-500 text-white',
            )}
          >
            {corner.corner}
          </span>
        </div>

        {/* Text */}
        <div className="mt-3 text-center px-1">
          <p
            className={clsx(
              'text-xs font-semibold leading-tight transition-colors',
              corner.status === 'idle' ? 'text-gray-400' : 'text-gray-800',
            )}
          >
            {corner.label}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{corner.sublabel}</p>
          <span
            className={clsx(
              'inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              badge.className,
            )}
          >
            {badge.label}
          </span>
          {ts && (
            <p className="text-[10px] text-gray-400 mt-1">{ts}</p>
          )}
        </div>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex items-center mt-7 flex-shrink-0 w-8 lg:w-12">
          <div
            className={clsx(
              'h-0.5 w-full transition-colors duration-500',
              STATUS_CONNECTOR[corner.status],
            )}
          />
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
            PEPPOL 5-Corner Flow
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">UAE e-invoicing transmission pipeline</p>
        </div>
        {/* Active step indicator */}
        <div className="text-right">
          <p className="text-xs text-gray-500">
            Active: <span className="font-medium text-gray-700">{activeCorner?.label}</span>
          </p>
          <p className="text-[10px] text-gray-400">{activeCorner?.sublabel}</p>
        </div>
      </div>

      {/* Corner cards */}
      <div
        className={clsx(
          'px-5 py-6 flex items-start justify-between',
          compact ? 'gap-1' : 'gap-2',
        )}
      >
        {flow.map((corner, idx) => (
          <CornerCard
            key={corner.corner}
            corner={corner}
            isLast={idx === flow.length - 1}
          />
        ))}
      </div>

      {/* Description bar for active corner */}
      {activeCorner && activeCorner.description && (
        <div
          className={clsx(
            'px-5 py-3 border-t text-xs flex items-center gap-2',
            activeCorner.status === 'error'
              ? 'bg-red-50 border-red-100 text-red-700'
              : activeCorner.status === 'complete'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : activeCorner.status === 'processing'
              ? 'bg-brand-50 border-brand-100 text-brand-700'
              : 'bg-gray-50 border-gray-100 text-gray-500',
          )}
        >
          <StatusIcon status={activeCorner.status} />
          <span>{activeCorner.description}</span>
        </div>
      )}
    </div>
  );
}
