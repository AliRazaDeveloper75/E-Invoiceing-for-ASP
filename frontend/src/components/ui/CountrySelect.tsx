import React from 'react';
import { clsx } from 'clsx';
import { COUNTRY_OPTIONS } from '@/data/countries';
import { FieldTooltip } from './FieldTooltip';
import CustomSelect from './CustomSelect';

interface CountrySelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  onBlur?: () => void;
}

export function CountrySelect({
  label,
  error,
  tooltip,
  required,
  className,
  id,
  placeholder = 'Select country',
  value = '',
  onChange,
}: CountrySelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const options = [
    { value: '', label: placeholder },
    ...COUNTRY_OPTIONS.map((c) => ({
      value: c.code,
      label: `${c.flag} ${c.name} (${c.dialCode})`,
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
        onChange={onChange ?? (() => {})}
        options={options}
        className={clsx(error && ' [&>button]:border-red-400', className)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
