"""Business logic for the Buyer Portal."""
import logging
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.common.constants import ROLE_BUYER
from .models import BuyerInvite, BuyerProfile

logger = logging.getLogger(__name__)
User = get_user_model()


class BuyerService:

    @staticmethod
    def send_invite(customer, email: str, invited_by) -> BuyerInvite:
        """Create invite record and send email to buyer."""
        invite = BuyerInvite.objects.create(
            email=email,
            customer=customer,
            invited_by=invited_by,
        )
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        invite_link = f'{frontend_url}/buyer/accept-invite?token={invite.token}'

        company_name = customer.company.name
        subject = f'You have been invited to view invoices from {company_name}'
        plain_text = (
            f'Hello,\n\n'
            f'{company_name} has invited you to access your invoices on the E-Invoicing Portal.\n\n'
            f'Click the link below to create your account and view your invoices:\n\n'
            f'{invite_link}\n\n'
            f'This link expires in 7 days.\n\n'
            f'If you did not expect this invitation, you can safely ignore this email.'
        )
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice Portal Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#bfdbfe;letter-spacing:2px;text-transform:uppercase;">E-Invoicing Portal</p>
            <h1 style="margin:10px 0 0;font-size:26px;font-weight:700;color:#ffffff;">You're Invited</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Hello,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              <strong style="color:#1e293b;">{company_name}</strong> has invited you to access your invoices
              on the UAE E-Invoicing Portal. Create your secure account to view, download, and manage your invoices online.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:32px auto;">
              <tr>
                <td align="center" style="border-radius:8px;background:#2563eb;">
                  <a href="{invite_link}"
                     style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:600;
                            color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                    &#x2192;&nbsp; Activate My Account
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:24px 0 0;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#64748b;
                             text-transform:uppercase;letter-spacing:1px;">What you get access to</p>
                  <p style="margin:4px 0;font-size:14px;color:#475569;">&#10003;&nbsp; View all invoices issued to you</p>
                  <p style="margin:4px 0;font-size:14px;color:#475569;">&#10003;&nbsp; Download PDF &amp; XML copies</p>
                  <p style="margin:4px 0;font-size:14px;color:#475569;">&#10003;&nbsp; Track payment status in real time</p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
              This invitation link expires in <strong>7 days</strong>. If the button above does not work,
              copy and paste the link below into your browser:
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
              <a href="{invite_link}" style="color:#3b82f6;text-decoration:none;">{invite_link}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              If you did not expect this invitation, you can safely ignore this email.<br/>
              &copy; {company_name} &bull; UAE E-Invoicing Portal
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@einvoicing.ae'),
            to=[email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        logger.info('Buyer invite sent to %s for customer %s', email, customer.name)
        return invite

    @staticmethod
    def accept_invite(token: str, full_name: str, password: str):
        """Validate token, create User + BuyerProfile, return (user, tokens)."""
        try:
            invite = BuyerInvite.objects.select_related('customer', 'customer__company').get(
                token=token
            )
        except BuyerInvite.DoesNotExist:
            raise ValueError('Invalid or expired invitation link.')

        if not invite.is_valid:
            raise ValueError('This invitation has already been used or has expired.')

        if User.objects.filter(email=invite.email).exists():
            raise ValueError('An account with this email already exists. Please log in instead.')

        name_parts = full_name.strip().split(' ', 1)
        user = User.objects.create_user(
            email=invite.email,
            password=password,
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else '',
            role=ROLE_BUYER,
            email_verified=True,
        )

        BuyerProfile.objects.create(
            user=user,
            customer=invite.customer,
            invited_by=invite.invited_by,
        )

        invite.is_used = True
        invite.save(update_fields=['is_used'])

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['full_name'] = user.full_name
        refresh['email'] = user.email

        return user, str(refresh.access_token), str(refresh)
