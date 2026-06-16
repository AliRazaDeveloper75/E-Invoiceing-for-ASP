"""
Onboarding service layer.

InvitationService  — create, send, resend, validate, revoke invitations
OnboardingService  — accept invitation (create User + Company), review company
"""
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from apps.companies.models import Company, CompanyMember
from .models import CompanyInvitation, InvitationEmailLog, OnboardingDocument

logger = logging.getLogger(__name__)
User = get_user_model()


class InvitationService:

    @staticmethod
    def create(
        email: str,
        invited_by,
        first_name: str = '',
        last_name: str = '',
        company_name_hint: str = '',
        role: str = 'supplier',
        message: str = '',
    ) -> CompanyInvitation:
        """Create a CompanyInvitation and send the invitation email."""
        CompanyInvitation.objects.filter(email=email, status='pending').update(status='expired')

        invite = CompanyInvitation.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company_name_hint=company_name_hint,
            role=role,
            invited_by=invited_by,
            message=message,
        )
        InvitationService._send_email(invite)
        return invite

    @staticmethod
    def resend(invite: CompanyInvitation) -> CompanyInvitation:
        """Resend invitation email and reset expiry to now + 1 hour."""
        invite.expires_at = timezone.now() + timedelta(hours=1)
        if invite.status == 'expired':
            invite.status = 'pending'
        invite.save(update_fields=['expires_at', 'status', 'updated_at'])
        InvitationService._send_email(invite)
        invite.refresh_from_db()
        return invite

    @staticmethod
    def _send_email(invite: CompanyInvitation) -> None:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        backend_url  = getattr(settings, 'BACKEND_URL',  '')
        link         = f'{frontend_url}/accept-invite?token={invite.token}'
        inviter_name = invite.invited_by.full_name if invite.invited_by else 'The E-Numerak team'
        from_email   = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@e-numerak.ae')

        # Only embed tracking pixel when backend is a real public URL (not localhost)
        _is_prod_url = backend_url and 'localhost' not in backend_url and '127.0.0.1' not in backend_url
        track_pixel_tag = (
            f'<img src="{backend_url}/api/v1/onboarding/invite/open/?token={invite.token}"'
            f' width="1" height="1" alt="" style="display:none;" />'
        ) if _is_prod_url else ''

        subject = f'Invitation to join E-Numerak — complete your company registration'
        plain = (
            f'Hello {invite.first_name or "there"},\n\n'
            f'{inviter_name} has invited you to join E-Numerak, the UAE FTA-compliant e-invoicing platform.\n\n'
            f'Complete your registration here:\n{link}\n\n'
            f'This link expires in 1 hour. If you did not expect this email, you can safely ignore it.'
        )
        personal_note = (
            f'<p style="margin:16px 0 0;background:#f0f9ff;border-left:3px solid #0ea5e9;padding:12px 16px;'
            f'border-radius:0 6px 6px 0;font-size:14px;color:#0c4a6e;font-style:italic;">{invite.message}</p>'
        ) if invite.message else ''

        body_html = f"""
          <p style="margin:0;"><strong>{inviter_name}</strong> has invited you to register your company on
          E-Numerak and start issuing UAE FTA-compliant e-invoices.</p>
          {personal_note}
          <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;">
            This invitation link expires in <strong>1 hour</strong>. If you did not expect this email, please ignore it.
          </p>"""

        from services.emails import render_branded_email
        html = render_branded_email(
            heading='You have been invited',
            intro=f'Hello{" " + invite.first_name if invite.first_name else ""},',
            body_html=body_html,
            cta_label='Complete Registration',
            cta_url=link,
            preheader=f'{inviter_name} invited you to join E-Numerak.',
        )
        if track_pixel_tag:
            html = html.replace('</body>', f'{track_pixel_tag}</body>')

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain,
                from_email=from_email,
                to=[invite.email],
                headers={
                    'Message-ID': f'<invite-{invite.id}@e-numerak.com>',
                    'X-Mailer': 'E-Numerak Platform',
                },
            )
            msg.attach_alternative(html, 'text/html')
            msg.send(fail_silently=False)

            invite.send_count += 1
            invite.last_sent_at = timezone.now()
            invite.last_delivery_status = 'sent'
            invite.last_error = ''
            invite.save(update_fields=['send_count', 'last_sent_at', 'last_delivery_status', 'last_error'])

            InvitationEmailLog.objects.create(invitation=invite, status='sent')
            logger.info('Invitation sent to %s (attempt #%d)', invite.email, invite.send_count)

        except Exception as exc:
            invite.last_sent_at = timezone.now()
            invite.last_delivery_status = 'failed'
            invite.last_error = str(exc)[:500]
            invite.save(update_fields=['last_sent_at', 'last_delivery_status', 'last_error'])

            InvitationEmailLog.objects.create(
                invitation=invite,
                status='failed',
                error_message=str(exc)[:500],
            )
            logger.warning('Invitation email failed for %s: %s', invite.email, exc)
            raise

    @staticmethod
    def track_open(token: str) -> None:
        """Record email open event when the tracking pixel is loaded."""
        CompanyInvitation.objects.filter(
            token=token,
            email_opened_at__isnull=True,
        ).update(email_opened_at=timezone.now())

    @staticmethod
    def validate_token(token: str) -> CompanyInvitation:
        """Return a valid invitation or raise ValueError."""
        try:
            invite = CompanyInvitation.objects.select_related('invited_by').get(token=token)
        except (CompanyInvitation.DoesNotExist, ValueError):
            raise ValueError('Invalid or expired invitation link.')
        if not invite.is_valid:
            raise ValueError(
                'This invitation has already been used or has expired. '
                'Please contact the person who invited you for a new link.'
            )
        # Record that the link was accessed
        if not invite.link_accessed_at:
            CompanyInvitation.objects.filter(pk=invite.pk).update(link_accessed_at=timezone.now())
            invite.link_accessed_at = timezone.now()
        return invite

    @staticmethod
    def revoke(invitation: CompanyInvitation, revoked_by) -> None:
        invitation.status = 'revoked'
        invitation.save(update_fields=['status', 'updated_at'])
        logger.info('Invitation %s revoked by %s', invitation.id, revoked_by.email)


