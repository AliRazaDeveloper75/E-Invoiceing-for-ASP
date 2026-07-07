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
    CURRENCY_CHOICES, VAT_RATE_CHOICES, PAYMENT_MEANS_CHOICES,
    INVOICE_STATUS_DRAFT, INVOICE_TYPE_TAX, TRANSACTION_B2B, CURRENCY_AED,
    UAE_VAT_RATE, FTA_STATUS_CHOICES, PAYMENT_MEANS_CREDIT_TRANSFER,
    INVOICE_STATUS_CANCELLED, INVOICE_STATUS_DEACTIVATED,
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
        db_index=True,
        help_text='Auto-generated invoice number, unique per company (e.g. INV-202601-000001).'
    )
    invoice_sequence = models.PositiveIntegerField(
        default=0,
        help_text='Sequential number per company. Used to generate invoice_number. Never reset.'
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

    # ── Deactivation (user disables an invoice, with a reason) ──────────────────
    deactivation_reason = models.TextField(
        blank=True, default='',
        help_text='Reason provided by the user when the invoice was deactivated.'
    )
    deactivated_at = models.DateTimeField(null=True, blank=True)

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

    # ── Payment ────────────────────────────────────────────────────────────────
    payment_means_code = models.CharField(
        max_length=5,
        choices=PAYMENT_MEANS_CHOICES,
        default=PAYMENT_MEANS_CREDIT_TRANSFER,
        help_text='UN/ECE UNCL 4461 payment means code (e.g. 30=Credit Transfer, 10=Cash). '
                  'Mandatory in UBL PaymentMeans element.',
    )

    # ── Payment Tracking ───────────────────────────────────────────────────────
    amount_paid = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total amount paid by the buyer (sum of all Payment records).'
    )

    # ── Buyer Engagement ───────────────────────────────────────────────────────
    buyer_viewed_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Timestamp when a buyer first opened this invoice via the Buyer Portal.'
    )

    # ── Buyer approval / e-signature (pre-ASP review flow) ──────────────────────
    buyer_signed_name = models.CharField(
        max_length=160, blank=True, default='',
        help_text='Name the buyer typed when e-signing / confirming the order.'
    )
    buyer_signed_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Timestamp when the buyer approved & e-signed the invoice.'
    )
    buyer_signature_ip = models.GenericIPAddressField(
        null=True, blank=True,
        help_text='IP address captured at the time of the buyer e-signature.'
    )
    buyer_approval_note = models.TextField(
        blank=True, default='',
        help_text='Buyer note / reason (e.g. on rejection).'
    )

    # ── Notes ──────────────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'invoices'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-issue_date', '-invoice_sequence']
        # UAE Article 70: numbering must be unique and consecutive per issuing company
        unique_together = [('company', 'invoice_number')]
        indexes = [
            models.Index(fields=['company', 'status'],           name='idx_invoice_company_status'),
            models.Index(fields=['company', 'issue_date'],       name='idx_invoice_company_date'),
            models.Index(fields=['company', 'customer'],         name='idx_invoice_company_customer'),
            models.Index(fields=['company', 'invoice_sequence'], name='idx_invoice_company_seq'),
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

    @property
    def is_deactivatable(self) -> bool:
        """Any live invoice can be deactivated (with a reason) except ones
        already cancelled or deactivated."""
        return self.status not in (INVOICE_STATUS_CANCELLED, INVOICE_STATUS_DEACTIVATED)

    # ── Accounts Receivable (AR) ───────────────────────────────────────────────
    @property
    def balance_due(self) -> Decimal:
        """Outstanding amount still owed by the buyer."""
        return (self.total_amount or Decimal('0.00')) - (self.amount_paid or Decimal('0.00'))

    @property
    def is_receivable(self) -> bool:
        """A real, outstanding invoice that belongs in Accounts Receivable."""
        return (self.balance_due > 0
                and self.status not in (INVOICE_STATUS_DRAFT, INVOICE_STATUS_CANCELLED,
                                        INVOICE_STATUS_DEACTIVATED))

    @property
    def is_overdue(self) -> bool:
        """Receivable whose due date has passed."""
        return (self.is_receivable and self.due_date is not None
                and self.due_date < timezone.now().date())

    @property
    def days_overdue(self) -> int:
        """Number of days past the due date (0 if not overdue)."""
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days


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
    item_name = models.CharField(
        max_length=150,
        blank=True,
        default='',
        help_text='Short product/service name (UBL Item/Name, max 150 chars). '
                  'If blank, falls back to the first 80 chars of description in XML.',
    )
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


# ─── Invoice Audit Log ────────────────────────────────────────────────────────

class InvoiceAuditLog(models.Model):
    """
    Immutable audit trail for every state change and edit on an invoice.

    UAE Federal Decree-Law No. 16 (Article 65) requires full audit trail.
    Never update these records — create new entries only.
    """

    ACTION_CREATED    = 'created'
    ACTION_UPDATED    = 'updated'
    ACTION_SUBMITTED  = 'submitted'
    ACTION_VALIDATED  = 'validated'
    ACTION_REJECTED   = 'rejected'
    ACTION_CANCELLED  = 'cancelled'
    ACTION_DEACTIVATED = 'deactivated'
    ACTION_PAID       = 'paid'
    ACTION_XML_GEN    = 'xml_generated'
    ACTION_ASP_SENT   = 'asp_sent'
    ACTION_FTA_SENT   = 'fta_reported'
    ACTION_ITEM_ADDED = 'item_added'
    ACTION_ITEM_UPDATED = 'item_updated'
    ACTION_ITEM_REMOVED = 'item_removed'
    ACTION_DELETED    = 'deleted'

    ACTION_CHOICES = [
        (ACTION_CREATED,      'Invoice Created'),
        (ACTION_UPDATED,      'Invoice Updated'),
        (ACTION_SUBMITTED,    'Submitted for Processing'),
        (ACTION_VALIDATED,    'Validated by ASP'),
        (ACTION_REJECTED,     'Rejected'),
        (ACTION_CANCELLED,    'Cancelled'),
        (ACTION_DEACTIVATED,  'Deactivated'),
        (ACTION_PAID,         'Marked Paid'),
        (ACTION_XML_GEN,      'XML Generated'),
        (ACTION_ASP_SENT,     'Sent to ASP'),
        (ACTION_FTA_SENT,     'Reported to FTA'),
        (ACTION_ITEM_ADDED,   'Item Added'),
        (ACTION_ITEM_UPDATED, 'Item Updated'),
        (ACTION_ITEM_REMOVED, 'Item Removed'),
        (ACTION_DELETED,      'Invoice Deleted'),
    ]

    id = models.BigAutoField(primary_key=True)

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)

    # Actor (null if system-generated e.g. Celery)
    performed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_audit_logs',
    )
    performed_by_email = models.EmailField(
        blank=True,
        default='',
        help_text='Denormalized email for historical accuracy after user deletion.'
    )

    # What changed (for UPDATE actions)
    field_name  = models.CharField(max_length=100, blank=True, default='')
    old_value   = models.TextField(blank=True, default='')
    new_value   = models.TextField(blank=True, default='')

    # Context
    description = models.TextField(blank=True, default='')
    metadata    = models.JSONField(null=True, blank=True)

    # Request context
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    user_agent  = models.CharField(max_length=500, blank=True, default='')
    request_id  = models.CharField(max_length=64, blank=True, default='')

    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'invoice_audit_logs'
        verbose_name = 'Invoice Audit Log'
        verbose_name_plural = 'Invoice Audit Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['invoice', 'timestamp'],  name='idx_auditlog_invoice_ts'),
            models.Index(fields=['invoice', 'action'],     name='idx_auditlog_invoice_action'),
            models.Index(fields=['performed_by', 'timestamp'], name='idx_auditlog_user_ts'),
        ]

    def __str__(self):
        return f'{self.invoice.invoice_number} | {self.action} @ {self.timestamp}'

    @classmethod
    def log(cls, invoice, action: str, performed_by=None, request=None,
            field_name='', old_value='', new_value='', description='', metadata=None):
        """
        Convenience factory. Call this everywhere instead of cls.objects.create().
        Thread-safe — uses bulk_create internally where possible.
        """
        entry = cls(
            invoice=invoice,
            action=action,
            performed_by=performed_by,
            performed_by_email=getattr(performed_by, 'email', ''),
            field_name=field_name,
            old_value=str(old_value) if old_value != '' else '',
            new_value=str(new_value) if new_value != '' else '',
            description=description,
            metadata=metadata,
        )
        if request:
            entry.ip_address = _get_client_ip(request)
            entry.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            entry.request_id = getattr(request, 'request_id', '')
        entry.save()
        return entry


