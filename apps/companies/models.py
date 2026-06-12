"""
Companies app models.

Two models:
  Company       — registered business entity (TRN, address, VAT info)
  CompanyMember — links User ↔ Company with a per-company role

UAE regulatory notes (from MoF e-invoicing framework):
  - TRN = 15 digits (Tax Registration Number)
  - TIN = first 10 digits of TRN (used as B2B business identifier)
  - Each VAT group member needs its own ASP endpoint but shares the group TRN
"""
import re
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings

from apps.common.models import BaseModel
from apps.common.constants import USER_ROLE_CHOICES, ROLE_ADMIN, TRN_LENGTH, TIN_LENGTH, LEGAL_REG_TYPE_CHOICES


# ─── UAE Emirate Choices ──────────────────────────────────────────────────────

EMIRATE_CHOICES = [
    ('abu_dhabi',      'Abu Dhabi'),
    ('dubai',          'Dubai'),
    ('sharjah',        'Sharjah'),
    ('ajman',          'Ajman'),
    ('umm_al_quwain',  'Umm Al Quwain'),
    ('ras_al_khaimah', 'Ras Al Khaimah'),
    ('fujairah',       'Fujairah'),
]

BUSINESS_TYPE_CHOICES = [
    ('llc',         'Limited Liability Company (LLC)'),
    ('sole',        'Sole Proprietorship'),
    ('partnership', 'Partnership'),
    ('branch',      'Branch of Foreign Company'),
    ('freezone',    'Free Zone Company'),
    ('civil',       'Civil Company'),
    ('public',      'Public Joint Stock Company'),
    ('private',     'Private Joint Stock Company'),
]

INDUSTRY_TYPE_CHOICES = [
    ('technology',     'Technology'),
    ('manufacturing',  'Manufacturing'),
    ('trading',        'Trading'),
    ('retail',         'Retail'),
    ('construction',   'Construction'),
    ('hospitality',    'Hospitality'),
    ('healthcare',     'Healthcare'),
    ('finance',        'Finance'),
    ('real_estate',    'Real Estate'),
    ('logistics',      'Logistics'),
    ('education',      'Education'),
    ('consulting',     'Consulting'),
    ('other',          'Other'),
]

ONBOARDING_STATUS_CHOICES = [
    ('not_started',  'Not Started'),
    ('submitted',    'Submitted'),
    ('under_review', 'Under Review'),
    ('approved',     'Approved'),
    ('rejected',     'Rejected'),
]

# ─── Validators ──────────────────────────────────────────────────────────────

def validate_trn(value: str) -> None:
    """
    UAE TRN must be exactly 15 numeric digits.
    Per MoF e-invoicing framework: TIN = first 10 digits.
    """
    if not re.fullmatch(r'\d{15}', value):
        raise ValidationError(
            f'TRN must be exactly {TRN_LENGTH} numeric digits. Got: "{value}"'
        )


# ─── Company Model ────────────────────────────────────────────────────────────

