'use client';

import React, { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { isValidEmailFormat, isDisposableEmail } from '@/lib/validation';

type CheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
  /**
   * When true, fires a debounced backend duplicate check after the user
   * stops typing (600 ms). Shows ✓/✗ inline. Calls onAvailabilityChange.
   */
  checkDuplicate?: boolean;
  onAvailabilityChange?: (available: boolean) => void;
}

const STATUS_ICONS: Record<CheckStatus, React.ReactNode> = {
  idle: null,
  invalid: null,
  checking: <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />,
  available: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  taken: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_MESSAGES: Partial<Record<CheckStatus, string>> = {
  available: 'Email is available',
  taken: 'Email is already registered',
};

/**
 * Email input with optional real-time duplicate check.
 * Compatible with react-hook-form's register() via forwardRef.
 *
 * Usage:
 *   <EmailInput
 *     {...register('email', emailValidators)}
 *     label="Email address"
 *     checkDuplicate
 *     onAvailabilityChange={setEmailAvailable}
 *     error={errors.email?.message}
 *   />
 */
export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  (
    {
      label,
      error,
      hint,
      className,
      id,
      checkDuplicate = false,
      onAvailabilityChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const [status, setStatus] = useState<CheckStatus>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    const runCheck = (email: string) => {
      if (!isValidEmailFormat(email) || isDisposableEmail(email)) {
        setStatus('invalid');
        onAvailabilityChange?.(false);
        return;
      }
      setStatus('checking');
      api
        .post('/auth/check-email/', { email })
        .then((res) => {
          const available: boolean = res.data?.data?.available ?? false;
          setStatus(available ? 'available' : 'taken');
          onAvailabilityChange?.(available);
        })
        .catch(() => {
          setStatus('idle');
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e); // react-hook-form's handler
      if (!checkDuplicate) return;

      setStatus('idle');
      clearTimeout(timerRef.current);

      const val = e.target.value.trim();
      if (!val) return;

      timerRef.current = setTimeout(() => runCheck(val), 600);
    };

    const showIcon = checkDuplicate && status !== 'idle' && status !== 'invalid';
    const statusMsg = STATUS_MESSAGES[status];

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type="email"
            onChange={handleChange}
            {...props}
            className={clsx(
              'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              'disabled:bg-gray-50 disabled:text-gray-500',
              showIcon && 'pr-9',
              error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300',
              className
            )}
          />
          {showIcon && (
            <span className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              {STATUS_ICONS[status]}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!error && statusMsg && (
          <p
            className={clsx(
              'text-xs',
              status === 'available' ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {statusMsg}
          </p>
        )}
        {!error && !statusMsg && hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
EmailInput.displayName = 'EmailInput';
