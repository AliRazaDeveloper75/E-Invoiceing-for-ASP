'use client';

import { useState, useEffect } from 'react';
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
  validateEmail,
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
  trn_issue_date: string;
  trn_expiry_date: string;
  vat_number: string;
  street_address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  notes: string;
  trn_document: FileList;
  logo: FileList;
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
  const watchedTrn = watch('trn');
  const trnDoc = watch('trn_document');
  const logoFile = watch('logo');
  // TRN is mandatory for every business customer (B2B / B2G), regardless of country.
  const needsTRN = customerType === 'b2b' || customerType === 'b2g';
  // VAT number stays optional — TRN is the required tax identifier.
  const needsVAT = false;
  const [vatSameAsTrn, setVatSameAsTrn] = useState(false);

  // Keep VAT synced to TRN while "Same as TRN" is checked.
  useEffect(() => {
    if (vatSameAsTrn) setValue('vat_number', watchedTrn ?? '', { shouldValidate: true });
  }, [vatSameAsTrn, watchedTrn, setValue]);

  const onSubmit = async (data: CustomerForm) => {
    setServerError({});
    try {
      const phone = data.phone
        ? `${countryForm.dialCode}${data.phone}`.trim()
        : '';

      // Files require multipart/form-data, not JSON.
      const fd = new FormData();
      fd.append('company_id', activeId ?? '');
      fd.append('name', data.name);
      fd.append('legal_name', data.legal_name || '');
      fd.append('customer_type', data.customer_type);
      fd.append('trn', data.trn || '');
      if (data.trn_issue_date)  fd.append('trn_issue_date', data.trn_issue_date);
      if (data.trn_expiry_date) fd.append('trn_expiry_date', data.trn_expiry_date);
      fd.append('vat_number', data.vat_number || '');
      fd.append('street_address', data.street_address || '');
      fd.append('city', data.city || '');
      fd.append('country', data.country);
      fd.append('email', data.email || '');
      fd.append('phone', phone);
      fd.append('notes', data.notes || '');
      if (data.trn_document?.[0]) fd.append('trn_document', data.trn_document[0]);
      if (data.logo?.[0]) fd.append('logo', data.logo[0]);

      await api.post('/customers/', fd, {
        headers: { 'Content-Type': undefined },   // let the browser set the multipart boundary
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

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, () => {
          setServerError({ general: 'Please fill in all required (*) fields before creating the customer.' });
        })}
        className="space-y-5"
      >

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
              tooltip="UAE Tax Registration Number (TRN) issued by the Federal Tax Authority — exactly 15 numeric digits. Mandatory for all B2B and B2G customers; optional for B2C (individual consumers)."
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
              label={needsVAT ? 'VAT Number (international)' : 'VAT Number (international, optional)'}
              required={needsVAT}
              tooltip="Optional VAT / tax number for international (non-UAE) customers — 15 digits, same format as a TRN. Leave blank if not applicable, or tick 'Same as TRN'."
              placeholder="123456789012345"
              hint={needsVAT ? 'Required for non-UAE business customers — 15 digits' : '15-digit international VAT/tax number'}
              error={errors.vat_number?.message || serverError.vat_number}
              inputMode="numeric"
              maxLength={15}
              disabled={vatSameAsTrn}
              onKeyDown={numericOnlyKeyDown}
              {...register('vat_number', {
                validate: (v) => {
                  if (!v?.trim()) return needsVAT ? 'VAT number is required for international customers' : true;
                  if (!/^\d+$/.test(v)) return 'VAT number must contain digits only — no letters or symbols';
                  if (v.length !== 15) return `VAT number must be exactly 15 digits (you entered ${v.length})`;
                  return true;
                },
              })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="TRN Issue Date"
              type="date"
              tooltip="Date the customer's Tax Registration (TRN) was issued by the FTA."
              error={errors.trn_issue_date?.message}
              {...register('trn_issue_date')}
            />
            <Input
              label="TRN Expiry Date"
              type="date"
              tooltip="TRN expiry / validity end date, if applicable."
              error={errors.trn_expiry_date?.message}
              {...register('trn_expiry_date')}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={vatSameAsTrn}
              onChange={(e) => setVatSameAsTrn(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            VAT Number same as TRN
          </label>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Both documents are required to register a customer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* TRN certificate */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                TRN Certificate <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
                           file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium
                           file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                {...register('trn_document', {
                  required: 'TRN certificate is required',
                  validate: (f) => {
                    const file = f?.[0];
                    if (!file) return 'TRN certificate is required';
                    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name))
                      return 'Only PDF, JPG or PNG files are allowed';
                    if (file.size > 5 * 1024 * 1024) return 'File must be 5MB or smaller';
                    return true;
                  },
                })}
              />
              <p className="text-[11px] text-gray-400">Upload the customer&apos;s TRN / tax certificate — PDF, JPG or PNG (max 5MB).</p>
              {trnDoc?.[0] && (
                <p className="text-[11px] text-green-600 truncate">✓ {trnDoc[0].name}</p>
              )}
              {(errors.trn_document?.message || serverError.trn_document) && (
                <p className="text-xs text-red-600">⚠ {errors.trn_document?.message || serverError.trn_document}</p>
              )}
            </div>

            {/* Logo */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Customer Logo <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
                           file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium
                           file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                {...register('logo', {
                  required: 'Customer logo is required',
                  validate: (f) => {
                    const file = f?.[0];
                    if (!file) return 'Customer logo is required';
                    if (!/\.(jpg|jpeg|png)$/i.test(file.name))
                      return 'Only JPG or PNG images are allowed';
                    if (file.size > 5 * 1024 * 1024) return 'Image must be 5MB or smaller';
                    return true;
                  },
                })}
              />
              <p className="text-[11px] text-gray-400">Upload the customer&apos;s company logo — JPG or PNG (max 5MB).</p>
              {logoFile?.[0] && (
                <p className="text-[11px] text-green-600 truncate">✓ {logoFile[0].name}</p>
              )}
              {(errors.logo?.message || serverError.logo) && (
                <p className="text-xs text-red-600">⚠ {errors.logo?.message || serverError.logo}</p>
              )}
            </div>
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
              required
              tooltip="Select the customer's city. Options update based on the selected country."
              countryCode={watchedCountry}
              error={errors.city?.message || serverError.city}
              {...register('city', { required: 'City is required' })}
            />
          </div>

          <Input
            label="Street Address"
            required
            tooltip="Full street address including building number, street name, and area. E.g. 'Office 101, Business Bay Tower, Business Bay'"
            placeholder="Office 101, Business Bay Tower, Business Bay"
            error={errors.street_address?.message || serverError.street_address}
            {...register('street_address', {
              required: 'Street address is required',
              minLength: { value: 5, message: 'Please enter a more complete street address' },
            })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              required
              tooltip="Customer's billing or accounts email address. Required — used to deliver invoices. E.g. billing@customer.ae"
              placeholder="billing@customer.ae"
              error={errors.email?.message || serverError.email}
              {...register('email', {
                required: 'Email is required',
                validate: (v) => validateEmail(v),
              })}
            />
            <Controller
              name="phone"
              control={control}
              rules={{
                validate: (v) => {
                  if (!v?.trim()) return true;
                  return validatePhoneNumber(v, countryForm.dialCode, countryForm.phoneLength);
                },
              }}
              render={({ field, fieldState }) => (
                <PhoneInput
                  label="Phone"
                  tooltip={`Customer's contact phone number — exactly ${countryForm.phoneLength} digits for the selected country. Enter local number only; the dial code is added automatically.`}
                  dialCode={countryForm.dialCode}
                  flag={countryForm.flag}
                  maxLength={countryForm.phoneLength}
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
