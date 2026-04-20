"""
Invoice and InvoiceItem models for UAE E-Invoicing platform.

Two models:
  Invoice     — the main tax document (PEPPOL UBL Invoice)
  InvoiceItem — individual line items with VAT breakdown

UAE regulatory notes:
  - Tax Invoice is mandated under Federal Decree-Law No. 16 of 2024 (Articles 65, 70)
  - Electronic invoices and credit notes must be issued where applicable
  - VAT standard rate: 5% (UAE)
  - Article 76 introduces penalties for failing to issue within timelines

Status lifecycle:
  DRAFT → PENDING → SUBMITTED → VALIDATED / REJECTED
                 ↘ CANCELLED
"""
from decimal import Decimal, ROUND_HALF_UP
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone

from apps.common.models import BaseModel
from apps.common.constants import (
    INVOICE_STATUS_CHOICES, INVOICE_TYPE_CHOICES, TRANSACTION_TYPE_CHOICES,
    CURRENCY_CHOICES, VAT_RATE_CHOICES,
    INVOICE_STATUS_DRAFT, INVOICE_TYPE_TAX, TRANSACTION_B2B, CURRENCY_AED,
    UAE_VAT_RATE, FTA_STATUS_CHOICES,
)


# ─── VAT Rate Map ─────────────────────────────────────────────────────────────

VAT_RATE_MAP = {
    'standard':    Decimal('5.00'),   # 5% UAE standard rate
    'zero':        Decimal('0.00'),   # 0% zero-rated supplies
    'exempt':      None,              # Exempt — VAT not applicable
    'out_of_scope': None,             # Outside VAT scope
}


# ─── Invoice Model ────────────────────────────────────────────────────────────

class Invoice(BaseModel):
    """
    A UAE-compliant tax invoice document.

    Represents the invoice sent from Corner 1 (Supplier/Our System)
    through Corner 2 (ASP) to Corner 4 (Buyer) in the PEPPOL 5-corner model.

    Financial totals (subtotal, total_vat, total_amount) are stored for
    performance and are recalculated via InvoiceService.recalculate_totals()
    whenever items are added, updated, or removed.
    """

    # ── Ownership ──────────────────────────────────────────────────────────────
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,      # PROTECT: don't lose invoices if company deactivated
        related_name='invoices',
        help_text='Supplier / issuing company.'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='invoices',
        help_text='Buyer / invoice recipient.'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_invoices',
    )

    # ── Identity ───────────────────────────────────────────────────────────────
    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text='Auto-generated unique invoice number (e.g. INV-202601-000001).'
    )
    invoice_sequence = models.PositiveIntegerField(
        default=0,
        help_text='Sequential number per company. Used to generate invoice_number.'
    )
    invoice_type = models.CharField(
        max_length=20,
        choices=INVOICE_TYPE_CHOICES,
        default=INVOICE_TYPE_TAX,
        help_text='Tax Invoice (standard B2B) or Credit Note (per Article 65).'
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPE_CHOICES,
        default=TRANSACTION_B2B,
        help_text='B2B and B2G are mandatory Phase 1 scope (UAE MoF, Q2 2026).'
    )
    status = models.CharField(
        max_length=20,
        choices=INVOICE_STATUS_CHOICES,
        default=INVOICE_STATUS_DRAFT,
        db_index=True,
    )

    # ── Dates ──────────────────────────────────────────────────────────────────
    issue_date = models.DateField(
        default=timezone.localdate,
        help_text='Invoice issue date (date of supply for VAT purposes).'
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Payment due date.'
    )
    supply_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date of supply / tax point date. For continuous supplies this is the period start.'
    )
    supply_date_end = models.DateField(
        null=True,
        blank=True,
        help_text='End of supply period (Continuous Supplies only — maps to InvoicePeriod/EndDate).'
    )

    # ── Continuous Supply / Commercial ─────────────────────────────────────────
    contract_reference = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Contract document reference (Continuous Supplies — ContractDocumentReference/ID).'
    )

    # ── Currency ───────────────────────────────────────────────────────────────
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default=CURRENCY_AED,
    )
    exchange_rate = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        default=Decimal('1.000000'),
        help_text='Exchange rate to AED. Always 1.0 for AED invoices.'
    )

    # ── Financial Totals (stored, recalculated on item change) ─────────────────
    subtotal = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Sum of all item amounts before VAT.'
    )
    discount_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Invoice-level discount applied before VAT calculation.'
    )
    taxable_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='subtotal − discount_amount. VAT is calculated on this.'
    )
    total_vat = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total VAT across all line items.'
    )
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Grand total: taxable_amount + total_vat.'
    )

    # ── References ─────────────────────────────────────────────────────────────
    reference_number = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Original invoice number (required for credit notes).'
    )
    purchase_order_number = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Buyer PO number for reference.'
    )

    # ── XML / ASP ──────────────────────────────────────────────────────────────
    xml_file = models.FileField(
        upload_to='invoices/xml/%Y/%m/',
        null=True, blank=True,
        help_text='Generated PEPPOL UBL 2.1 XML file path in media storage.'
    )
    xml_generated_at = models.DateTimeField(null=True, blank=True)
    asp_submission_id = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Transaction ID returned by ASP after submission.'
    )
    asp_submitted_at = models.DateTimeField(null=True, blank=True)
    asp_response = models.JSONField(
        null=True, blank=True,
        help_text='Raw JSON response from ASP (accepted/rejected + details).'
    )

    # ── FTA Reporting (Corner 5) ───────────────────────────────────────────────
    fta_status = models.CharField(
        max_length=20,
        choices=FTA_STATUS_CHOICES,
        null=True,
        blank=True,
        db_index=True,
        help_text='FTA reporting status (Corner 5 in PEPPOL 5-corner model).'
    )
    fta_reference = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='FTA-assigned reference number after successful reporting.'
    )
    fta_reported_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when invoice data was reported to FTA data platform.'
    )

    # ── Notes ──────────────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'invoices'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-issue_date', '-invoice_sequence']
        indexes = [
            models.Index(fields=['company', 'status'],        name='idx_invoice_company_status'),
            models.Index(fields=['company', 'issue_date'],    name='idx_invoice_company_date'),
            models.Index(fields=['company', 'customer'],      name='idx_invoice_company_customer'),
        ]

    def __str__(self):
        return f'{self.invoice_number} — {self.customer.name} ({self.get_status_display()})'

    @property
    def is_editable(self) -> bool:
        """Only DRAFT invoices can be modified."""
        return self.status == INVOICE_STATUS_DRAFT

    @property
    def is_submittable(self) -> bool:
        """Invoice can be submitted only from DRAFT status with at least one item."""
        return self.status == INVOICE_STATUS_DRAFT and self.items.filter(is_active=True).exists()

    @property
    def is_cancellable(self) -> bool:
        """Can only cancel DRAFT or PENDING invoices."""
        return self.status in ('draft', 'pending')


