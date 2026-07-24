'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import {
  ArrowLeft, UserPlus, Building2, FileText, Receipt,
  MapPin, XCircle, Save, Loader2, Pencil,
} from 'lucide-react';
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

/* ── Section card ──────────────────────────────────────────────────────────── */

function SectionCard({
  icon: Icon,
  title,
  description,
  accentColor,
  bgTint,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  accentColor: string;
  bgTint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/60 overflow-hidden transition-all duration-300 hover:shadow-lg ${bgTint}`}
      style={{
        boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${accentColor}`} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="px-6 pb-6 pt-2 space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */

export default function NewCustomerPage() {
  const router = useRouter();
  const { activeId } = useCompany();
  const [serverError, setServerError] = useState<Record<string, string>>({});

  const countryForm = useCountryForm('AE');

  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEdit = !!editId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    defaultValues: {
      customer_type: 'b2b',
      country: 'AE',
    },
  });

  useEffect(() => {
    if (!editId) return;
    api.get(`/customers/${editId}/`).then((r) => {
      const c = r.data?.data ?? r.data;
      reset({
        name: c.name ?? '', legal_name: c.legal_name ?? '',
        customer_type: c.customer_type ?? 'b2b',
        trn: c.trn ?? '', trn_issue_date: c.trn_issue_date ?? '',
        trn_expiry_date: c.trn_expiry_date ?? '', vat_number: c.vat_number ?? '',
        street_address: c.street_address ?? '', city: c.city ?? '',
        country: c.country ?? 'AE', email: c.email ?? '', notes: c.notes ?? '',
      });
    }).catch(() => setServerError({ general: 'Failed to load customer.' }));
  }, [editId, reset]);

  const customerType = watch('customer_type');
  const watchedCountry = watch('country');
  const watchedTrn = watch('trn');
  const trnDoc = watch('trn_document');
  const logoFile = watch('logo');
  const needsTRN = customerType === 'b2b' || customerType === 'b2g';
  const needsVAT = false;
  const [vatSameAsTrn, setVatSameAsTrn] = useState(false);

  useEffect(() => {
    if (vatSameAsTrn) setValue('vat_number', watchedTrn ?? '', { shouldValidate: true });
  }, [vatSameAsTrn, watchedTrn, setValue]);

  const onSubmit = async (data: CustomerForm) => {
    setServerError({});
    try {
      const phone = data.phone
        ? `${countryForm.dialCode}${data.phone}`.trim()
        : '';

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

      if (isEdit) {
        await api.put(`/customers/${editId}/`, fd, {
          headers: { 'Content-Type': undefined },
        });
      } else {
        await api.post('/customers/', fd, {
          headers: { 'Content-Type': undefined },
        });
      }
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
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header card */}
      <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-2xl border border-white/10 shadow-2xl shadow-blue-950/30 p-5 sm:p-7 relative overflow-hidden mb-5">
        <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-blue-200/70 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl shrink-0 ${isEdit
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30'
              }`}>
                {isEdit ? <Pencil className="h-5 w-5 text-white" /> : <UserPlus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-[0.12em]">Customers</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {isEdit ? 'Edit Customer' : 'New Customer'}
                </h1>
                <p className="text-sm text-blue-200/60 mt-0.5">
                  {isEdit ? 'Update customer details and documents' : 'Add a new customer to your address book'}
                </p>
              </div>
            </div>

            {/* Quick info chips */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-[11px] font-medium text-blue-100/80">
                <Building2 className="h-3 w-3 text-blue-300/60" />
                B2B / B2G / B2C
              </span>
              {isEdit && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-[11px] font-semibold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Editing
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {serverError.general && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 mb-6">
          <div className="p-1.5 rounded-lg bg-red-100 shrink-0">
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          {serverError.general}
        </div>
      )}

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, () => {
          setServerError({ general: 'Please fill in all required (*) fields before creating the customer.' });
        })}
        className="flex flex-col flex-1"
      >
        <div className="space-y-5 flex-1">
          {/* Customer Details */}
          <SectionCard
            icon={Building2}
            title="Customer Details"
            description="Basic identity and classification"
            accentColor="bg-gradient-to-br from-blue-500 to-blue-600"
            bgTint="bg-gradient-to-br from-blue-50/50 via-white to-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Trading Name"
                required
                tooltip="The name this customer trades under — shown on invoices"
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
                tooltip="Full legal registered name, if different from the trading name"
                placeholder="Acme Limited Liability Company"
                error={serverError.legal_name}
                {...register('legal_name', {
                  maxLength: { value: 200, message: 'Legal name must be 200 characters or fewer' },
                })}
              />
              <Controller
                name="customer_type"
                control={control}
                rules={{ required: 'Customer type is required' }}
                render={({ field, fieldState }) => (
                  <Select
                    label="Customer Type"
                    required
                    tooltip="B2B — business buyer. B2G — government entity. B2C — individual consumer."
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    options={[
                      { value: 'b2b', label: 'B2B — Business to Business' },
                      { value: 'b2g', label: 'B2G — Business to Government' },
                      { value: 'b2c', label: 'B2C — Business to Consumer' },
                    ]}
                  />
                )}
              />
            </div>
          </SectionCard>

          {/* Tax Information */}
          <SectionCard
            icon={Receipt}
            title="Tax Information"
            description="TRN and VAT registration details"
            accentColor="bg-gradient-to-br from-indigo-500 to-indigo-600"
            bgTint="bg-gradient-to-br from-indigo-50/50 via-white to-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label={needsTRN ? 'TRN' : 'TRN (optional)'}
                required={needsTRN}
                tooltip="UAE Tax Registration Number — exactly 15 numeric digits"
                placeholder="123456789012345"
                hint={needsTRN ? 'Required for B2B / B2G — 15 digits' : '15-digit TRN'}
                error={errors.trn?.message || serverError.trn}
                inputMode="numeric"
                maxLength={15}
                onKeyDown={numericOnlyKeyDown}
                {...register('trn', {
                  validate: (v) => validateTRN(v, needsTRN),
                })}
              />
              <Input
                label="VAT Number (optional)"
                required={needsVAT}
                tooltip="Optional VAT / tax number for international customers"
                placeholder="123456789012345"
                hint="15-digit international VAT number"
                error={errors.vat_number?.message || serverError.vat_number}
                inputMode="numeric"
                maxLength={15}
                disabled={vatSameAsTrn}
                onKeyDown={numericOnlyKeyDown}
                {...register('vat_number', {
                  validate: (v) => {
                    if (!v?.trim()) return needsVAT ? 'VAT number is required for international customers' : true;
                    if (!/^\d+$/.test(v)) return 'VAT number must contain digits only';
                    if (v.length !== 15) return `VAT number must be exactly 15 digits (you entered ${v.length})`;
                    return true;
                  },
                })}
              />
              <Input
                label="TRN Issue Date"
                type="date"
                tooltip="Date the TRN was issued by the FTA"
                error={errors.trn_issue_date?.message}
                {...register('trn_issue_date')}
              />
              <Input
                label="TRN Expiry Date"
                type="date"
                tooltip="TRN expiry / validity end date"
                error={errors.trn_expiry_date?.message}
                {...register('trn_expiry_date')}
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer select-none p-3.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">
              <input
                type="checkbox"
                checked={vatSameAsTrn}
                onChange={(e) => setVatSameAsTrn(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium">VAT Number same as TRN</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Auto-fills the VAT field with the TRN value</p>
              </div>
            </label>
          </SectionCard>

          {/* Address & Contact */}
          <SectionCard
            icon={MapPin}
            title="Address & Contact"
            description="Location and communication details"
            accentColor="bg-gradient-to-br from-emerald-500 to-emerald-600"
            bgTint="bg-gradient-to-br from-emerald-50/50 via-white to-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Controller
                name="country"
                control={control}
                rules={{ required: 'Country is required' }}
                render={({ field, fieldState }) => (
                  <CountrySelect
                    label="Country"
                    required
                    tooltip="Country where this customer is registered or based"
                    value={field.value ?? ''}
                    onChange={(val) => {
                      field.onChange(val);
                      setValue('country', val, { shouldValidate: true });
                      setValue('city', '');
                      countryForm.handleCountryChange(val);
                    }}
                    error={fieldState.error?.message || serverError.country}
                  />
                )}
              />
              <Controller
                name="city"
                control={control}
                rules={{ required: 'City is required' }}
                render={({ field, fieldState }) => (
                  <CitySelect
                    label="City"
                    required
                    tooltip="Customer's city — options update based on the selected country"
                    countryCode={watchedCountry}
                    value={field.value ?? ''}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message || serverError.city}
                  />
                )}
              />
              <Input
                label="Email"
                type="email"
                required
                tooltip="Billing email — used to deliver invoices"
                placeholder="billing@customer.ae"
                error={errors.email?.message || serverError.email}
                {...register('email', {
                  required: 'Email is required',
                  validate: (v) => validateEmail(v),
                })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Street Address"
                required
                tooltip="Full street address including building number, street name, and area"
                placeholder="Office 101, Business Bay Tower, Business Bay"
                error={errors.street_address?.message || serverError.street_address}
                {...register('street_address', {
                  required: 'Street address is required',
                  minLength: { value: 5, message: 'Please enter a more complete street address' },
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
                    tooltip={`Contact phone — exactly ${countryForm.phoneLength} digits`}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Payment terms, special requirements, etc."
                  className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  {...register('notes', {
                    maxLength: { value: 500, message: 'Notes must be 500 characters or fewer' },
                  })}
                />
                {errors.notes && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <XCircle className="h-3 w-3 shrink-0" /> {errors.notes.message}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Documents */}
          <SectionCard
            icon={FileText}
            title="Documents"
            description="Required files to register this customer"
            accentColor="bg-gradient-to-br from-violet-500 to-violet-600"
            bgTint="bg-gradient-to-br from-violet-50/50 via-white to-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* TRN certificate */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  TRN Certificate <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
                             file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium
                             file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  {...register('trn_document', {
                    required: isEdit ? false : 'TRN certificate is required',
                    validate: (f) => {
                      const file = f?.[0];
                      if (!file) return isEdit ? true : 'TRN certificate is required';
                      if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name))
                        return 'Only PDF, JPG or PNG files are allowed';
                      if (file.size > 5 * 1024 * 1024) return 'File must be 5MB or smaller';
                      return true;
                    },
                  })}
                />
                <p className="text-[11px] text-gray-400">PDF, JPG or PNG — max 5MB</p>
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
                             file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium
                             file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  {...register('logo', {
                    required: isEdit ? false : 'Customer logo is required',
                    validate: (f) => {
                      const file = f?.[0];
                      if (!file) return isEdit ? true : 'Customer logo is required';
                      if (!/\.(jpg|jpeg|png)$/i.test(file.name))
                        return 'Only JPG or PNG images are allowed';
                      if (file.size > 5 * 1024 * 1024) return 'Image must be 5MB or smaller';
                      return true;
                    },
                  })}
                />
                <p className="text-[11px] text-gray-400">JPG or PNG — max 5MB</p>
                {logoFile?.[0] && (
                  <p className="text-[11px] text-green-600 truncate">✓ {logoFile[0].name}</p>
                )}
                {(errors.logo?.message || serverError.logo) && (
                  <p className="text-xs text-red-600">⚠ {errors.logo?.message || serverError.logo}</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Action bar */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm mt-6 px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 hidden sm:block">
            Fields marked with <span className="text-red-500">*</span> are required
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="secondary" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                <Save className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isSubmitting
                ? (isEdit ? 'Saving…' : 'Creating…')
                : (isEdit ? 'Save Changes' : 'Create Customer')
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
