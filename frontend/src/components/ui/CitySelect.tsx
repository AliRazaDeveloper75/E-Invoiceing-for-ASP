import React from 'react';
import { clsx } from 'clsx';
import { getCitiesForCountry } from '@/data/countries';
import { FieldTooltip } from './FieldTooltip';
import CustomSelect from './CustomSelect';

interface CitySelectProps {
  label?: string;
  error?: string;
  countryCode?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  onBlur?: () => void;
  disabled?: boolean;
}

export function CitySelect({
  label,
  error,
  tooltip,
  required,
  className,
  id,
  countryCode = '',
  placeholder = 'Select city',
  value = '',
  onChange,
  disabled,
}: CitySelectProps) {
  const cities = getCitiesForCountry(countryCode);
  const noCountry = !countryCode;
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const options = [
    { value: '', label: noCountry ? 'Select a country first' : placeholder },
    ...cities.map((city) => ({
      value: city,
      label: city,
    })),
  ];

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
      <CustomSelect
        value={value}
        onChange={disabled ? () => {} : (onChange ?? (() => {}))}
        options={options}
        className={clsx(
          (noCountry || disabled) && 'opacity-60 pointer-events-none',
          error && ' [&>button]:border-red-400',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