class OnboardingService:

    @staticmethod
    @transaction.atomic
    def accept_invitation(
        token: str,
        account_data: dict,
        company_data: dict,
        documents: list = None,
    ):
        """
        Complete onboarding:
          1. Validate token
          2. Create User (email_verified=True — admin-invited)
          3. Create Company
          4. Add user as company admin (CompanyMember)
          5. Mark invitation as accepted
          6. Save uploaded documents
          7. Send welcome email

        Returns (user, company, access_token, refresh_token).
        """
        from rest_framework_simplejwt.tokens import RefreshToken

        invite = InvitationService.validate_token(token)

        email = invite.email
        if User.objects.filter(email=email).exists():
            raise ValueError('An account with this email already exists. Please log in instead.')

        user = User.objects.create_user(
            email=email,
            password=account_data['password'],
            first_name=account_data.get('first_name', invite.first_name).strip(),
            last_name=account_data.get('last_name', invite.last_name).strip(),
            role=invite.role,
            email_verified=True,
        )

        company = Company.objects.create(
            name=company_data['name'],
            legal_name=company_data.get('legal_name') or company_data['name'],
            trn=company_data['trn'],
            street_address=company_data.get('street_address', ''),
            city=company_data.get('city', ''),
            emirate=company_data.get('emirate', 'dubai'),
            po_box=company_data.get('po_box', ''),
            country=company_data.get('country', 'AE'),
            phone=company_data.get('phone', ''),
            email=company_data.get('company_email', ''),
            website=company_data.get('website', ''),
            legal_registration_id=company_data.get('trade_license_number', ''),
            legal_registration_type=company_data.get('legal_registration_type', 'TL'),
            business_type=company_data.get('business_type', ''),
            industry_type=company_data.get('industry_type', ''),
            contact_person_name=company_data.get('contact_person_name', ''),
            contact_person_email=company_data.get('contact_person_email', ''),
            contact_person_phone=company_data.get('contact_person_phone', ''),
            onboarding_status='submitted',
        )

        if company_data.get('logo'):
            company.logo = company_data['logo']
            company.save(update_fields=['logo'])

        CompanyMember.objects.create(company=company, user=user, role='admin')

        if documents:
            for doc_data in documents:
                OnboardingDocument.objects.create(
                    company=company,
                    uploaded_by=user,
                    document_type=doc_data.get('document_type', 'other'),
                    file=doc_data['file'],
                    notes=doc_data.get('notes', ''),
                )

        invite.status = 'accepted'
        invite.save(update_fields=['status', 'updated_at'])

        refresh = RefreshToken.for_user(user)
        refresh['email']           = user.email
        refresh['full_name']       = user.full_name
        refresh['role']            = user.role
        refresh['email_verified']  = user.email_verified
        refresh['mfa_verified_at'] = int(timezone.now().timestamp())

        try:
            OnboardingService._send_welcome_email(user, company)
        except Exception as exc:
            logger.warning('Welcome email failed for %s: %s', user.email, exc)

        logger.info('Onboarding complete — user=%s company=%s', user.email, company.name)
        return user, company, str(refresh.access_token), str(refresh)

    @staticmethod
    def _send_welcome_email(user, company) -> None:
        frontend_url  = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        dashboard_url = f'{frontend_url}/dashboard'
        body_html = f"""
          <p style="margin:0;">Your company <strong>{company.name}</strong> has been registered on E-Numerak.</p>
          <p style="margin:16px 0 0;">Your account is currently <strong>under review</strong>. You'll be notified
          by email as soon as it's approved — after which you can start issuing FTA-compliant e-invoices.</p>"""
        from services.emails import send_branded_email
        send_branded_email(
            subject=f'Welcome to E-Numerak — {company.name} is registered',
            to=user.email,
            heading='Welcome aboard 🎉',
            intro=f'Hello {user.full_name},',
            body_html=body_html,
            cta_label='Open Dashboard',
            cta_url=dashboard_url,
            preheader=f'{company.name} has been registered on E-Numerak.',
        )

    @staticmethod
    @transaction.atomic
    def review_company(company: Company, action: str, notes: str, reviewed_by) -> Company:
        status_map = {
            'approve':         'approved',
            'reject':          'rejected',
            'request_changes': 'under_review',
        }
        if action not in status_map:
            raise ValueError(f'Unknown action: {action}')

        company.onboarding_status      = status_map[action]
        company.onboarding_notes       = notes
        company.onboarding_reviewed_by = reviewed_by
        company.onboarding_reviewed_at = timezone.now()
        company.save(update_fields=[
            'onboarding_status', 'onboarding_notes',
            'onboarding_reviewed_by', 'onboarding_reviewed_at',
        ])

        try:
            OnboardingService._send_review_email(company, action, notes)
        except Exception as exc:
            logger.warning('Review notification failed for company %s: %s', company.id, exc)

        logger.info('Company %s %sd by %s', company.name, action, reviewed_by.email)
        return company

    @staticmethod
    def _send_review_email(company, action: str, notes: str) -> None:
        admin_email = company.contact_person_email or company.email
        if not admin_email:
            return
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        subject_map = {
            'approve':         f'{company.name} — Registration Approved',
            'reject':          f'{company.name} — Registration Requires Attention',
            'request_changes': f'{company.name} — Changes Requested',
        }
        heading_map = {
            'approve':         'Registration approved ✅',
            'reject':          'Registration needs attention',
            'request_changes': 'Changes requested',
        }
        body_map = {
            'approve':         'Your company registration has been <strong>approved</strong>. You can now sign in and start issuing FTA-compliant e-invoices.',
            'reject':          'Your company registration could not be approved at this time. Please review the notes below and contact us if you need any help.',
            'request_changes': 'We need a few changes to your company registration before it can be approved. Please review the notes below and resubmit.',
        }
        notes_block = (
            f'<p style="margin:18px 0 0;background:#f8fafc;border-left:3px solid #94a3b8;'
            f'border-radius:0 6px 6px 0;padding:12px 15px;font-size:14px;color:#334155;">'
            f'<strong>Reviewer notes:</strong><br>{notes}</p>'
        ) if notes else ''
        from services.emails import send_branded_email
        send_branded_email(
            subject=subject_map[action],
            to=admin_email,
            heading=heading_map[action],
            intro=f'Dear {company.name},',
            body_html=f'<p style="margin:0;">{body_map[action]}</p>{notes_block}',
            cta_label='Open Dashboard' if action == 'approve' else '',
            cta_url=f'{frontend_url}/dashboard' if action == 'approve' else '',
            preheader=subject_map[action],
        )
