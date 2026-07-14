import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import { FieldTooltip } from './FieldTooltip';
import CustomSelect from './CustomSelect';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  tooltip?: string;
  required?: boolean;
}

// forwardRef is required so react-hook-form can attach its internal ref.
// Without it, register() can't read field values → all validations fail.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, tooltip, className, id, type, required, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="flex items-center text-sm font-medium text-gray-700">
            <span>
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {tooltip && <FieldTooltip content={tooltip} />}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={resolvedType}
            required={required}
            {...props}
            className={clsx(
              'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400',
              'disabled:bg-gray-50 disabled:text-gray-500',
              isPassword && 'pr-10',
              error ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300',
              className
            )}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <span>⚠</span> {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';


interface SelectProps {
  label?: string;
  error?: string;
  tooltip?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export function Select({
  label, error, tooltip, className, id, required, options, value = '', onChange, placeholder = 'Select...',
}: SelectProps) {
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
      <CustomSelect
        value={value}
        onChange={onChange ?? (() => {})}
        options={options}
        placeholder={placeholder}
        className={clsx(error && '[&>button]:border-red-400', className)}
      />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
