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
        body_html = f"""
          <p style="margin:0;"><strong>{company_name}</strong> has invited you to access your invoices on the
          E-Numerak portal. Create your secure account to view, download and manage your invoices online.</p>
          <div style="margin:20px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">What you get access to</p>
            <p style="margin:4px 0;font-size:14px;color:#475569;">✓&nbsp; View all invoices issued to you</p>
            <p style="margin:4px 0;font-size:14px;color:#475569;">✓&nbsp; Download PDF &amp; XML copies</p>
            <p style="margin:4px 0;font-size:14px;color:#475569;">✓&nbsp; Track payment status in real time</p>
          </div>
          <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;">This invitation link expires in
          <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.</p>"""

        from services.emails import send_branded_email
        send_branded_email(
            subject=subject,
            to=email,
            heading="You're invited to the invoice portal",
            intro='Hello,',
            body_html=body_html,
            cta_label='Activate My Account',
            cta_url=invite_link,
            preheader=f'{company_name} invited you to view your invoices.',
        )
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
