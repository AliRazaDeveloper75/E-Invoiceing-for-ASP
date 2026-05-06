export interface CountryData {
  name: string;
  code: string;       // ISO 3166-1 alpha-2
  dialCode: string;   // e.g. "+971"
  flag: string;       // Unicode flag emoji
  cities: string[];
  languages: string[];
  currency: string;
}

export const COUNTRIES: CountryData[] = [
  // ── Middle East / GCC ────────────────────────────────────────────────────
  {
    name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪',
    cities: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Al Ain', 'Khor Fakkan', 'Dibba Al Hisn'],
    languages: ['Arabic'], currency: 'AED',
  },
  {
    name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦',
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Al Khobar', 'Tabuk', 'Abha', 'Hail', 'Taif'],
    languages: ['Arabic'], currency: 'SAR',
  },
  {
    name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦',
    cities: ['Doha', 'Al Wakrah', 'Al Khor', 'Lusail', 'Dukhan', 'Mesaieed', 'Al Rayyan'],
    languages: ['Arabic'], currency: 'QAR',
  },
  {
    name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼',
    cities: ['Kuwait City', 'Salmiya', 'Hawalli', 'Farwaniya', 'Jahra', 'Ahmadi', 'Mangaf'],
    languages: ['Arabic'], currency: 'KWD',
  },
  {
    name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭',
    cities: ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Isa Town', 'Sitra', 'Budaiya'],
    languages: ['Arabic'], currency: 'BHD',
  },
  {
    name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲',
    cities: ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Ibra', 'Barka', 'Rustaq'],
    languages: ['Arabic'], currency: 'OMR',
  },
  {
    name: 'Jordan', code: 'JO', dialCode: '+962', flag: '🇯🇴',
    cities: ['Amman', 'Zarqa', 'Aqaba', 'Irbid', 'Salt', 'Madaba', 'Karak'],
    languages: ['Arabic'], currency: 'JOD',
  },
  {
    name: 'Lebanon', code: 'LB', dialCode: '+961', flag: '🇱🇧',
    cities: ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Jounieh', 'Baalbek', 'Zahle'],
    languages: ['Arabic', 'French'], currency: 'LBP',
  },
  {
    name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez', 'Mansoura'],
    languages: ['Arabic'], currency: 'EGP',
  },
  {
    name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep'],
    languages: ['Turkish'], currency: 'TRY',
  },
  {
    name: 'Iran', code: 'IR', dialCode: '+98', flag: '🇮🇷',
    cities: ['Tehran', 'Mashhad', 'Isfahan', 'Karaj', 'Tabriz', 'Shiraz', 'Ahvaz'],
    languages: ['Persian'], currency: 'IRR',
  },
  {
    name: 'Iraq', code: 'IQ', dialCode: '+964', flag: '🇮🇶',
    cities: ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf', 'Karbala', 'Kirkuk'],
    languages: ['Arabic', 'Kurdish'], currency: 'IQD',
  },
  {
    name: 'Yemen', code: 'YE', dialCode: '+967', flag: '🇾🇪',
    cities: ['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Ibb', 'Mukalla'],
    languages: ['Arabic'], currency: 'YER',
  },
  {
    name: 'Syria', code: 'SY', dialCode: '+963', flag: '🇸🇾',
    cities: ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Deir ez-Zor'],
    languages: ['Arabic'], currency: 'SYP',
  },
  // ── South Asia ───────────────────────────────────────────────────────────
  {
    name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰',
    cities: ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala'],
    languages: ['Urdu', 'English'], currency: 'PKR',
  },
  {
    name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳',
    cities: ['Mumbai', 'New Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Surat'],
    languages: ['Hindi', 'English'], currency: 'INR',
  },
  {
    name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩',
    cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Rajshahi', 'Comilla'],
    languages: ['Bengali'], currency: 'BDT',
  },
  {
    name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰',
    cities: ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Kurunegala'],
    languages: ['Sinhala', 'Tamil', 'English'], currency: 'LKR',
  },
  {
    name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵',
    cities: ['Kathmandu', 'Pokhara', 'Lalitpur', 'Biratnagar', 'Birgunj'],
    languages: ['Nepali'], currency: 'NPR',
  },
  {
    name: 'Afghanistan', code: 'AF', dialCode: '+93', flag: '🇦🇫',
    cities: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Kunduz'],
    languages: ['Pashto', 'Dari'], currency: 'AFN',
  },
  // ── Southeast Asia ───────────────────────────────────────────────────────
  {
    name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭',
    cities: ['Manila', 'Quezon City', 'Cebu', 'Davao', 'Makati', 'Pasig', 'Taguig'],
    languages: ['Filipino', 'English'], currency: 'PHP',
  },
  {
    name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩',
    cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Bekasi', 'Tangerang', 'Makassar'],
    languages: ['Indonesian'], currency: 'IDR',
  },
  {
    name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾',
    cities: ['Kuala Lumpur', 'Johor Bahru', 'Penang', 'Ipoh', 'Shah Alam', 'Klang', 'Kota Kinabalu'],
    languages: ['Malay', 'English'], currency: 'MYR',
  },
  {
    name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭',
    cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Nonthaburi', 'Hat Yai'],
    languages: ['Thai'], currency: 'THB',
  },
  {
    name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬',
    cities: ['Singapore'],
    languages: ['English', 'Malay', 'Mandarin', 'Tamil'], currency: 'SGD',
  },
  {
    name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Can Tho', 'Hai Phong'],
    languages: ['Vietnamese'], currency: 'VND',
  },
  {
    name: 'Myanmar', code: 'MM', dialCode: '+95', flag: '🇲🇲',
    cities: ['Yangon', 'Mandalay', 'Naypyidaw', 'Bago'],
    languages: ['Burmese'], currency: 'MMK',
  },
  {
    name: 'Cambodia', code: 'KH', dialCode: '+855', flag: '🇰🇭',
    cities: ['Phnom Penh', 'Siem Reap', 'Battambang', 'Kampong Cham'],
    languages: ['Khmer'], currency: 'KHR',
  },
  // ── East Asia ────────────────────────────────────────────────────────────
  {
    name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳',
    cities: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Tianjin', 'Wuhan', "Xi'an", 'Hangzhou', 'Nanjing'],
    languages: ['Mandarin'], currency: 'CNY',
  },
  {
    name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵',
    cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto'],
    languages: ['Japanese'], currency: 'JPY',
  },
  {
    name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Suwon'],
    languages: ['Korean'], currency: 'KRW',
  },
  {
    name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰',
    cities: ['Hong Kong', 'Kowloon', 'Tsuen Wan', 'Tuen Mun', 'Sha Tin'],
    languages: ['Cantonese', 'English'], currency: 'HKD',
  },
  {
    name: 'Taiwan', code: 'TW', dialCode: '+886', flag: '🇹🇼',
    cities: ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan', 'Hsinchu'],
    languages: ['Mandarin'], currency: 'TWD',
  },
  // ── Central Asia ─────────────────────────────────────────────────────────
  {
    name: 'Kazakhstan', code: 'KZ', dialCode: '+7', flag: '🇰🇿',
    cities: ['Almaty', 'Nur-Sultan', 'Shymkent', 'Aktobe', 'Karaganda'],
    languages: ['Kazakh', 'Russian'], currency: 'KZT',
  },
  {
    name: 'Uzbekistan', code: 'UZ', dialCode: '+998', flag: '🇺🇿',
    cities: ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan'],
    languages: ['Uzbek'], currency: 'UZS',
  },
  // ── Europe ───────────────────────────────────────────────────────────────
  {
    name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹',
    cities: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
    languages: ['German'], currency: 'EUR',
  },
  {
    name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪',
    cities: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège', 'Namur'],
    languages: ['Dutch', 'French', 'German'], currency: 'EUR',
  },
  {
    name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿',
    cities: ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec'],
    languages: ['Czech'], currency: 'CZK',
  },
  {
    name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰',
    cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'],
    languages: ['Danish'], currency: 'DKK',
  },
  {
    name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮',
    cities: ['Helsinki', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä'],
    languages: ['Finnish', 'Swedish'], currency: 'EUR',
  },
  {
    name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷',
    cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Nantes', 'Strasbourg'],
    languages: ['French'], currency: 'EUR',
  },
  {
    name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund'],
    languages: ['German'], currency: 'EUR',
  },
  {
    name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷',
    cities: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa'],
    languages: ['Greek'], currency: 'EUR',
  },
  {
    name: 'Hungary', code: 'HU', dialCode: '+36', flag: '🇭🇺',
    cities: ['Budapest', 'Debrecen', 'Miskolc', 'Pécs', 'Győr'],
    languages: ['Hungarian'], currency: 'HUF',
  },
  {
    name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪',
    cities: ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford'],
    languages: ['English', 'Irish'], currency: 'EUR',
  },
  {
    name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹',
    cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venice', 'Bologna', 'Genoa'],
    languages: ['Italian'], currency: 'EUR',
  },
  {
    name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg'],
    languages: ['Dutch'], currency: 'EUR',
  },
  {
    name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴',
    cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen'],
    languages: ['Norwegian'], currency: 'NOK',
  },
  {
    name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱',
    cities: ['Warsaw', 'Krakow', 'Wroclaw', 'Poznan', 'Gdansk', 'Lodz'],
    languages: ['Polish'], currency: 'PLN',
  },
  {
    name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹',
    cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Setúbal', 'Funchal'],
    languages: ['Portuguese'], currency: 'EUR',
  },
  {
    name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴',
    cities: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța'],
    languages: ['Romanian'], currency: 'RON',
  },
  {
    name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺',
    cities: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Chelyabinsk'],
    languages: ['Russian'], currency: 'RUB',
  },
  {
    name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Málaga', 'Zaragoza'],
    languages: ['Spanish'], currency: 'EUR',
  },
  {
    name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪',
    cities: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås'],
    languages: ['Swedish'], currency: 'SEK',
  },
  {
    name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭',
    cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lucerne'],
    languages: ['German', 'French', 'Italian', 'Romansh'], currency: 'CHF',
  },
  {
    name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦',
    cities: ['Kyiv', 'Kharkiv', 'Odessa', 'Lviv', 'Dnipro'],
    languages: ['Ukrainian'], currency: 'UAH',
  },
  {
    name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧',
    cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh', 'Liverpool', 'Bristol'],
    languages: ['English'], currency: 'GBP',
  },
  // ── Americas ─────────────────────────────────────────────────────────────
  {
    name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷',
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata'],
    languages: ['Spanish'], currency: 'ARS',
  },
  {
    name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus'],
    languages: ['Portuguese'], currency: 'BRL',
  },
  {
    name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦',
    cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Quebec City'],
    languages: ['English', 'French'], currency: 'CAD',
  },
  {
    name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱',
    cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta'],
    languages: ['Spanish'], currency: 'CLP',
  },
  {
    name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴',
    cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'],
    languages: ['Spanish'], currency: 'COP',
  },
  {
    name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽',
    cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancún', 'León'],
    languages: ['Spanish'], currency: 'MXN',
  },
  {
    name: 'Peru', code: 'PE', dialCode: '+51', flag: '🇵🇪',
    cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Cusco'],
    languages: ['Spanish'], currency: 'PEN',
  },
  {
    name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Miami'],
    languages: ['English'], currency: 'USD',
  },
  // ── Africa ───────────────────────────────────────────────────────────────
  {
    name: 'Algeria', code: 'DZ', dialCode: '+213', flag: '🇩🇿',
    cities: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida'],
    languages: ['Arabic', 'Berber', 'French'], currency: 'DZD',
  },
  {
    name: 'Ethiopia', code: 'ET', dialCode: '+251', flag: '🇪🇹',
    cities: ['Addis Ababa', 'Dire Dawa', 'Mekele', 'Gondar', 'Hawassa'],
    languages: ['Amharic'], currency: 'ETB',
  },
  {
    name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭',
    cities: ['Accra', 'Kumasi', 'Tamale', 'Sekondi-Takoradi', 'Cape Coast'],
    languages: ['English'], currency: 'GHS',
  },
  {
    name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
    languages: ['Swahili', 'English'], currency: 'KES',
  },
  {
    name: 'Libya', code: 'LY', dialCode: '+218', flag: '🇱🇾',
    cities: ['Tripoli', 'Benghazi', 'Misrata', 'Bayda', 'Zawiya'],
    languages: ['Arabic'], currency: 'LYD',
  },
  {
    name: 'Morocco', code: 'MA', dialCode: '+212', flag: '🇲🇦',
    cities: ['Casablanca', 'Rabat', 'Marrakech', 'Fez', 'Agadir', 'Tangier'],
    languages: ['Arabic', 'Berber', 'French'], currency: 'MAD',
  },
  {
    name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna'],
    languages: ['English'], currency: 'NGN',
  },
  {
    name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein'],
    languages: ['Afrikaans', 'English', 'Zulu', 'Xhosa'], currency: 'ZAR',
  },
  {
    name: 'Sudan', code: 'SD', dialCode: '+249', flag: '🇸🇩',
    cities: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'Atbara'],
    languages: ['Arabic', 'English'], currency: 'SDG',
  },
  {
    name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿',
    cities: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Zanzibar City'],
    languages: ['Swahili', 'English'], currency: 'TZS',
  },
  {
    name: 'Tunisia', code: 'TN', dialCode: '+216', flag: '🇹🇳',
    cities: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte'],
    languages: ['Arabic', 'French'], currency: 'TND',
  },
  // ── Oceania ──────────────────────────────────────────────────────────────
  {
    name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Darwin', 'Hobart'],
    languages: ['English'], currency: 'AUD',
  },
  {
    name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin', 'Tauranga'],
    languages: ['English', 'Māori'], currency: 'NZD',
  },
];

// Fast lookup map by country code
export const COUNTRY_MAP = new Map<string, CountryData>(
  COUNTRIES.map((c) => [c.code, c])
);

// UAE pinned first, then all countries sorted alphabetically — for dropdown display
export const COUNTRY_OPTIONS = [
  COUNTRIES.find((c) => c.code === 'AE')!,
  ...COUNTRIES.filter((c) => c.code !== 'AE').sort((a, b) => a.name.localeCompare(b.name)),
];

export function getCountryByCode(code: string): CountryData | undefined {
  return COUNTRY_MAP.get(code.toUpperCase());
}

export function getCitiesForCountry(code: string): string[] {
  return getCountryByCode(code)?.cities ?? [];
}

export function getDialCode(code: string): string {
  return getCountryByCode(code)?.dialCode ?? '';
}

export function getLanguages(code: string): string[] {
  return getCountryByCode(code)?.languages ?? [];
}

export function getFlag(code: string): string {
  return getCountryByCode(code)?.flag ?? '';
}
