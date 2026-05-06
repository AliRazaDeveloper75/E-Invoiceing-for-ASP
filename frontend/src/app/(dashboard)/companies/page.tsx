'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import { Building2, Plus, X } from 'lucide-react';
import { AxiosError } from 'axios';
import type { Company } from '@/types';

function fetcher() {
  return api.get<{ success: boolean; data: Company[] }>('/companies/').then((r) => r.data.data);
}

interface CreateForm {
  name: string;
  legal_name: string;
  trn: string;
  street_address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
}

export default function CompaniesPage() {
  const { data: companies = [], mutate } = useSWR<Company[]>('/companies/', fetcher);
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState('');

  const countryForm = useCountryForm('AE');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ defaultValues: { country: 'AE' } });

  const watchedCountry = watch('country');

  const onSubmit = async (data: CreateForm) => {
    setServerError('');
    try {
      const phone = data.phone
        ? `${countryForm.dialCode}${data.phone}`.trim()
        : '';
      await api.post('/companies/', { ...data, phone });
      await mutate();
      setShowForm(false);
      reset();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setServerError(e.response?.data?.error?.message ?? 'Failed to create company.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">New Company</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Trading Name"
                placeholder="Acme LLC"
                error={errors.name?.message}
                {...register('name', { required: 'Required' })}
              />
              <Input
                label="Legal Name"
                placeholder="Acme Limited Liability Company"
                {...register('legal_name')}
              />
            </div>
            <Input
              label="TRN (15 digits)"
              placeholder="123456789012345"
              hint="UAE Tax Registration Number — exactly 15 numeric digits"
              error={errors.trn?.message}
              maxLength={15}
              inputMode="numeric"
              onKeyDown={(e) => {
                const nav = ['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight','Home','End'];
                if (!nav.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
              }}
              {...register('trn', {
                required: 'TRN is required',
                pattern: { value: /^\d{15}$/, message: 'Must be exactly 15 digits' },
                maxLength: { value: 15, message: 'Must be exactly 15 digits' },
              })}
            />
            <Input
              label="Street Address"
              {...register('street_address', { required: 'Required' })}
              error={errors.street_address?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <CountrySelect
                label="Country"
                error={errors.country?.message}
                {...register('country', { required: 'Required' })}
                onChange={(e) => {
                  setValue('country', e.target.value, { shouldValidate: true });
                  setValue('city', '');
                  countryForm.handleCountryChange(e.target.value);
                }}
              />
              <CitySelect
                label="City"
                countryCode={watchedCountry}
                error={errors.city?.message}
                {...register('city', { required: 'Required' })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    label="Phone"
                    dialCode={countryForm.dialCode}
                    flag={countryForm.flag}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
              <Input label="Email" type="email" {...register('email')} />
            </div>
            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>Create Company</Button>
            </div>
          </form>
        </div>
      )}

      {/* Company list */}
      {companies.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No companies yet</p>
          <p className="text-sm mt-1">Create your first company to start issuing invoices.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => (
            <div key={company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{company.legal_name}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p className="font-mono text-xs">TRN: {company.trn}</p>
                  <p className="text-xs mt-0.5">{company.member_count} member{company.member_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2">{company.formatted_address}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