def _get_client_ip(request) -> str:
    """Extract real client IP, respecting X-Forwarded-For."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


# ─── Invoice Fraud Alert ──────────────────────────────────────────────────────

class InvoiceFraudAlert(BaseModel):
    """
    Persisted result of the AI fraud analysis for a single invoice.

    Created (or updated) by the analyze_invoice_fraud Celery task.
    risk_score:  0.0 (clean) → 1.0 (high risk)
    risk_level:  'low' | 'medium' | 'high'
    auto_action: 'none' | 'flag' | 'block' | 'approve'
    """

    RISK_LOW    = 'low'
    RISK_MEDIUM = 'medium'
    RISK_HIGH   = 'high'
    RISK_CHOICES = [
        (RISK_LOW,    'Low Risk'),
        (RISK_MEDIUM, 'Medium Risk — Review Required'),
        (RISK_HIGH,   'High Risk — Blocked'),
    ]

    ACTION_NONE    = 'none'
    ACTION_FLAG    = 'flag'
    ACTION_BLOCK   = 'block'
    ACTION_APPROVE = 'approve'
    ACTION_CHOICES = [
        (ACTION_NONE,    'No Action'),
        (ACTION_FLAG,    'Flagged for Review'),
        (ACTION_BLOCK,   'Blocked'),
        (ACTION_APPROVE, 'Auto-Approved'),
    ]

    invoice = models.OneToOneField(
        Invoice,
        on_delete=models.CASCADE,
        related_name='fraud_alert',
    )

    risk_score = models.FloatField(
        default=0.0,
        help_text='Composite fraud risk score 0.0–1.0.',
    )
    risk_level = models.CharField(
        max_length=10,
        choices=RISK_CHOICES,
        default=RISK_LOW,
        db_index=True,
    )
    auto_action = models.CharField(
        max_length=10,
        choices=ACTION_CHOICES,
        default=ACTION_NONE,
    )

    flags_json = models.JSONField(
        default=list,
        help_text='List of FraudFlag dicts: {code, description, severity, category}.',
    )
    duplicate_invoice_ids = models.JSONField(
        default=list,
        help_text='UUIDs of invoices considered duplicates of this one.',
    )
    ai_explanation = models.TextField(
        blank=True,
        default='',
        help_text='LLM-generated explanation (high-risk invoices only).',
    )

    # Resolution
    is_resolved   = models.BooleanField(default=False)
    resolved_by   = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resolved_fraud_alerts',
    )
    resolved_at   = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True, default='')

    # Timestamps (task execution)
    analyzed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'invoice_fraud_alerts'
        verbose_name = 'Invoice Fraud Alert'
        verbose_name_plural = 'Invoice Fraud Alerts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['risk_level', 'is_resolved'], name='idx_fraud_risk_resolved'),
            models.Index(fields=['invoice'],                   name='idx_fraud_invoice'),
        ]

    def __str__(self):
        return f'{self.invoice.invoice_number} | {self.risk_level} ({self.risk_score:.2f})'

    @property
    def is_flagged(self) -> bool:
        return self.risk_level in (self.RISK_MEDIUM, self.RISK_HIGH)


# ─── Product Catalog ──────────────────────────────────────────────────────────

class Product(BaseModel):
    """
    Reusable catalog item suppliers pick when adding invoice line items.

    Two scopes:
      - Global  (company=None) — managed by platform admins, visible to everyone
      - Company (company set)  — managed by that company, visible to its users only
    """
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='products',
        null=True, blank=True,
        help_text='Owning company. Null = global catalog item (admin-managed).',
    )
    name         = models.CharField(max_length=150)
    description  = models.CharField(max_length=500, blank=True, default='')
    unit_price   = models.DecimalField(
        max_digits=15, decimal_places=4,
        validators=[MinValueValidator(Decimal('0'))],
    )
    vat_rate_type = models.CharField(max_length=20, choices=VAT_RATE_CHOICES, default='standard')
    unit          = models.CharField(max_length=20, blank=True, default='')
    is_active     = models.BooleanField(default=True)

    class Meta:
        db_table = 'products'
        ordering = ['name']
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_product_company_active'),
        ]

    def __str__(self):
        scope = 'global' if self.company_id is None else self.company.name
        return f'{self.name} ({scope})'


class InvoiceDraft(BaseModel):
    """Server-side autosave scratchpad for an in-progress invoice form.

    Stores the raw form JSON snapshot (partial data allowed — no customer/items
    required) so a user can resume an unsaved invoice from any device, not just
    the browser that has the localStorage copy. One draft per
    (user, company, form_type); upserted on autosave; deleted once the invoice is
    actually created. This is NOT a real Invoice — it never enters the PEPPOL
    pipeline; it only guards against power loss / device switch.
    """
    user = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='invoice_drafts',
    )
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='invoice_drafts',
    )
    form_type = models.CharField(
        max_length=20, default='pint',
        help_text="Which create form this draft belongs to: 'pint' or 'new'.",
    )
    payload = models.JSONField(default=dict, help_text='Raw form snapshot (JSON).')

    class Meta:
        db_table = 'invoice_drafts'
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'company', 'form_type'],
                name='uniq_invoice_draft_user_company_form',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'form_type'], name='idx_invoice_draft_user_form'),
        ]

    def __str__(self):
        return f'InvoiceDraft({self.form_type}) — user={self.user_id} company={self.company_id}'