class Company(BaseModel):
    """
    A registered business entity on the platform.

    Represents Corner 1 (Supplier) in the PEPPOL 5-corner model.
    Each company has its own TRN and is isolated from other companies (SaaS tenancy).

    Fields:
      trn         — 15-digit UAE Tax Registration Number (unique per company)
      tin         — first 10 digits of TRN, auto-derived (B2B business identifier)
      vat_group   — if True, company is part of a VAT group (shares group TRN)
      emirate     — UAE emirate of the registered address
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    name = models.CharField(
        max_length=255,
        help_text='Trading name of the business.'
    )
    legal_name = models.CharField(
        max_length=255,
        help_text='Legal / registered name as per trade license.'
    )
    trn = models.CharField(
        max_length=15,
        unique=True,
        validators=[validate_trn],
        help_text='UAE Tax Registration Number — 15 numeric digits.'
    )
    tin = models.CharField(
        max_length=10,
        editable=False,
        db_index=True,
        help_text='Auto-derived: first 10 digits of TRN. Used as B2B business identifier.'
    )
    trn_issue_date = models.DateField(
        null=True, blank=True,
        help_text='Date the Tax Registration (TRN) was issued.'
    )
    trn_expiry_date = models.DateField(
        null=True, blank=True,
        help_text='TRN expiry / validity end date (if applicable).'
    )
    is_vat_group = models.BooleanField(
        default=False,
        help_text='True if this entity is a member of a VAT group (shares group TRN).'
    )

    # ── Address (UAE) ─────────────────────────────────────────────────────────
    street_address = models.CharField(max_length=500)
    city = models.CharField(max_length=100)
    emirate = models.CharField(
        max_length=20,
        choices=EMIRATE_CHOICES,
        default='dubai'
    )
    po_box = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(
        max_length=2,
        default='AE',
        help_text='ISO 3166-1 alpha-2 country code.'
    )

    # ── Contact ───────────────────────────────────────────────────────────────
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    website = models.URLField(blank=True, default='')

    # ── Legal Registration (UAE FTA mandatory — Seller fields #13/#14) ─────────
    legal_registration_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Legal entity registration number (e.g. trade license number, CR number). '
                  'Used in UBL PartyLegalEntity/CompanyID.',
    )
    legal_registration_type = models.CharField(
        max_length=5,
        choices=LEGAL_REG_TYPE_CHOICES,
        blank=True,
        default='',
        help_text='Type of legal registration document (TL=Trade License, CRN=CR Number, etc.). '
                  'Used as schemeID attribute on PartyLegalEntity/CompanyID.',
    )
    legal_registration_authority = models.CharField(
        max_length=150,
        blank=True,
        default='',
        help_text='Issuing authority of the legal registration (BTAE-12). UAE rule '
                  'ibr-172-ae requires this when the registration type is Trade License '
                  '(e.g. "Department of Economic Development").',
    )

    # ── Banking / Payment (shown on invoice + UBL PayeeFinancialAccount) ───────
    # UAE PINT rule ibr-192-ae: when the payment means is credit transfer (code
    # 30) the payment account identifier (IBAN/account no.) MUST be provided.
    bank_name = models.CharField(max_length=150, blank=True, default='')
    bank_account_number = models.CharField(max_length=50, blank=True, default='')
    iban = models.CharField(
        max_length=34, blank=True, default='',
        help_text='IBAN — used as UBL PayeeFinancialAccount/ID (IBT-084).',
    )
    swift_code = models.CharField(max_length=20, blank=True, default='')

    # ── PEPPOL / ASP ──────────────────────────────────────────────────────────
    peppol_endpoint = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='PEPPOL participant ID assigned by ASP (e.g. 0088:1234567890123).'
    )

    # ── Branding ──────────────────────────────────────────────────────────────
    logo = models.ImageField(
        upload_to='company_logos/',
        blank=True,
        null=True,
        help_text='Company logo (PNG/JPG).'
    )

    # ── Business Classification ────────────────────────────────────────────────
    business_type = models.CharField(
        max_length=20,
        choices=BUSINESS_TYPE_CHOICES,
        blank=True,
        default='',
    )
    industry_type = models.CharField(
        max_length=20,
        choices=INDUSTRY_TYPE_CHOICES,
        blank=True,
        default='',
    )

    # ── Contact Person ────────────────────────────────────────────────────────
    contact_person_name  = models.CharField(max_length=255, blank=True, default='')
    contact_person_email = models.EmailField(blank=True, default='')
    contact_person_phone = models.CharField(max_length=20, blank=True, default='')

    # ── Onboarding / Compliance Status ────────────────────────────────────────
    onboarding_status = models.CharField(
        max_length=20,
        choices=ONBOARDING_STATUS_CHOICES,
        default='not_started',
        db_index=True,
    )
    onboarding_notes = models.TextField(blank=True, default='')
    onboarding_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_companies',
    )
    onboarding_reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'companies'
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} (TRN: {self.trn})'

    def save(self, *args, **kwargs):
        # Auto-derive TIN from TRN on every save
        self.tin = self.trn[:TIN_LENGTH] if self.trn else ''
        super().save(*args, **kwargs)

    @property
    def formatted_address(self) -> str:
        """Human-readable UAE address string."""
        parts = [self.street_address, self.city]
        if self.po_box:
            parts.append(f'P.O. Box {self.po_box}')
        parts.append(self.get_emirate_display())
        parts.append('United Arab Emirates')
        return ', '.join(filter(None, parts))


# ─── CompanyMember Model ──────────────────────────────────────────────────────

class CompanyMember(BaseModel):
    """
    Links a User to a Company with a specific role.

    This is the multi-tenancy join table:
      - One user can belong to many companies
      - Each membership has its own role (overrides User.role for this company)
      - The company creator is always added as 'admin'

    Used by IsCompanyMember and IsCompanyAdmin permission classes.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='members'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='company_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=USER_ROLE_CHOICES,
        default=ROLE_ADMIN,
        help_text='Role within this specific company (overrides User.role).'
    )

    class Meta:
        db_table = 'company_members'
        verbose_name = 'Company Member'
        verbose_name_plural = 'Company Members'
        unique_together = [('company', 'user')]   # One membership per user per company
        ordering = ['company__name', 'user__email']

    def __str__(self):
        return f'{self.user.email} @ {self.company.name} [{self.role}]'

    @property
    def is_admin(self) -> bool:
        return self.role == 'admin'

    @property
    def is_accountant(self) -> bool:
        return self.role == 'accountant'
