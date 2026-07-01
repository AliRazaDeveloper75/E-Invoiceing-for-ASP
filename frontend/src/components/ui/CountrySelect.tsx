import React from 'react';
import { clsx } from 'clsx';
import { COUNTRY_OPTIONS } from '@/data/countries';
import { FieldTooltip } from './FieldTooltip';

interface CountrySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
}

/**
 * Dropdown of all countries with flag emoji + dial code.
 * UAE is pinned at the top; the rest are alphabetical.
 * Works with react-hook-form's register() via forwardRef.
 */
export const CountrySelect = React.forwardRef<HTMLSelectElement, CountrySelectProps>(
  ({ label, error, tooltip, required, className, id, placeholder = 'Select country', ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="flex items-center text-sm font-medium text-gray-700">
            <span>
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {tooltip && <FieldTooltip content={tooltip} />}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          {...props}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-gray-50',
            error ? 'border-red-400' : 'border-gray-300',
            className
          )}
        >
          <option value="">{placeholder}</option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.dialCode})
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
CountrySelect.displayName = 'CountrySelect';
