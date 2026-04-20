"""
Customer model for UAE E-Invoicing platform.

A Customer is the invoice recipient (Corner 4 in PEPPOL 5-corner model).
Each customer record is scoped to one Company (SaaS tenancy).

UAE regulatory notes:
  - B2B / B2G: customer must have a TIN (first 10 digits of TRN)
  - B2B transactions are in scope regardless of VAT registration status
    as long as the customer has a TIN (per MoF framework)
  - Export customers: if on PEPPOL network, their overseas PEPPOL address
    can be used; otherwise invoices are shared via email/PDF
"""
import re
from django.db import models
from django.core.exceptions import ValidationError

from apps.common.models import BaseModel
from apps.common.constants import (
    TRANSACTION_TYPE_CHOICES, TRANSACTION_B2B,
    TRN_LENGTH, TIN_LENGTH,
)


# ─── Validators ───────────────────────────────────────────────────────────────

def validate_trn(value: str) -> None:
    """UAE TRN must be exactly 15 numeric digits."""
    if not re.fullmatch(r'\d{15}', value):
        raise ValidationError(
            f'TRN must be exactly {TRN_LENGTH} numeric digits. Got: "{value}"'
        )


def validate_vat_number(value: str) -> None:
    """
    Generic VAT number validator for international customers.
    Allows alphanumeric + hyphens, 5–20 characters.
    """
    if not re.fullmatch(r'[A-Z0-9\-]{5,20}', value.upper()):
        raise ValidationError(
            f'VAT number must be 5–20 alphanumeric characters (hyphens allowed). Got: "{value}"'
        )


# ─── Customer Model ───────────────────────────────────────────────────────────

class Customer(BaseModel):
    """
    Invoice recipient (buyer) owned by a specific company.

    customer_type determines e-invoicing scope:
      b2b — Business-to-Business: Phase 1 mandatory (TIN required)
      b2g — Business-to-Government: Phase 1 mandatory
      b2c — Business-to-Consumer: Phase 2 (future), simplified invoice

    Tax identification:
      UAE customers  → use trn (15 digits) + auto-derived tin (10 digits)
      International  → use vat_number (alphanumeric)
    """

    # ── Ownership (SaaS tenancy) ──────────────────────────────────────────────
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='customers',
        help_text='The company that owns this customer record.'
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    name = models.CharField(
        max_length=255,
        help_text='Trading / display name of the customer.'
    )
    legal_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Legal registered name. Defaults to name if not provided.'
    )
    customer_type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPE_CHOICES,
        default=TRANSACTION_B2B,
        db_index=True,
        help_text='B2B and B2G are in scope for Phase 1 UAE e-invoicing (Q2 2026).'
    )

    # ── UAE Tax Fields ────────────────────────────────────────────────────────
    trn = models.CharField(
        max_length=15,
        blank=True,
        default='',
        validators=[validate_trn],
        help_text='UAE TRN — 15 digits. Required for UAE B2B customers.'
    )
    tin = models.CharField(
        max_length=10,
        blank=True,
        default='',
        editable=False,
        db_index=True,
        help_text='Auto-derived: first 10 digits of TRN. Used as B2B identifier.'
    )
    vat_number = models.CharField(
        max_length=20,
        blank=True,
        default='',
        validators=[validate_vat_number],
        help_text='VAT registration number for international (non-UAE) customers.'
    )

    # ── PEPPOL ────────────────────────────────────────────────────────────────
    peppol_endpoint = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text=(
            'PEPPOL participant ID if buyer is on the PEPPOL network. '
            'For overseas customers already registered in their home country.'
        )
    )

    # ── Address ───────────────────────────────────────────────────────────────
    street_address = models.CharField(max_length=500, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state_province = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='State or province — used for non-UAE customers.'
    )
    postal_code = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(
        max_length=2,
        default='AE',
        help_text='ISO 3166-1 alpha-2 country code.'
    )

    # ── Contact ───────────────────────────────────────────────────────────────
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')

    # ── Internal notes ────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'customers'
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['name']
        indexes = [
            # Fast lookup by company + TIN for B2B invoice creation
            models.Index(fields=['company', 'tin'], name='idx_customer_company_tin'),
            models.Index(fields=['company', 'customer_type'], name='idx_customer_company_type'),
        ]

    def __str__(self):
        identifier = self.trn or self.vat_number or 'No Tax ID'
        return f'{self.name} ({identifier})'

    def save(self, *args, **kwargs):
        # Auto-derive TIN whenever TRN is set
        self.tin = self.trn[:TIN_LENGTH] if self.trn else ''
        # Default legal_name to name if not provided
        if not self.legal_name:
            self.legal_name = self.name
        super().save(*args, **kwargs)

    def clean(self):
        """
        Cross-field validation.
        UAE B2B customers require a TRN.
        International customers use vat_number.
        """
        super().clean()
        is_uae = self.country == 'AE'
        is_b2b_or_b2g = self.customer_type in ('b2b', 'b2g')

        if is_uae and is_b2b_or_b2g and not self.trn:
            raise ValidationError({
                'trn': (
                    'UAE B2B and B2G customers must have a TRN. '
                    'Per MoF framework, TIN (first 10 digits) is used as the B2B business identifier.'
                )
            })

    @property
    def is_uae_customer(self) -> bool:
        return self.country == 'AE'

    @property
    def is_peppol_connected(self) -> bool:
        """True if the customer has a PEPPOL endpoint (can receive via network)."""
        return bool(self.peppol_endpoint)

    @property
    def formatted_address(self) -> str:
        parts = [self.street_address, self.city]
        if self.state_province:
            parts.append(self.state_province)
        if self.postal_code:
            parts.append(self.postal_code)
        parts.append(self.country)
        return ', '.join(filter(None, parts))
