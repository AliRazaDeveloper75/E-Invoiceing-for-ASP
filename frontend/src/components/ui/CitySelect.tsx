import React from 'react';
import { clsx } from 'clsx';
import { getCitiesForCountry } from '@/data/countries';
import { FieldTooltip } from './FieldTooltip';

interface CitySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  countryCode?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
}

/**
 * City dropdown that automatically populates based on the selected countryCode.
 * Shows a disabled placeholder when no country is selected.
 * Works with react-hook-form's register() via forwardRef.
 */
export const CitySelect = React.forwardRef<HTMLSelectElement, CitySelectProps>(
  (
    { label, error, tooltip, required, className, id, countryCode = '', placeholder = 'Select city', ...props },
    ref
  ) => {
    const cities = getCitiesForCountry(countryCode);
    const noCountry = !countryCode;
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
          disabled={noCountry || props.disabled}
          {...props}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            (noCountry || props.disabled) && 'bg-gray-50 text-gray-400 cursor-not-allowed',
            error ? 'border-red-400' : 'border-gray-300',
            className
          )}
        >
          <option value="">
            {noCountry ? 'Select a country first' : placeholder}
          </option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
CitySelect.displayName = 'CitySelect';
