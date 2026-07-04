'use client';

import { clsx } from 'clsx';
import {
  FileText,
  Code2,
  Send,
  ShieldCheck,
  Network,
  Building,
  Landmark,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import type { TimelineEvent, CornerFlowStatus } from '@/types';

interface EventConfig {
  Icon:      React.ComponentType<{ className?: string }>;
  iconBg:    string;
  iconColor: string;
  dotColor:  string;
}

function getEventConfig(event: TimelineEvent): EventConfig {
  if (event.status === 'error') {
    return {
      Icon:      XCircle,
      iconBg:    'bg-red-50',
      iconColor: 'text-red-500',
      dotColor:  'bg-red-400',
    };
  }

  switch (true) {
    case event.type === 'created':
      return { Icon: FileText,     iconBg: 'bg-gray-50',     iconColor: 'text-gray-500',    dotColor: 'bg-gray-400' };
    case event.type === 'xml_generated':
      return { Icon: Code2,        iconBg: 'bg-purple-50',   iconColor: 'text-purple-500',  dotColor: 'bg-purple-400' };
    case event.type === 'submitted_for_processing':
      return { Icon: Send,         iconBg: 'bg-blue-50',     iconColor: 'text-blue-500',    dotColor: 'bg-blue-400' };
    case event.type.startsWith('asp_accepted'):
    case event.type === 'asp_accepted':
      return { Icon: ShieldCheck,  iconBg: 'bg-emerald-50',  iconColor: 'text-emerald-500', dotColor: 'bg-emerald-400' };
    case event.type.startsWith('asp_'):
      return { Icon: ShieldCheck,  iconBg: 'bg-orange-50',   iconColor: 'text-orange-500',  dotColor: 'bg-orange-400' };
    case event.type === 'peppol_delivered':
      return { Icon: Network,      iconBg: 'bg-sky-50',      iconColor: 'text-sky-500',     dotColor: 'bg-sky-400' };
    case event.type === 'buyer_received':
      return { Icon: Building,     iconBg: 'bg-teal-50',     iconColor: 'text-teal-500',    dotColor: 'bg-teal-400' };
    case event.type.startsWith('fta_reported'):
    case event.type === 'fta_reported':
      return { Icon: Landmark,     iconBg: 'bg-emerald-50',  iconColor: 'text-emerald-500', dotColor: 'bg-emerald-400' };
    case event.type.startsWith('fta_'):
      return { Icon: Landmark,     iconBg: 'bg-amber-50',    iconColor: 'text-amber-500',   dotColor: 'bg-amber-400' };
    default:
      return { Icon: AlertCircle,  iconBg: 'bg-gray-50',     iconColor: 'text-gray-400',    dotColor: 'bg-gray-300' };
  }
}

const CORNER_LABEL: Record<number, string> = {
  1: 'C1 \u00B7 Supplier',
  2: 'C2 \u00B7 Sending ASP',
  3: 'C3 \u00B7 E-Invoice Network',
  4: 'C4 \u00B7 Buyer',
  5: 'C5 \u00B7 FTA',
};

const CORNER_BADGE: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-sky-100 text-sky-700',
  4: 'bg-teal-100 text-teal-700',
  5: 'bg-amber-100 text-amber-700',
};

function formatTimestamp(ts: string): { date: string; time: string } {
  if (!ts) return { date: '', time: '' };
  try {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch {
    return { date: '', time: '' };
  }
}

function StatusChip({ status }: { status: CornerFlowStatus }) {
  if (status === 'complete')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
        <CheckCircle2 className="h-2.5 w-2.5" /> Complete
      </span>
    );
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
        <XCircle className="h-2.5 w-2.5" /> Failed
      </span>
    );
  if (status === 'processing')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> In Progress
      </span>
    );
  return null;
}

function DataPills({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== '' && v != null);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-mono"
        >
          {key}: {String(value)}
        </span>
      ))}
    </div>
  );
}

function EventRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const { Icon, iconBg, iconColor, dotColor } = getEventConfig(event);
  const { date, time } = formatTimestamp(event.timestamp);
  const cornerBadge = CORNER_BADGE[event.corner] ?? CORNER_BADGE[1];

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div
          className={clsx(
            'flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
            iconBg,
          )}
        >
          <Icon className={clsx('h-4 w-4', iconColor)} />
        </div>
        {!isLast && (
          <div className={clsx('w-0.5 flex-1 mt-1 min-h-[1.5rem]', dotColor, 'opacity-20')} />
        )}
      </div>

      <div className={clsx('pb-5 flex-1 min-w-0', isLast && 'pb-1')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">{event.title}</p>
            <StatusChip status={event.status} />
            <span
              className={clsx(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                cornerBadge,
              )}
            >
              {CORNER_LABEL[event.corner] ?? `Corner ${event.corner}`}
            </span>
          </div>
          {date && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">{date}</p>
              <p className="text-[10px] text-gray-400 font-mono">{time}</p>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.description}</p>
        )}

        <DataPills data={event.data} />
      </div>
    </div>
  );
}

interface InvoiceTimelineProps {
  events: TimelineEvent[];
}

export function InvoiceTimeline({ events }: InvoiceTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Activity className="h-6 w-6 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">No events yet</p>
        <p className="text-xs text-gray-400 mt-1">Events appear here as the invoice progresses.</p>
      </div>
    );
  }

  return (
    <div>
      {events.map((event, idx) => (
        <EventRow
          key={`${event.type}-${event.timestamp}-${idx}`}
          event={event}
          isLast={idx === events.length - 1}
        />
      ))}
    </div>
  );
}
