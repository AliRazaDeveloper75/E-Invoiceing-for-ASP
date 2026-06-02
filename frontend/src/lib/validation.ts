// ─── Email ────────────────────────────────────────────────────────────────────

// Strict RFC 5322-compatible email regex (rejects "a@b", requires TLD)
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'tempmail.com',
  '10minutemail.com', 'throwaway.email', 'yopmail.com', 'trashmail.com',
  'fakeinbox.com', 'sharklasers.com', 'spam4.me', 'tempr.email',
  'discard.email', 'mailnull.com', 'maildrop.cc', 'discardmail.com',
  'spamgourmet.com', 'mailmetrash.com', 'spamspot.com', 'throwam.com',
  'dispostable.com', 'getairmail.com', 'meltmail.com', 'spambox.us',
  'mytrashmail.com', 'trashmailer.com', 'wegwerfmail.de', 'spamfree24.org',
  'fakemailgenerator.com', 'mailnesia.com', 'mintemail.com', 'mt2015.com',
  'spamgourmet.net', 'tempemail.com', 'crazymailing.com',
  'getnada.com', 'spamthisplease.com', 'inboxkitten.com',
]);

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

export function validateEmail(email: string): string | true {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (!isValidEmailFormat(trimmed)) return 'Enter a valid email address (e.g. name@company.ae)';
  if (isDisposableEmail(trimmed)) return 'Disposable email addresses are not accepted';
  return true;
}

export const emailValidators = {
  required: 'Email is required',
  validate: {
    format: (v: string) => isValidEmailFormat(v) || 'Enter a valid email address (e.g. name@company.ae)',
    noDisposable: (v: string) => !isDisposableEmail(v) || 'Disposable email addresses are not accepted',
  },
};

// ─── Phone ────────────────────────────────────────────────────────────────────

// Strip formatting, validate length per ITU-T E.164 (7–15 total digits)
export function validatePhoneNumber(localNumber: string, dialCode = ''): string | true {
  if (!localNumber?.trim()) return 'Phone number is required';
  const digits = localNumber.replace(/[\s\-().+]/g, '');
  if (!/^\d+$/.test(digits)) return 'Phone number must contain only digits, spaces, hyphens, or parentheses';
  const total = (dialCode.replace('+', '').length) + digits.length;
  if (total < 7)  return 'Phone number is too short (minimum 7 digits)';
  if (total > 15) return 'Phone number is too long (maximum 15 digits)';
  return true;
}

// ─── Name fields ──────────────────────────────────────────────────────────────

// Allows letters (including Arabic/accented), spaces, hyphens, apostrophes, dots
const NAME_REGEX = /^[\p{L}\p{M}'\-. ]+$/u;

export function validatePersonName(name: string): string | true {
  const trimmed = name.trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
  if (!NAME_REGEX.test(trimmed)) return 'Name must contain only letters, spaces, hyphens, or apostrophes';
  return true;
}

export const firstNameValidators = {
  required: 'First name is required',
  minLength: { value: 2, message: 'First name must be at least 2 characters' },
  maxLength: { value: 50, message: 'First name must be 50 characters or fewer' },
  validate: (v: string) => NAME_REGEX.test(v.trim()) || 'First name must contain only letters, spaces, or hyphens',
};

export const lastNameValidators = {
  required: 'Last name is required',
  minLength: { value: 2, message: 'Last name must be at least 2 characters' },
  maxLength: { value: 50, message: 'Last name must be 50 characters or fewer' },
  validate: (v: string) => NAME_REGEX.test(v.trim()) || 'Last name must contain only letters, spaces, or hyphens',
};

// ─── TRN ─────────────────────────────────────────────────────────────────────

export const TRN_REGEX = /^\d{15}$/;

export function validateTRN(value: string, required = false): string | true {
  if (!value?.trim()) return required ? 'TRN is required' : true;
  if (!/^\d+$/.test(value)) return 'TRN must contain digits only — no letters or symbols';
  if (value.length !== 15) return `TRN must be exactly 15 digits (you entered ${value.length})`;
  return true;
}

export const trnValidators = (required = true) => ({
  ...(required ? { required: 'TRN is required' } : {}),
  validate: (v: string) => validateTRN(v, required),
});

// ─── Password ─────────────────────────────────────────────────────────────────

export function validatePassword(password: string): string | true {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return true;
}

export const passwordValidators = {
  required: 'Password is required',
  validate: (v: string) => validatePassword(v),
};

// Strength score 0–4
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

export const PASSWORD_STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
export const PASSWORD_STRENGTH_COLORS = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-500', 'bg-emerald-500'];

// ─── Website ──────────────────────────────────────────────────────────────────

export function validateWebsite(url: string): string | true {
  if (!url?.trim()) return true; // optional
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Website must start with http:// or https://';
    if (!parsed.hostname.includes('.')) return 'Enter a valid website URL (e.g. https://company.ae)';
    return true;
  } catch {
    return 'Enter a valid website URL (e.g. https://company.ae)';
  }
}

export const websiteValidators = {
  validate: (v: string) => validateWebsite(v),
};

// ─── Street address ───────────────────────────────────────────────────────────

export function validateStreetAddress(address: string): string | true {
  const trimmed = address?.trim();
  if (!trimmed) return 'Street address is required';
  if (trimmed.length < 5) return 'Please enter a more complete street address';
  if (trimmed.length > 200) return 'Street address must be 200 characters or fewer';
  return true;
}

// ─── Block non-numeric keydown (for TRN / numeric-only fields) ───────────────

export const NUMERIC_NAV_KEYS = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

export function numericOnlyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (!NUMERIC_NAV_KEYS.includes(e.key) && !/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
}

// ─── Block non-alpha keydown (for name fields) ────────────────────────────────

export function alphaOnlyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End', ' ', '-', "'", '.'];
  if (!allowed.includes(e.key) && !/^[\p{L}\p{M}]$/u.test(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
}
