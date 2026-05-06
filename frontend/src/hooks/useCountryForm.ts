import { useState, useMemo, useCallback } from 'react';
import {
  COUNTRY_OPTIONS,
  getCountryByCode,
  getCitiesForCountry,
  getDialCode,
  getLanguages,
  getFlag,
  type CountryData,
} from '@/data/countries';

export interface CountryFormState {
  // Dropdown option lists
  countryOptions: Array<{ value: string; label: string; flag: string; dialCode: string }>;
  cityOptions: Array<{ value: string; label: string }>;

  // Current selected values
  countryCode: string;
  cityValue: string;
  dialCode: string;
  flag: string;
  languages: string[];
  selectedCountry: CountryData | null;

  // Handlers — call these from your form's onChange or react-hook-form setValue side effects
  handleCountryChange: (code: string) => void;
  handleCityChange: (city: string) => void;
  reset: (defaultCountryCode?: string) => void;
}

export function useCountryForm(defaultCountryCode = 'AE'): CountryFormState {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [cityValue, setCityValue] = useState('');

  // Stable dropdown list — built once from COUNTRY_OPTIONS
  const countryOptions = useMemo(
    () =>
      COUNTRY_OPTIONS.map((c) => ({
        value: c.code,
        label: `${c.flag} ${c.name}`,
        flag: c.flag,
        dialCode: c.dialCode,
      })),
    []
  );

  // City options update reactively when countryCode changes
  const cityOptions = useMemo(
    () =>
      getCitiesForCountry(countryCode).map((city) => ({
        value: city,
        label: city,
      })),
    [countryCode]
  );

  const selectedCountry = useMemo(() => getCountryByCode(countryCode) ?? null, [countryCode]);
  const dialCode = useMemo(() => getDialCode(countryCode), [countryCode]);
  const flag = useMemo(() => getFlag(countryCode), [countryCode]);
  const languages = useMemo(() => getLanguages(countryCode), [countryCode]);

  const handleCountryChange = useCallback((code: string) => {
    setCountryCode(code);
    setCityValue(''); // reset city whenever country changes
  }, []);

  const handleCityChange = useCallback((city: string) => {
    setCityValue(city);
  }, []);

  const reset = useCallback((defaultCode = 'AE') => {
    setCountryCode(defaultCode);
    setCityValue('');
  }, []);

  return {
    countryOptions,
    cityOptions,
    countryCode,
    cityValue,
    dialCode,
    flag,
    languages,
    selectedCountry,
    handleCountryChange,
    handleCityChange,
    reset,
  };
}
