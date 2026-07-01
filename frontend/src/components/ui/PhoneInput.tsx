import React from 'react';
import { clsx } from 'clsx';
import { FieldTooltip } from './FieldTooltip';

interface PhoneInputProps {
  label?: string;
  error?: string;
  hint?: string;
  tooltip?: string;
  /** Country dial code prefix e.g. "+971". Displayed as a read-only badge. */
  dialCode?: string;
  /** Country flag emoji e.g. "🇦🇪". Displayed alongside the dial code. */
  flag?: string;
  /** The local phone number (digits after the dial code). */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Max number of local digits allowed (country-specific, excludes dial code). */
  maxLength?: number;
}

/**
 * Phone input that shows a read-only flag + dial-code badge on the left,
 * followed by a free-text field for the local number.
 *
 * Use with react-hook-form's Controller:
 *   <Controller name="phone" control={control}
 *     render={({ field }) => (
 *       <PhoneInput dialCode={dialCode} flag={flag} {...field} />
 *     )} />
 *
 * The form field value stores only the local number; combine with dialCode
 * on submit: `${dialCode}${phone}`.
 */
export function PhoneInput({
  label,
  error,
  hint,
  tooltip,
  dialCode = '',
  flag = '',
  value = '',
  onChange,
  onBlur,
  name,
  placeholder = '50 123 4567',
  disabled = false,
  id,
  maxLength,
}: PhoneInputProps) {
  const inputId = id ?? name ?? 'phone';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, spaces, hyphens, and parentheses
    let raw = e.target.value.replace(/[^\d\s\-().]/g, '');
    // Enforce the country-specific digit cap (count digits only, keep formatting)
    if (maxLength) {
      const digits = raw.replace(/\D/g, '');
      if (digits.length > maxLength) {
        // Trim extra digits from the end while preserving allowed formatting chars
        let count = 0;
        let out = '';
        for (const ch of raw) {
          if (/\d/.test(ch)) {
            if (count >= maxLength) continue;
            count++;
          }
          out += ch;
        }
        raw = out;
      }
    }
    onChange?.(raw);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="flex items-center text-sm font-medium text-gray-700">
          <span>{label}</span>
          {tooltip && <FieldTooltip content={tooltip} />}
        </label>
      )}
      <div
        className={clsx(
          'flex items-stretch rounded-lg border shadow-sm overflow-hidden',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          error ? 'border-red-400' : 'border-gray-300',
          disabled && 'bg-gray-50'
        )}
      >
        {/* Dial code badge */}
        <div
          className={clsx(
            'flex items-center gap-1.5 px-3 text-sm font-medium select-none',
            'bg-gray-50 border-r border-gray-300 text-gray-600 whitespace-nowrap',
            disabled && 'bg-gray-100 text-gray-400'
          )}
        >
          {flag && <span className="text-base leading-none">{flag}</span>}
          <span>{dialCode || '+?'}</span>
        </div>

        {/* Number input */}
        <input
          id={inputId}
          name={name}
          type="tel"
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={clsx(
            'flex-1 px-3 py-2 text-sm bg-white outline-none',
            'placeholder:text-gray-400',
            disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed'
          )}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
