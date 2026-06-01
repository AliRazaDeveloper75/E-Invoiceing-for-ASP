"""
Onboarding app models.

CompanyInvitation    — secure token sent by admin to invite a new supplier/user
InvitationEmailLog   — delivery/status log per send attempt
OnboardingDocument   — documents uploaded during company registration
"""
import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel


INVITATION_STATUS_CHOICES = [
    ('pending',  'Pending'),
    ('accepted', 'Accepted'),
    ('expired',  'Expired'),
    ('revoked',  'Revoked'),
]

DOCUMENT_TYPE_CHOICES = [
    ('trade_license',   'Trade License'),
    ('trn_certificate', 'TRN Certificate'),
    ('vat_certificate', 'VAT Certificate'),
    ('memorandum',      'Memorandum of Association'),
    ('other',           'Other'),
]

DELIVERY_STATUS_CHOICES = [
    ('sent',   'Sent'),
    ('failed', 'Failed'),
]


class CompanyInvitation(models.Model):
    """
    Admin-sent invitation for a new supplier to register and onboard.

    Flow:
      1. Admin: POST /api/v1/onboarding/invitations/  → record created, email sent
      2. Invitee: clicks link → GET /accept-invite?token=<uuid>
      3. Invitee: submits form → POST /api/v1/onboarding/invite/accept/
         → User + Company + CompanyMember created
    """

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token      = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    email      = models.EmailField(db_index=True)
    first_name = models.CharField(max_length=150, blank=True, default='')
    last_name  = models.CharField(max_length=150, blank=True, default='')
    company_name_hint = models.CharField(max_length=255, blank=True, default='')
    role       = models.CharField(
        max_length=20,
        default='supplier',
        help_text='Role the new user will have within their company.',
    )
    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_company_invitations',
    )
    status     = models.CharField(
        max_length=20,
        choices=INVITATION_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )
    expires_at = models.DateTimeField()
    message    = models.TextField(blank=True, default='', help_text='Personal note shown on the invite page.')

    # ── Delivery & engagement tracking ────────────────────────────────────────
    send_count           = models.PositiveIntegerField(default=0)
    last_sent_at         = models.DateTimeField(null=True, blank=True)
    last_delivery_status = models.CharField(
        max_length=10, choices=DELIVERY_STATUS_CHOICES, blank=True, default='',
    )
    last_error           = models.TextField(blank=True, default='')
    email_opened_at      = models.DateTimeField(null=True, blank=True)
    link_accessed_at     = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'company_invitations'
        verbose_name = 'Company Invitation'
        verbose_name_plural = 'Company Invitations'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return self.status == 'pending' and timezone.now() < self.expires_at

    def __str__(self):
        return f'Invite → {self.email} [{self.status}]'


class InvitationEmailLog(models.Model):
    """One record per email send attempt for a CompanyInvitation."""

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.ForeignKey(
        CompanyInvitation,
        on_delete=models.CASCADE,
        related_name='email_logs',
    )
    sent_at       = models.DateTimeField(auto_now_add=True)
    status        = models.CharField(max_length=10, choices=DELIVERY_STATUS_CHOICES)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'invitation_email_logs'
        ordering = ['-sent_at']

    def __str__(self):
        return f'Log[{self.status}] → {self.invitation.email}'


class OnboardingDocument(BaseModel):
    """Document uploaded by a company during onboarding (trade license, TRN cert, etc.)."""

    company       = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='onboarding_documents',
    )
    uploaded_by   = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_onboarding_docs',
    )
    document_type = models.CharField(
        max_length=30,
        choices=DOCUMENT_TYPE_CHOICES,
        default='other',
    )
    file          = models.FileField(upload_to='onboarding_documents/%Y/%m/')
    file_name     = models.CharField(max_length=255, blank=True, default='')
    notes         = models.TextField(blank=True, default='')
    verified      = models.BooleanField(default=False)
    verified_by   = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_onboarding_docs',
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'onboarding_documents'
        verbose_name = 'Onboarding Document'
        verbose_name_plural = 'Onboarding Documents'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            import os
            self.file_name = os.path.basename(self.file.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_document_type_display()} — {self.company.name}'
