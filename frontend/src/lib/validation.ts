// Strict RFC 5322-compatible email regex (rejects "a@b", requires TLD)
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// Common disposable / throwaway email domains to reject on the frontend
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
  'spamgourmet.net', 'tempemail.com', 'throwam.com', 'crazymailing.com',
  'getnada.com', 'mailnull.com', 'spamthisplease.com', 'inboxkitten.com',
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
  if (!isValidEmailFormat(trimmed)) return 'Enter a valid email address';
  if (isDisposableEmail(trimmed)) return 'Disposable email addresses are not accepted';
  return true;
}

// Phone validation: strip formatting, check length per ITU-T E.164
// (international: 7–15 digits excluding dial code prefix)
export function validatePhoneNumber(localNumber: string, dialCode = ''): string | true {
  const digits = localNumber.replace(/[\s\-().+]/g, '');
  if (!digits) return 'Phone number is required';
  if (!/^\d+$/.test(digits)) return 'Phone number must contain only digits';
  const total = (dialCode.replace('+', '').length) + digits.length;
  if (total < 7 || total > 15) return 'Enter a valid phone number';
  return true;
}

// react-hook-form compatible validator factories
export const emailValidators = {
  required: 'Email is required',
  validate: {
    format: (v: string) => isValidEmailFormat(v) || 'Enter a valid email address',
    noDisposable: (v: string) => !isDisposableEmail(v) || 'Disposable email addresses are not accepted',
  },
};
