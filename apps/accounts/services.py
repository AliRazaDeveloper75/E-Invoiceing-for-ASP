"""
Authentication service layer.

ALL business logic lives here — views stay thin.
Services are plain Python classes with no Django HTTP coupling.
"""
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from rest_framework.exceptions import ValidationError, PermissionDenied

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    """Handles user registration, profile updates, and password management."""

    @staticmethod
    def register_user(
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        role: str = 'viewer',
    ) -> User:
        """
        Register a new platform user.

        - Normalizes email
        - Validates password strength via Django validators
        - Prevents duplicate registrations
        - Logs the creation event

        Returns the created User instance.
        Raises ValidationError on invalid input.
        """
        email = email.strip().lower()

        # Guard: email must be unique
        if User.objects.filter(email=email).exists():
            raise ValidationError({'email': 'A user with this email already exists.'})

        # Validate password strength against Django AUTH_PASSWORD_VALIDATORS
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise ValidationError({'password': list(exc.messages)})

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            role=role,
        )

        logger.info('New user registered: %s (role=%s)', email, role)
        return user

    @staticmethod
    def update_profile(user: User, first_name: str = None, last_name: str = None) -> User:
        """
        Update user's own profile fields.
        Only first_name and last_name are self-editable.
        Role changes go through admin.
        """
        if first_name is not None:
            user.first_name = first_name.strip()
        if last_name is not None:
            user.last_name = last_name.strip()

        user.save(update_fields=['first_name', 'last_name'])
        logger.info('Profile updated for user: %s', user.email)
        return user

    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> None:
        """
        Change a user's password after verifying the current one.

        Raises PermissionDenied if old_password is wrong.
        Raises ValidationError if new_password fails strength check.
        """
        if not user.check_password(old_password):
            raise PermissionDenied('Current password is incorrect.')

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise ValidationError({'new_password': list(exc.messages)})

        user.set_password(new_password)
        user.save(update_fields=['password'])
        logger.info('Password changed for user: %s', user.email)

    @staticmethod
    def send_verification_email(user: User) -> None:
        from apps.accounts.models import EmailVerificationToken
        record = EmailVerificationToken.create_for_user(user)
        code = record.code

        subject = 'Your UAE E-Invoicing verification code'

        # Plain-text fallback
        plain = (
            f"Hello {user.full_name},\n\n"
            f"Your verification code is: {code}\n\n"
            f"Enter it on the verification page. Valid for 15 minutes.\n\n"
            f"If you did not create this account, ignore this email.\n\n"
            f"UAE E-Invoicing Platform"
        )

        # Spaced digits for readability: "1 2 3 4 5 6"
        spaced = '&nbsp;&nbsp;'.join(list(code))

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);
                       padding:36px 40px 32px;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);
                          border-radius:12px;padding:10px 16px;margin-bottom:16px;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;
                             letter-spacing:0.5px;">UAE E-Invoicing</span>
              </div>
              <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">
                PEPPOL 5-Corner Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;">
                Verify your email address
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi <strong style="color:#111827;">{user.full_name}</strong>, use the code below
                to confirm your email and activate your account.
              </p>

              <!-- Code box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="margin-bottom:28px;">
                <tr>
                  <td align="center"
                      style="background:#eff6ff;border:2px dashed #93c5fd;
                             border-radius:14px;padding:28px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;
                               color:#3b82f6;letter-spacing:1.5px;text-transform:uppercase;">
                      Verification Code
                    </p>
                    <p style="margin:0;font-size:52px;font-weight:800;
                               letter-spacing:14px;color:#1e40af;
                               font-family:'Courier New',Courier,monospace;
                               line-height:1.1;">
                      {spaced}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Timer notice -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fefce8;border-left:4px solid #fbbf24;
                             border-radius:0 8px 8px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏱ This code expires in <strong>15 minutes</strong>.
                      Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not create an account on the UAE E-Invoicing Platform,
                you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                       padding:20px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                UAE E-Invoicing Platform &nbsp;·&nbsp; Powered by PEPPOL BIS 3.0
                &nbsp;·&nbsp; FTA Certified
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        try:
            send_mail(
                subject=subject,
                message=plain,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@uae-einvoicing.ae'),
                recipient_list=[user.email],
                html_message=html,
                fail_silently=False,
            )
            logger.info('Verification email sent to %s', user.email)
        except Exception as exc:
            logger.warning('Failed to send verification email to %s: %s', user.email, exc)

    @staticmethod
    def verify_email(code: str) -> User:
        from apps.accounts.models import EmailVerificationToken
        code = code.strip()
        try:
            record = EmailVerificationToken.objects.select_related('user').get(
                code=code, used=False
            )
        except EmailVerificationToken.DoesNotExist:
            raise ValidationError('Invalid verification code.')

        if record.is_expired:
            raise ValidationError('Verification code has expired. Please request a new one.')

        record.used = True
        record.save(update_fields=['used'])
        record.user.email_verified = True
        record.user.save(update_fields=['email_verified'])
        logger.info('Email verified for user: %s', record.user.email)
        return record.user

    @staticmethod
    def resend_verification(email: str) -> None:
        try:
            user = User.objects.get(email=email.strip().lower())
        except User.DoesNotExist:
            return  # Don't reveal whether email exists
        if user.email_verified:
            return
        AuthService.send_verification_email(user)

    @staticmethod
    def send_password_reset_email(email: str) -> None:
        """
        Send a password-reset link to the given email.
        Silently returns if the email does not exist (no user enumeration).
        """
        from apps.accounts.models import PasswordResetToken
        try:
            user = User.objects.get(email=email.strip().lower(), is_active=True)
        except User.DoesNotExist:
            return

        record = PasswordResetToken.create_for_user(user)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_url = f"{frontend_url}/reset-password?token={record.token}"

        subject = 'Reset your UAE E-Invoicing password'
        plain = (
            f"Hello {user.full_name},\n\n"
            f"We received a request to reset your password.\n\n"
            f"Click the link below to set a new password (valid for 30 minutes):\n"
            f"{reset_url}\n\n"
            f"If you did not request this, you can safely ignore this email.\n\n"
            f"UAE E-Invoicing Platform"
        )
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);
                       padding:36px 40px 32px;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);
                          border-radius:12px;padding:10px 16px;margin-bottom:16px;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;
                             letter-spacing:0.5px;">UAE E-Invoicing</span>
              </div>
              <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">
                PEPPOL 5-Corner Platform
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;">
                Reset your password
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi <strong style="color:#111827;">{user.full_name}</strong>,
                we received a request to reset the password for your account.
                Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="{reset_url}"
                       style="display:inline-block;padding:14px 36px;
                              background:linear-gradient(135deg,#2563eb,#1e40af);
                              color:#ffffff;font-size:15px;font-weight:700;
                              text-decoration:none;border-radius:10px;
                              box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fefce8;border-left:4px solid #fbbf24;
                             border-radius:0 8px 8px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏱ This link expires in <strong>30 minutes</strong>.
                      Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0;font-size:11px;color:#6b7280;word-break:break-all;">
                {reset_url}
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email.
                Your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                       padding:20px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                UAE E-Invoicing Platform &nbsp;·&nbsp; Powered by PEPPOL BIS 3.0
                &nbsp;·&nbsp; FTA Certified
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        try:
            send_mail(
                subject=subject,
                message=plain,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@uae-einvoicing.ae'),
                recipient_list=[user.email],
                html_message=html,
                fail_silently=False,
            )
            logger.info('Password reset email sent to %s', user.email)
        except Exception as exc:
            logger.warning('Failed to send password reset email to %s: %s', user.email, exc)

    @staticmethod
    def reset_password(token: str, new_password: str) -> None:
        """
        Validate the reset token and set a new password.
        Raises ValidationError if the token is invalid, expired, or already used.
        """
        from apps.accounts.models import PasswordResetToken
        try:
            record = PasswordResetToken.objects.select_related('user').get(
                token=token, used=False
            )
        except (PasswordResetToken.DoesNotExist, ValueError):
            raise ValidationError('Invalid or expired password reset link.')

        if record.is_expired:
            raise ValidationError('This reset link has expired. Please request a new one.')

        try:
            validate_password(new_password, user=record.user)
        except DjangoValidationError as exc:
            raise ValidationError({'new_password': list(exc.messages)})

        record.user.set_password(new_password)
        record.user.save(update_fields=['password'])
        record.used = True
        record.save(update_fields=['used'])
        logger.info('Password reset completed for user: %s', record.user.email)

    @staticmethod
    def deactivate_user(requesting_user: User, target_user: User) -> None:
        """
        Soft-deactivate a user (is_active=False).
        Only admins can deactivate other users.
        A user cannot deactivate themselves.
        """
        if not requesting_user.is_admin:
            raise PermissionDenied('Only admins can deactivate users.')

        if requesting_user.id == target_user.id:
            raise ValidationError({'detail': 'You cannot deactivate your own account.'})

        target_user.is_active = False
        target_user.save(update_fields=['is_active'])
        logger.warning('User deactivated: %s (by %s)', target_user.email, requesting_user.email)


class MFAService:
    """TOTP-based MFA (Google Authenticator) management."""

    ISSUER = 'UAE E-Invoicing'

    @staticmethod
    def generate_secret() -> str:
        import pyotp
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(user, secret: str) -> str:
        import pyotp
        return pyotp.TOTP(secret).provisioning_uri(
            name=user.email, issuer_name=MFAService.ISSUER
        )

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        """Verify a 6-digit TOTP code. Allows ±1 window (30s drift)."""
        import pyotp
        if not secret or not code:
            return False
        return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)

    @staticmethod
    def setup(user) -> dict:
        """
        Generate a new TOTP secret and store it temporarily on the user.
        MFA is NOT yet enabled — user must verify a code first via enable().
        """
        secret = MFAService.generate_secret()
        user.mfa_secret = secret
        user.save(update_fields=['mfa_secret'])
        return {
            'secret': secret,
            'qr_uri': MFAService.get_provisioning_uri(user, secret),
        }

    @staticmethod
    def enable(user, code: str) -> None:
        """Verify code against stored secret and activate MFA."""
        if not user.mfa_secret:
            raise ValidationError('MFA setup not started. Call /mfa/setup/ first.')
        if not MFAService.verify_code(user.mfa_secret, code):
            raise ValidationError('Invalid authenticator code. Please try again.')
        user.mfa_enabled = True
        user.save(update_fields=['mfa_enabled'])
        logger.info('MFA enabled for user: %s', user.email)

    @staticmethod
    def disable(user, code: str) -> None:
        """Verify current TOTP code then disable MFA and wipe the secret."""
        if not user.mfa_enabled:
            raise ValidationError('MFA is not currently enabled.')
        if not MFAService.verify_code(user.mfa_secret, code):
            raise ValidationError('Invalid authenticator code. Please try again.')
        user.mfa_enabled = False
        user.mfa_secret = ''
        user.save(update_fields=['mfa_enabled', 'mfa_secret'])
        logger.info('MFA disabled for user: %s', user.email)

    @staticmethod
    def verify_login(mfa_token_str: str, code: str):
        """
        Verify TOTP code during the MFA login step.
        Returns the User on success, raises ValidationError on failure.
        """
        from apps.accounts.models import MFALoginToken
        try:
            record = MFALoginToken.objects.select_related('user').get(
                token=mfa_token_str, used=False
            )
        except (MFALoginToken.DoesNotExist, ValueError):
            raise ValidationError('Invalid or expired MFA session. Please log in again.')

        if record.is_expired:
            raise ValidationError('MFA session expired (5 min). Please log in again.')

        if record.is_locked:
            raise ValidationError('Too many failed attempts. Please log in again.')

        if not MFAService.verify_code(record.user.mfa_secret, code):
            record.attempts += 1
            record.save(update_fields=['attempts'])
            remaining = max(0, 5 - record.attempts)
            raise ValidationError(
                f'Invalid code. {remaining} attempt{"s" if remaining != 1 else ""} remaining.'
            )

        record.used = True
        record.save(update_fields=['used'])
        logger.info('MFA login verified for user: %s', record.user.email)
        return record.user
