'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import { ArrowLeft } from 'lucide-react';
import { AxiosError } from 'axios';
import {
  emailValidators,
  validateTRN,
  numericOnlyKeyDown,
  alphaOnlyKeyDown,
  validatePhoneNumber,
} from '@/lib/validation';

interface CustomerForm {
  name: string;
  legal_name: string;
  customer_type: string;
  trn: string;
  vat_number: string;
  street_address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  notes: string;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const { activeId } = useCompany();
  const [serverError, setServerError] = useState<Record<string, string>>({});

  const countryForm = useCountryForm('AE');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    defaultValues: {
      customer_type: 'b2b',
      country: 'AE',
    },
  });

  const customerType = watch('customer_type');
  const watchedCountry = watch('country');
  const isUAE = watchedCountry === 'AE';
  const needsTRN = isUAE && (customerType === 'b2b' || customerType === 'b2g');

  const onSubmit = async (data: CustomerForm) => {
    setServerError({});
    try {
      const phone = data.phone
        ? `${countryForm.dialCode}${data.phone}`.trim()
        : '';
      await api.post('/customers/', {
        ...data,
        phone,
        company_id: activeId,
      });
      router.push('/customers');
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
      const details = e.response?.data?.error?.details;
      if (details) {
        const mapped: Record<string, string> = {};
        Object.entries(details).forEach(([k, v]) => { mapped[k] = v[0]; });
        setServerError(mapped);
      } else {
        setServerError({ general: e.response?.data?.error?.message ?? 'Failed to create customer.' });
      }
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Customer</h1>
        <p className="text-gray-500 text-sm mt-1">Add a customer to issue invoices to</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Identity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Customer Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Trading Name"
              required
              tooltip="The name this customer trades under — shown on invoices. E.g. 'Acme LLC'"
              placeholder="Acme LLC"
              error={errors.name?.message || serverError.name}
              onKeyDown={alphaOnlyKeyDown}
              {...register('name', {
                required: 'Trading name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
                maxLength: { value: 100, message: 'Name must be 100 characters or fewer' },
              })}
            />
            <Input
              label="Legal Name"
              tooltip="Full legal registered name, if different from the trading name. E.g. 'Acme Limited Liability Company'"
              placeholder="Acme Limited Liability Company"
              error={serverError.legal_name}
              {...register('legal_name', {
                maxLength: { value: 200, message: 'Legal name must be 200 characters or fewer' },
              })}
            />
          </div>

          <Select
            label="Customer Type"
            required
            tooltip="B2B — business buyer with a TRN. B2G — government entity. B2C — individual consumer (no TRN required)."
            error={errors.customer_type?.message}
            {...register('customer_type', { required: 'Customer type is required' })}
          >
            <option value="b2b">B2B — Business to Business</option>
            <option value="b2g">B2G — Business to Government</option>
            <option value="b2c">B2C — Business to Consumer</option>
          </Select>
        </div>

        {/* Tax */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Tax Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={needsTRN ? 'TRN' : 'TRN (optional)'}
              required={needsTRN}
              tooltip="UAE Tax Registration Number issued by the Federal Tax Authority. Must be exactly 15 numeric digits. Required for UAE B2B and B2G customers."
              placeholder="123456789012345"
              hint={needsTRN ? 'Required for UAE B2B / B2G — 15 digits' : '15-digit UAE Tax Registration Number'}
              error={errors.trn?.message || serverError.trn}
              inputMode="numeric"
              maxLength={15}
              onKeyDown={numericOnlyKeyDown}
              {...register('trn', {
                validate: (v) => validateTRN(v, needsTRN),
              })}
            />
            <Input
              label="VAT Number (international)"
              tooltip="Tax identification number for non-UAE customers. Digits only. Leave blank if not applicable."
              placeholder="123456789"
              hint="For non-UAE customers — numbers only"
              error={serverError.vat_number}
              inputMode="numeric"
              maxLength={20}
              onKeyDown={numericOnlyKeyDown}
              {...register('vat_number', {
                validate: (v) => {
                  if (!v?.trim()) return true;
                  if (!/^\d+$/.test(v)) return 'VAT number must contain digits only';
                  return true;
                },
              })}
            />
          </div>
        </div>

        {/* Address & Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Address & Contact</h2>

          <div className="grid grid-cols-2 gap-4">
            <CountrySelect
              label="Country"
              required
              tooltip="Select the country where this customer is registered or based."
              error={errors.country?.message || serverError.country}
              {...register('country', { required: 'Country is required' })}
              onChange={(e) => {
                setValue('country', e.target.value, { shouldValidate: true });
                setValue('city', '');
                countryForm.handleCountryChange(e.target.value);
              }}
            />
            <CitySelect
              label="City"
              tooltip="Select the customer's city. Options update based on the selected country."
              countryCode={watchedCountry}
              error={serverError.city}
              {...register('city')}
            />
          </div>

          <Input
            label="Street Address"
            tooltip="Full street address including building number, street name, and area. E.g. 'Office 101, Business Bay Tower, Business Bay'"
            placeholder="Office 101, Business Bay Tower, Business Bay"
            error={errors.street_address?.message || serverError.street_address}
            {...register('street_address', {
              validate: (v) => {
                if (!v?.trim()) return true;
                if (v.trim().length < 5) return 'Please enter a more complete street address';
                return true;
              },
            })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              tooltip="Customer's billing or accounts email address. Used for invoice delivery. E.g. billing@customer.ae"
              placeholder="billing@customer.ae"
              error={errors.email?.message || serverError.email}
              {...register('email', {
                validate: (v) => {
                  if (!v?.trim()) return true;
                  return emailValidators.validate.format(v) === true
                    ? emailValidators.validate.noDisposable(v)
                    : emailValidators.validate.format(v);
                },
              })}
            />
            <Controller
              name="phone"
              control={control}
              rules={{
                validate: (v) => {
                  if (!v?.trim()) return true;
                  return validatePhoneNumber(v, countryForm.dialCode);
                },
              }}
              render={({ field, fieldState }) => (
                <PhoneInput
                  label="Phone"
                  tooltip="Customer's contact phone number. Enter local number only — the country dial code is added automatically."
                  dialCode={countryForm.dialCode}
                  flag={countryForm.flag}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={fieldState.error?.message || serverError.phone}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes about this customer (payment terms, special requirements, etc.)"
              className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400"
              {...register('notes', {
                maxLength: { value: 500, message: 'Notes must be 500 characters or fewer' },
              })}
            />
            {errors.notes && (
              <p className="text-xs text-red-600">⚠ {errors.notes.message}</p>
            )}
          </div>
        </div>

        {serverError.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError.general}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
