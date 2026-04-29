import { clsx } from 'clsx';
import type { InvoiceStatus } from '@/types';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:          'bg-gray-100 text-gray-700',
  pending:        'bg-yellow-100 text-yellow-800',
  submitted:      'bg-blue-100 text-blue-800',
  validated:      'bg-green-100 text-green-800',
  rejected:       'bg-red-100 text-red-800',
  cancelled:      'bg-gray-200 text-gray-600',
  paid:           'bg-emerald-100 text-emerald-800',
  partially_paid: 'bg-orange-100 text-orange-800',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          'Draft',
  pending:        'Pending',
  submitted:      'Submitted',
  validated:      'Validated',
  rejected:       'Rejected',
  cancelled:      'Cancelled',
  paid:           'Paid',
  partially_paid: 'Partially Paid',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      STATUS_STYLES[status]
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const BADGE_STYLES = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error:   'bg-red-100 text-red-800',
  info:    'bg-blue-100 text-blue-800',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      BADGE_STYLES[variant]
    )}>
      {children}
    </span>
  );
}
