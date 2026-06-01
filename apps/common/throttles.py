"""
Custom DRF throttle classes for UAE E-Invoicing platform.

Protects high-value auth endpoints against brute-force attacks.
Each throttle has a separate cache key so they don't interfere with
the global AnonRateThrottle / UserRateThrottle configured in settings.

Rates (per IP or per user):
  LoginRateThrottle         — 10 attempts / 15 min  (per IP)
  MFAVerifyRateThrottle     — 5  attempts / 5 min   (per IP)
  OTPVerifyRateThrottle     — 5  attempts / 5 min   (per email)
  PasswordResetRateThrottle — 3  attempts / 1 hour  (per IP)
  RegisterRateThrottle      — 5  registrations / 1 hour (per IP)
"""
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Brute-force protection for the login endpoint.
    10 attempts per IP per 15 minutes.
    """
    scope = 'login'
    THROTTLE_RATES = {'login': '10/15min'}

    def get_cache_key(self, request, view):
        # Key on IP, not user (user not yet authenticated at this point)
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }


class MFAVerifyRateThrottle(AnonRateThrottle):
    """
    Prevents TOTP code brute-forcing.
    5 attempts per IP per 5 minutes.
    """
    scope = 'mfa_verify'
    THROTTLE_RATES = {'mfa_verify': '5/5min'}

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }


class OTPVerifyRateThrottle(SimpleRateThrottle):
    """
    Prevents email OTP code brute-forcing.
    5 attempts per email per 5 minutes.
    Keyed on email address from request body for tighter per-user control.
    """
    scope = 'otp_verify'
    THROTTLE_RATES = {'otp_verify': '5/5min'}

    def get_cache_key(self, request, view):
        email = (request.data or {}).get('email', '')
        if email:
            # Key on email — prevents attacking a specific account
            ident = email.lower().strip()
        else:
            # Fallback to IP if email not in body
            ident = self.get_ident(request)

        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }


class PasswordResetRateThrottle(AnonRateThrottle):
    """
    Prevents password reset spam and account enumeration.
    3 requests per IP per hour.
    """
    scope = 'password_reset'
    THROTTLE_RATES = {'password_reset': '3/hour'}

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }


class RegisterRateThrottle(AnonRateThrottle):
    """
    Prevents account creation spam.
    5 registrations per IP per hour.
    """
    scope = 'register'
    THROTTLE_RATES = {'register': '5/hour'}

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }
