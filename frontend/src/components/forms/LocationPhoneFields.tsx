'use client';

import React from 'react';
import { Controller, type Control, type FieldErrors, type UseFormSetValue, type UseFormWatch } from 'react-hook-form';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useCountryForm } from '@/hooks/useCountryForm';
import { validatePhoneNumber } from '@/lib/validation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = Record<string, any>;

interface FieldNames {
  country?: string;
  city?: string;
  language?: string;
  phone?: string;
}

interface LocationPhoneFieldsProps {
  control: Control<AnyForm>;
  errors: FieldErrors<AnyForm>;
  setValue: UseFormSetValue<AnyForm>;
  watch: UseFormWatch<AnyForm>;
  defaultCountry?: string;
  /** Customise field names if your form uses different keys. */
  fieldNames?: FieldNames;
  /** Show the language field (auto-populated). Defaults to true. */
  showLanguage?: boolean;
  /** Require all fields. Defaults to true. */
  required?: boolean;
}

const DEFAULT_FIELDS: Required<FieldNames> = {
  country: 'country',
  city: 'city',
  language: 'language',
  phone: 'phone',
};

/**
 * Drop-in reusable group: Country → City (auto-populated) + Language (auto) + Phone (dial code auto).
 *
 * Example usage inside any react-hook-form form:
 *
 *   const { control, errors, setValue, watch } = useForm({ defaultValues: { country: 'AE', ... } });
 *
 *   <LocationPhoneFields
 *     control={control}
 *     errors={errors}
 *     setValue={setValue}
 *     watch={watch}
 *     defaultCountry="AE"
 *   />
 *
 * On submit, the form values will contain: country, city, language, phone (local digits).
 * Combine phone with dial code: `${dialCode}${data.phone}` if you need E.164 format.
 */
export function LocationPhoneFields({
  control,
  errors,
  setValue,
  watch,
  defaultCountry = 'AE',
  fieldNames,
  showLanguage = true,
  required = true,
}: LocationPhoneFieldsProps) {
  const fields = { ...DEFAULT_FIELDS, ...fieldNames };

  const countryForm = useCountryForm(defaultCountry);

  // Keep the hook in sync with the form's country field value
  const watchedCountry: string = watch(fields.country) ?? defaultCountry;

  // When hook's countryCode differs from watched value (e.g. form reset), sync it
  React.useEffect(() => {
    if (watchedCountry && watchedCountry !== countryForm.countryCode) {
      countryForm.handleCountryChange(watchedCountry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCountry]);

  const handleCountryChange = (code: string) => {
    countryForm.handleCountryChange(code);
    setValue(fields.country, code, { shouldValidate: true });
    setValue(fields.city, '', { shouldValidate: false });
    if (showLanguage && countryForm.languages.length > 0) {
      // languages from old country; new ones available next tick — set after state update
      setTimeout(() => {
        const newLangs = countryForm.selectedCountry?.languages;
        if (newLangs?.length) setValue(fields.language, newLangs[0]);
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Country + City — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <Controller
          name={fields.country}
          control={control}
          rules={required ? { required: 'Country is required' } : undefined}
          render={({ field }) => (
            <CountrySelect
              label="Country"
              value={field.value ?? ''}
              onChange={(val) => handleCountryChange(val)}
              error={errors[fields.country]?.message as string | undefined}
            />
          )}
        />

        {/* City — populates from country */}
        <Controller
          name={fields.city}
          control={control}
          rules={required ? { required: 'City is required' } : undefined}
          render={({ field }) => (
            <CitySelect
              label="City"
              countryCode={watchedCountry}
              value={field.value ?? ''}
              onChange={(val) => {
                field.onChange(val);
                countryForm.handleCityChange(val);
              }}
              error={errors[fields.city]?.message as string | undefined}
            />
          )}
        />
      </div>

      {/* Language + Phone — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Language — auto-filled, user can override */}
        {showLanguage && (
          <Controller
            name={fields.language}
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Language</label>
                <select
                  {...field}
                  value={field.value ?? countryForm.languages[0] ?? ''}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {countryForm.languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                  {/* Show other common languages as well */}
                  {['Arabic', 'English', 'French', 'Spanish', 'German', 'Hindi', 'Urdu', 'Mandarin', 'Portuguese', 'Turkish']
                    .filter((l) => !countryForm.languages.includes(l))
                    .map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                </select>
                {errors[fields.language]?.message && (
                  <p className="text-xs text-red-600">{errors[fields.language]?.message as string}</p>
                )}
              </div>
            )}
          />
        )}

        {/* Phone — dial code auto-set from country */}
        <Controller
          name={fields.phone}
          control={control}
          rules={
            required
              ? {
                  required: 'Phone number is required',
                  validate: (v: string) => validatePhoneNumber(v, countryForm.dialCode),
                }
              : undefined
          }
          render={({ field }) => (
            <PhoneInput
              label="Phone number"
              dialCode={countryForm.dialCode}
              flag={countryForm.flag}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              error={errors[fields.phone]?.message as string | undefined}
            />
          )}
        />
      </div>
    </div>
  );
}