# ─── Invoice Item Model ───────────────────────────────────────────────────────

class InvoiceItem(BaseModel):
    """
    A single line item on an invoice with individual VAT breakdown.

    All monetary values are stored to 2 decimal places (AED precision).
    Amounts are recalculated automatically on save.

    vat_rate_type determines which rate applies:
      standard    → 5% (UAE standard)
      zero        → 0% (eligible exports, healthcare, education)
      exempt      → no VAT (financial services, bare land, residential rent)
      out_of_scope → outside UAE VAT scope
    """

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items',
    )

    # ── Line Item Details ──────────────────────────────────────────────────────
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='Quantity (supports fractional units).'
    )
    unit = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text='Unit of measure (e.g. pcs, hrs, kg). Optional.'
    )
    unit_price = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Price per unit (before VAT).'
    )

    # ── VAT ───────────────────────────────────────────────────────────────────
    vat_rate_type = models.CharField(
        max_length=20,
        choices=VAT_RATE_CHOICES,
        default='standard',
        help_text='Determines the VAT rate applied to this line item.'
    )
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text='Actual VAT percentage applied (e.g. 5.00 for standard rate).'
    )

    # ── Computed Amounts (stored for performance and audit) ────────────────────
    subtotal = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='quantity × unit_price, before VAT.'
    )
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='VAT amount for this line item.'
    )
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='subtotal + vat_amount.'
    )

    # ── Sort Order ─────────────────────────────────────────────────────────────
    sort_order = models.PositiveSmallIntegerField(
        default=0,
        help_text='Display order of items on the invoice.'
    )

    class Meta:
        db_table = 'invoice_items'
        verbose_name = 'Invoice Item'
        verbose_name_plural = 'Invoice Items'
        ordering = ['sort_order', 'created_at']

    def __str__(self):
        return f'{self.invoice.invoice_number} / {self.description[:40]}'

    def save(self, *args, **kwargs):
        """Auto-calculate amounts before every save."""
        self._calculate_amounts()
        super().save(*args, **kwargs)

    def _calculate_amounts(self):
        """
        Recalculate subtotal, vat_amount, and total_amount.
        All rounding uses ROUND_HALF_UP to 2 decimal places (AED standard).
        """
        TWO_PLACES = Decimal('0.01')

        qty = Decimal(str(self.quantity))
        price = Decimal(str(self.unit_price))

        self.subtotal = (qty * price).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        # Determine vat_rate from type if not explicitly overridden
        rate = VAT_RATE_MAP.get(self.vat_rate_type)
        if rate is not None:
            self.vat_rate = rate
            self.vat_amount = (self.subtotal * rate / 100).quantize(
                TWO_PLACES, rounding=ROUND_HALF_UP
            )
        else:
            # exempt / out_of_scope: no VAT
            self.vat_rate = Decimal('0.00')
            self.vat_amount = Decimal('0.00')

        self.total_amount = self.subtotal + self.vat_amount
