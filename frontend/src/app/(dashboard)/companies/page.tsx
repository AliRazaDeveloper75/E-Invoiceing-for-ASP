'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import { useAuth } from '@/context/AuthContext';
import {
  Building2, Plus, X, Eye, Pencil, Trash2,
  Phone, Mail, MapPin, Users, Hash, Globe, AlertTriangle,
  CheckSquare, Square, Layers,
} from 'lucide-react';
import { AxiosError } from 'axios';
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

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const rows: { icon: React.ElementType; label: string; value: string | number | null | undefined }[] = [
    { icon: Hash,    label: 'TRN',             value: company.trn },
    { icon: MapPin,  label: 'Address',          value: company.formatted_address },
    { icon: Phone,   label: 'Phone',            value: company.phone },
    { icon: Mail,    label: 'Email',            value: company.email },
    { icon: Globe,   label: 'Website',          value: company.website },
    { icon: Users,   label: 'Members',          value: company.member_count },
    { icon: Hash,    label: 'E-Invoice Endpoint',  value: company.peppol_endpoint },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{company.name}</h2>
              {company.legal_name && company.legal_name !== company.name && (
                <p className="text-xs text-gray-400">{company.legal_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          {rows.map(({ icon: Icon, label, value }) =>
            value ? (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm text-gray-800 font-mono">{String(value)}</p>
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal (single or bulk) ───────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
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

        {/* Progress bar during bulk delete */}
        {loading && isBulk && (
          <div className="mx-6 mb-4">
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
          <div className="mx-6 mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700">{e}</p>
            ))}
          </div>
        )}

        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {errors.length > 0 ? 'Close' : 'Cancel'}
          </button>
          {errors.length < targets.length && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-5 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Deleting…' : isBulk ? `Delete All (${targets.length})` : 'Delete Company'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Company Form (create + edit) ────────────────────────────────────────────

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

      if (mode === 'create') {
        await api.post('/companies/', { ...data, phone });
      } else {
        await api.put(`/companies/${initial!.id}/`, { ...data, phone });
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-800">
          {mode === 'create' ? 'New Company' : `Edit — ${initial?.name}`}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {mode === 'create' ? 'Create Company' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: companies = [], mutate } = useSWR<Company[]>('/companies/', fetcher);

  type PanelMode = null | 'create' | 'edit';
  const [panelMode,  setPanelMode]  = useState<PanelMode>(null);
  const [viewTarget, setViewTarget] = useState<Company | null>(null);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [delTargets, setDelTargets] = useState<Company[]>([]);

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function openCreate() { setEditTarget(null); setPanelMode('create'); }
  function openEdit(c: Company) { setEditTarget(c); setPanelMode('edit'); }
  function closePanel() { setPanelMode(null); setEditTarget(null); }

  // Open the create panel automatically when arriving via "+ Add new company" (?new=1)
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setPanelMode('create');
      setEditTarget(null);
      router.replace('/companies'); // clear the query param
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      {/* Create / Edit form panel */}
      {panelMode && (
        <CompanyFormPanel
          mode={panelMode}
          initial={editTarget ?? undefined}
          onClose={closePanel}
          onSaved={() => mutate()}
        />
      )}

      {/* Bulk action bar — admin only, appears when items selected */}
      {isAdmin && companies.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Select all toggle */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-brand-600" />
            ) : someSelected ? (
              <Layers className="h-4 w-4 text-brand-400" />
            ) : (
              <Square className="h-4 w-4 text-gray-400" />
            )}
            <span className="font-medium">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </button>

          {selectedCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{selectedCount}</span> selected
              </span>
              <button
                onClick={openBulkDelete}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected ({selectedCount})
              </button>
            </>
          )}
        </div>
      )}

      {/* Company list */}
      {companies.length === 0 && !panelMode ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No companies yet</p>
          <p className="text-sm mt-1">Create your first company to start issuing invoices.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => {
            const isChecked = selected.has(company.id);
            return (
              <div
                key={company.id}
                className={`bg-white rounded-xl border shadow-sm p-5 hover:border-gray-300 transition-colors ${
                  isChecked ? 'border-brand-400 ring-1 ring-brand-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox + Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    {isAdmin && (
                      <button
                        onClick={() => toggleSelect(company.id)}
                        className="shrink-0 text-gray-300 hover:text-brand-500 transition-colors"
                      >
                        {isChecked
                          ? <CheckSquare className="h-5 w-5 text-brand-500" />
                          : <Square className="h-5 w-5" />
                        }
                      </button>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                      <span className="text-brand-600 font-bold text-sm">
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

                  {/* Meta + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
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
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(company)}
                          title="Edit company"
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDelTargets([company])}
                          title="Delete company"
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {company.formatted_address && (
                  <p className="text-sm text-gray-400 mt-3 pl-[52px]">{company.formatted_address}</p>
                )}
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
