'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import { AxiosError } from 'axios';

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

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    defaultValues: {
      customer_type: 'b2b',
      country: 'AE',
    },
  });

  const customerType = watch('customer_type');
  const country = watch('country');
  const isUAE = country === 'AE';
  const needsTRN = isUAE && (customerType === 'b2b' || customerType === 'b2g');

  const onSubmit = async (data: CustomerForm) => {
    setServerError({});
    try {
      await api.post('/customers/', {
        ...data,
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
              label="Name *"
              placeholder="Acme LLC"
              error={errors.name?.message || serverError.name}
              {...register('name', { required: 'Name is required' })}
            />
            <Input
              label="Legal Name"
              placeholder="Acme Limited Liability Company"
              error={serverError.legal_name}
              {...register('legal_name')}
            />
          </div>

          <Select
            label="Customer Type *"
            error={errors.customer_type?.message}
            {...register('customer_type', { required: true })}
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
              label={`TRN ${needsTRN ? '*' : '(optional)'}`}
              placeholder="123456789012345"
              hint={needsTRN ? 'Required for UAE B2B / B2G — 15 digits' : '15-digit UAE Tax Registration Number'}
              error={errors.trn?.message || serverError.trn}
              {...register('trn', {
                validate: (v) => {
                  if (!v) return true; // optional unless needsTRN (backend validates)
                  if (!/^\d{15}$/.test(v)) return 'TRN must be exactly 15 digits';
                  return true;
                },
              })}
            />
            <Input
              label="VAT Number (international)"
              placeholder="e.g. GB123456789"
              hint="For non-UAE customers"
              error={serverError.vat_number}
              {...register('vat_number')}
            />
          </div>
        </div>

        {/* Address & Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Address & Contact</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Country *"
              placeholder="AE"
              hint="2-letter ISO code (AE, US, GB…)"
              error={errors.country?.message || serverError.country}
              {...register('country', {
                required: 'Country is required',
                pattern: { value: /^[A-Za-z]{2}$/, message: 'Must be a 2-letter code' },
              })}
            />
            <Input
              label="City"
              placeholder="Dubai"
              error={serverError.city}
              {...register('city')}
            />
          </div>

          <Input
            label="Street Address"
            placeholder="Office 101, Business Bay"
            error={serverError.street_address}
            {...register('street_address')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="billing@customer.ae"
              error={errors.email?.message || serverError.email}
              {...register('email', {
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+971 4 000 0000"
              error={serverError.phone}
              {...register('phone')}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes about this customer"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400"
              {...register('notes')}
            />
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
