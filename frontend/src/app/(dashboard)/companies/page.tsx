'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import { useAuth } from '@/context/AuthContext';
import {
  Building2, Plus, X, Eye, Pencil, Trash2,
  Phone, Mail, MapPin, Users, Hash, Globe, AlertTriangle,
  CheckSquare, Square, Layers, Loader2, ArrowUpRight,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { clsx } from 'clsx';
import type { Company } from '@/types';
import {
  emailValidators, validateTRN, validateWebsite,
  numericOnlyKeyDown, validatePhoneNumber,
} from '@/lib/validation';

async function fetcher() {
  const r = await api.get<{ success: boolean; data: Company[] }>('/companies/');
  return r.data.data;
}

interface CompanyForm {
  name: string;
  legal_name: string;
  trn: string;
  trn_issue_date?: string;
  trn_expiry_date?: string;
  street_address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
}

function ViewModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const rows: { icon: React.ElementType; label: string; value: string | number | null | undefined }[] = [
    { icon: Hash,    label: 'TRN',             value: company.trn },
    { icon: MapPin,  label: 'Address',          value: company.formatted_address },
    { icon: Phone,   label: 'Phone',            value: company.phone },
    { icon: Mail,    label: 'Email',            value: company.email },
    { icon: Globe,   label: 'Website',          value: company.website },
    { icon: Users,   label: 'Members',          value: company.member_count },
    { icon: Hash,    label: 'E-Invoice Endpoint', value: company.peppol_endpoint },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-blue-200/60 before:to-transparent">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-blue-100/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{company.name}</h2>
              {company.legal_name && company.legal_name !== company.name && (
                <p className="text-xs text-gray-400 truncate">{company.legal_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 space-y-4">
          {rows.map(({ icon: Icon, label, value }) =>
            value ? (
              <div key={label} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-gray-800 font-medium break-words">{String(value)}</p>
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  targets,
  onClose,
  onDeleted,
}: {
  targets: Company[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors]     = useState<string[]>([]);
  const isBulk = targets.length > 1;

  async function handleDelete() {
    setLoading(true);
    setErrors([]);
    const errs: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      try {
        await api.delete(`/companies/${targets[i].id}/`);
      } catch {
        errs.push(`"${targets[i].name}" could not be deleted.`);
      }
      setProgress(i + 1);
    }

    setErrors(errs);
    setLoading(false);

    if (errs.length < targets.length) {
      onDeleted();
    }
    if (errs.length === 0) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-red-200/60 before:to-transparent">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-red-100/60">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900">
              {isBulk ? `Delete ${targets.length} Companies` : 'Delete Company'}
            </h2>
            {isBulk ? (
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {targets.map(c => (
                  <p key={c.id} className="text-sm text-gray-600 truncate">• {c.name}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-700">{targets[0]?.name}</span>?
                This action cannot be undone.
              </p>
            )}
          </div>
        </div>

        {loading && isBulk && (
          <div className="mx-4 sm:mx-6 mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Deleting…</span>
              <span>{progress} / {targets.length}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${(progress / targets.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mx-4 sm:mx-6 mb-4 rounded-xl bg-red-50/80 border border-red-200/60 px-4 py-3 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700">{e}</p>
            ))}
          </div>
        )}

        <div className="px-4 sm:px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {errors.length > 0 ? 'Close' : 'Cancel'}
          </button>
          {errors.length < targets.length && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Deleting…' : isBulk ? `Delete All (${targets.length})` : 'Delete Company'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyFormPanel({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState('');
  const countryForm = useCountryForm(initial?.country || 'AE');
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(initial?.logo_url ?? '');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm>({
    defaultValues: {
      name:           initial?.name           ?? '',
      legal_name:     initial?.legal_name     ?? '',
      trn:            initial?.trn            ?? '',
      trn_issue_date:  initial?.trn_issue_date  ?? '',
      trn_expiry_date: initial?.trn_expiry_date ?? '',
      street_address: initial?.street_address ?? '',
      city:           initial?.city           ?? '',
      country:        initial?.country        ?? 'AE',
      phone:          initial?.phone          ?? '',
      email:          initial?.email          ?? '',
      website:        initial?.website        ?? '',
    },
  });

  const watchedCountry = watch('country');

  const onSubmit = async (data: CompanyForm) => {
    setServerError('');
    try {
      const phone = data.phone
        ? `${countryForm.dialCode}${data.phone}`.trim()
        : '';
      const payload = { ...data, phone };
      const url    = mode === 'create' ? '/companies/' : `/companies/${initial!.id}/`;
      const method = mode === 'create' ? 'post' : 'put';

      if (logoFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
        });
        fd.append('logo', logoFile);
        await api[method](url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api[method](url, payload);
      }
      onSaved();
      onClose();
      reset();
    } catch (err) {
      const e = err as AxiosError<{ error?: { message?: string } }>;
      setServerError(e.response?.data?.error?.message ?? `Failed to ${mode} company.`);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 p-4 sm:p-6 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {mode === 'create' ? 'New Company' : `Edit — ${initial?.name}`}
          </h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-blue-50 transition-colors shrink-0">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Company logo"
                 className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60
                            flex items-center justify-center text-[10px] text-blue-400 text-center font-medium">
              No logo
            </div>
          )}
          <div>
            <label className="inline-block cursor-pointer">
              <span className="px-3 py-1.5 rounded-xl border border-gray-200/80 bg-white text-sm font-medium text-gray-600 hover:text-blue-600 hover:border-blue-200/60 hover:bg-blue-50/40 shadow-sm transition-all">
                {logoPreview ? 'Change logo' : 'Upload logo'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                }}
              />
            </label>
            <p className="mt-1 text-xs text-gray-400">PNG or JPG · appears on your invoices.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Trading Name"
            required
            tooltip="The name your company trades under. This will appear on all invoices. E.g. 'Acme LLC'"
            placeholder="Acme LLC"
            error={errors.name?.message}
            {...register('name', {
              required: 'Trading name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
              maxLength: { value: 100, message: 'Name must be 100 characters or fewer' },
            })}
          />
          <Input
            label="Legal Name"
            tooltip="Full legal registered company name, if different from the trading name. E.g. 'Acme Limited Liability Company'"
            placeholder="Acme Limited Liability Company"
            {...register('legal_name', {
              maxLength: { value: 200, message: 'Legal name must be 200 characters or fewer' },
            })}
          />
        </div>

        <Input
          label="TRN"
          required
          tooltip="UAE Tax Registration Number issued by the Federal Tax Authority (FTA). Must be exactly 15 numeric digits. No letters or symbols. E.g. 100123456700003"
          placeholder="100123456700003"
          hint="Exactly 15 numeric digits — no letters or symbols"
          error={errors.trn?.message}
          maxLength={15}
          inputMode="numeric"
          onKeyDown={numericOnlyKeyDown}
          {...register('trn', {
            validate: (v) => validateTRN(v, true),
          })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="TRN Issue Date"
            type="date"
            tooltip="Date your Tax Registration (TRN) was issued by the FTA."
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

        <Input
          label="Street Address"
          required
          tooltip="Full street address including building/office number, street name, and area. E.g. 'Office 501, Al Futtaim Tower, Festival City'"
          placeholder="Office 501, Al Futtaim Tower, Festival City"
          error={errors.street_address?.message}
          {...register('street_address', {
            required: 'Street address is required',
            minLength: { value: 5, message: 'Please enter a more complete street address' },
          })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CountrySelect
            label="Country"
            required
            tooltip="Select the country where your company is registered."
            error={errors.country?.message}
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
            tooltip="Select your company's city. Options update based on the selected country."
            countryCode={watchedCountry}
            error={errors.city?.message}
            {...register('city', { required: 'City is required' })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                tooltip={`Company contact phone number — exactly ${countryForm.phoneLength} digits for the selected country. Enter local number only; the dial code is added automatically.`}
                dialCode={countryForm.dialCode}
                flag={countryForm.flag}
                maxLength={countryForm.phoneLength}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                error={fieldState.error?.message}
              />
            )}
          />
          <Input
            label="Email"
            type="email"
            tooltip="Company contact or billing email address. E.g. info@company.ae"
            placeholder="info@company.ae"
            error={errors.email?.message}
            {...register('email', {
              validate: (v) => {
                if (!v?.trim()) return true;
                return emailValidators.validate.format(v) === true
                  ? emailValidators.validate.noDisposable(v)
                  : emailValidators.validate.format(v);
              },
            })}
          />
        </div>

        <Input
          label="Website"
          tooltip="Company website URL. Must start with http:// or https://. E.g. https://company.ae"
          placeholder="https://company.ae"
          error={errors.website?.message}
          {...register('website', {
            validate: (v) => validateWebsite(v ?? ''),
          })}
        />

        {serverError && (
          <div className="rounded-xl bg-red-50/80 border border-red-200/60 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'Create Company' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: companies = [], mutate, isLoading } = useSWR<Company[]>('/companies/', fetcher);

  type PanelMode = null | 'create' | 'edit';
  const [panelMode,  setPanelMode]  = useState<PanelMode>(null);
  const [viewTarget, setViewTarget] = useState<Company | null>(null);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [delTargets, setDelTargets] = useState<Company[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  function openCreate() { setEditTarget(null); setPanelMode('create'); }
  function openEdit(c: Company) { setEditTarget(c); setPanelMode('edit'); }
  function closePanel() { setPanelMode(null); setEditTarget(null); }

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setPanelMode('create');
      setEditTarget(null);
      router.replace('/companies');
    }
  }, [searchParams, router]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === companies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map(c => c.id)));
    }
  }

  const allSelected    = companies.length > 0 && selected.size === companies.length;
  const someSelected   = selected.size > 0 && !allSelected;
  const selectedCount  = selected.size;

  function openBulkDelete() {
    const targets = companies.filter(c => selected.has(c.id));
    setDelTargets(targets);
  }

  function afterDeleted() {
    setSelected(new Set());
    mutate();
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-950 to-indigo-950 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300/70 uppercase tracking-[0.12em]">Companies</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Companies</h1>
            <p className="text-sm text-blue-200/60 mt-0.5">
              {companies.length > 0 ? `${companies.length} total` : 'Manage your companies'}
            </p>
          </div>
          {!panelMode && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-950 hover:bg-blue-50 px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 shrink-0"
            >
              <Plus className="h-4 w-4" /> Add Company
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit form */}
      {panelMode && (
        <CompanyFormPanel
          mode={panelMode}
          initial={editTarget ?? undefined}
          onClose={closePanel}
          onSaved={() => mutate()}
        />
      )}

      {/* Bulk action bar */}
      {isAdmin && companies.length > 0 && !panelMode && (
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 px-4 py-3 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : someSelected ? (
                <Layers className="h-4 w-4 text-blue-400" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
              <span className="font-medium">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </button>

            {selectedCount > 0 && (
              <>
                <span className="text-gray-200">|</span>
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">{selectedCount}</span> selected
                </span>
                <button
                  onClick={openBulkDelete}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-400 hover:to-red-500 shadow-md shadow-red-500/20 transition-all font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete ({selectedCount})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Company list */}
      {isLoading ? (
        <div className="py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
        </div>
      ) : companies.length === 0 && !panelMode ? (
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border border-blue-100/70 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-blue-400" />
          </div>
          <p className="text-base font-semibold text-gray-900">No companies yet</p>
          <p className="text-sm text-gray-500 mt-1">Create your first company to start issuing invoices.</p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus className="h-4 w-4" /> Add Company
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.filter(c => !panelMode || (panelMode === 'edit' && editTarget?.id !== c.id)).map((company) => {
            const isChecked = selected.has(company.id);
            return (
              <div
                key={company.id}
                className={clsx(
                  'group relative bg-gradient-to-br from-white via-blue-50/20 to-white rounded-2xl border p-4 sm:p-5',
                  'shadow-[0_4px_16px_-4px_rgba(59,130,246,0.12),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.2)] hover:-translate-y-[1px] transition-all duration-300',
                  'before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent',
                  isChecked
                    ? 'border-blue-300/80 ring-1 ring-blue-200/60'
                    : 'border-blue-100/70',
                )}
              >
                {/* Desktop layout */}
                <div className="hidden sm:block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {isAdmin && (
                        <button
                          onClick={() => toggleSelect(company.id)}
                          className="shrink-0 text-gray-300 hover:text-blue-500 transition-colors"
                        >
                          {isChecked
                            ? <CheckSquare className="h-5 w-5 text-blue-500" />
                            : <Square className="h-5 w-5" />
                          }
                        </button>
                      )}
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                        <span className="text-white font-bold text-sm">
                          {company.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                        {company.legal_name && company.legal_name !== company.name && (
                          <p className="text-sm text-gray-500 truncate">{company.legal_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-mono text-gray-500">TRN: {company.trn}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {company.member_count} member{company.member_count !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewTarget(company)}
                            title="View details"
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(company)}
                            title="Edit company"
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDelTargets([company])}
                            title="Delete company"
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50/60 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {company.formatted_address && (
                    <p className="text-sm text-gray-400 mt-3 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      {company.formatted_address}
                    </p>
                  )}
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {isAdmin && (
                      <button
                        onClick={() => toggleSelect(company.id)}
                        className="shrink-0 text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        {isChecked
                          ? <CheckSquare className="h-5 w-5 text-blue-500" />
                          : <Square className="h-5 w-5" />
                        }
                      </button>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                      <span className="text-white font-bold text-sm">
                        {company.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                      {company.legal_name && company.legal_name !== company.name && (
                        <p className="text-xs text-gray-500 truncate">{company.legal_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 ml-[52px]">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-mono">TRN: {company.trn}</span>
                      <span className="text-gray-200">|</span>
                      <span>{company.member_count} member{company.member_count !== 1 ? 's' : ''}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewTarget(company)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(company)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDelTargets([company])}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50/60 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {company.formatted_address && (
                    <p className="text-xs text-gray-400 mt-2 ml-[52px] flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-gray-300 shrink-0" />
                      {company.formatted_address}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {viewTarget && (
        <ViewModal company={viewTarget} onClose={() => setViewTarget(null)} />
      )}
      {delTargets.length > 0 && (
        <DeleteModal
          targets={delTargets}
          onClose={() => setDelTargets([])}
          onDeleted={afterDeleted}
        />
      )}
    </div>
  );
}
