"""
Inbound invoice models — two-way PEPPOL e-invoicing reception pipeline.

Flow:
  Supplier submits invoice (API / email)
    → RECEIVED
    → VALIDATING (async Celery)
    → VALIDATION_FAILED  (observations sent, supplier must resubmit)
    → PENDING_REVIEW     (passed validation, awaiting internal approval)
    → APPROVED / REJECTED (internal decision)
    → FTA_SUBMITTED / FTA_ACCEPTED / FTA_REJECTED

Models:
  Supplier            — registered supplier with API key authentication
  InboundInvoice      — received invoice in the holding area
  InboundInvoiceItem  — line items extracted from the inbound document
  InboundObservation  — individual validation finding (error / warning / info)
  InboundAuditLog     — immutable record of every status change
"""
import hashlib
import secrets
import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel
from apps.common.constants import (
    INVOICE_TYPE_CHOICES, TRANSACTION_TYPE_CHOICES,
    CURRENCY_CHOICES, CURRENCY_AED,
)


# ─── Inbound Status Choices ───────────────────────────────────────────────────

INBOUND_STATUS_RECEIVED         = 'received'
INBOUND_STATUS_VALIDATING       = 'validating'
INBOUND_STATUS_VALIDATION_FAILED = 'validation_failed'
INBOUND_STATUS_PENDING_REVIEW   = 'pending_review'
INBOUND_STATUS_APPROVED         = 'approved'
INBOUND_STATUS_REJECTED         = 'rejected'
INBOUND_STATUS_FTA_SUBMITTED    = 'fta_submitted'
INBOUND_STATUS_FTA_ACCEPTED     = 'fta_accepted'
INBOUND_STATUS_FTA_REJECTED     = 'fta_rejected'

INBOUND_STATUS_CHOICES = [
    (INBOUND_STATUS_RECEIVED,          'Received'),
    (INBOUND_STATUS_VALIDATING,        'Validating'),
    (INBOUND_STATUS_VALIDATION_FAILED, 'Validation Failed'),
    (INBOUND_STATUS_PENDING_REVIEW,    'Pending Internal Review'),
    (INBOUND_STATUS_APPROVED,          'Approved'),
    (INBOUND_STATUS_REJECTED,          'Rejected'),
    (INBOUND_STATUS_FTA_SUBMITTED,     'Submitted to FTA'),
    (INBOUND_STATUS_FTA_ACCEPTED,      'FTA Accepted'),
    (INBOUND_STATUS_FTA_REJECTED,      'FTA Rejected'),
]

# ─── Observation Severity ─────────────────────────────────────────────────────

SEVERITY_CRITICAL = 'critical'   # Blocks processing — must fix before resubmit
SEVERITY_HIGH     = 'high'       # Significant issue — should fix
SEVERITY_MEDIUM   = 'medium'     # Warning — may need attention
SEVERITY_INFO     = 'info'       # Informational only

SEVERITY_CHOICES = [
    (SEVERITY_CRITICAL, 'Critical'),
    (SEVERITY_HIGH,     'High'),
    (SEVERITY_MEDIUM,   'Medium'),
    (SEVERITY_INFO,     'Info'),
]

# ─── Reception Channel ────────────────────────────────────────────────────────

CHANNEL_API   = 'api'
CHANNEL_EMAIL = 'email'
CHANNEL_PEPPOL = 'peppol'

CHANNEL_CHOICES = [
    (CHANNEL_API,    'API Submission'),
    (CHANNEL_EMAIL,  'Email Ingestion'),
    (CHANNEL_PEPPOL, 'PEPPOL Network'),
]


# ─── Supplier ─────────────────────────────────────────────────────────────────

class Supplier(BaseModel):
    """
    Registered supplier that can submit inbound invoices.

    API key is stored as a SHA-256 hash. The plaintext is only shown once
    on creation and never stored. Use Supplier.verify_api_key() to check.
    """
    name          = models.CharField(max_length=255)
    trn           = models.CharField(
        max_length=15, unique=True, db_index=True,
        help_text='UAE Tax Registration Number (15 digits).'
    )
    email         = models.EmailField(unique=True, help_text='Contact email for observations.')
    phone         = models.CharField(max_length=30, blank=True, default='')
    address       = models.TextField(blank=True, default='')

    # Linked platform user account (inbound_supplier role)
    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='supplier_profile',
        help_text='Platform user account for this supplier (inbound_supplier role).',
    )

    # Activation token — UUID sent in email, cleared after activation
    activation_token = models.UUIDField(null=True, blank=True, default=None)

    # Which internal company receives invoices from this supplier
    receiving_company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='inbound_suppliers',
        help_text='Our company that receives invoices from this supplier.',
    )

    # API auth
    api_key_hash  = models.CharField(
        max_length=64, blank=True, default='',
        help_text='SHA-256 hash of the supplier\'s API key.'
    )
    api_key_prefix = models.CharField(
        max_length=8, blank=True, default='',
        help_text='First 8 chars of key shown in UI for identification.'
    )

    # Email ingestion: sender address whitelisted for email-based submission
    whitelisted_email = models.EmailField(
        blank=True, default='',
        help_text='If set, inbound emails from this address are auto-accepted.'
    )

    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'inbound_suppliers'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} (TRN: {self.trn})'

    @classmethod
    def generate_api_key(cls) -> tuple[str, str]:
        """
        Generate a new API key.
        Returns (plaintext_key, key_hash). Store only the hash.
        """
        plaintext = secrets.token_urlsafe(32)
        key_hash  = hashlib.sha256(plaintext.encode()).hexdigest()
        return plaintext, key_hash

    def set_api_key(self, plaintext: str):
        """Hash and store an API key."""
        self.api_key_hash   = hashlib.sha256(plaintext.encode()).hexdigest()
        self.api_key_prefix = plaintext[:8]

    def verify_api_key(self, plaintext: str) -> bool:
        """Constant-time comparison to prevent timing attacks."""
        candidate = hashlib.sha256(plaintext.encode()).hexdigest()
        return secrets.compare_digest(self.api_key_hash, candidate)


# ─── Inbound Invoice ──────────────────────────────────────────────────────────

class InboundInvoice(BaseModel):
    """
    An invoice received from a supplier, held in the review pipeline.

    This is separate from the outbound Invoice model — it lives in the
    holding area until approved, at which point it is linked to the FTA
    submission flow.
    """

    # ── Reception ──────────────────────────────────────────────────────────────
    supplier          = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='inbound_invoices',
    )
    receiving_company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='received_invoices',
        help_text='Our company that received this invoice.',
    )
    channel           = models.CharField(
        max_length=10, choices=CHANNEL_CHOICES, default=CHANNEL_API
    )
    received_at       = models.DateTimeField(default=timezone.now)

    # ── Status ─────────────────────────────────────────────────────────────────
    status            = models.CharField(
        max_length=30,
        choices=INBOUND_STATUS_CHOICES,
        default=INBOUND_STATUS_RECEIVED,
        db_index=True,
    )

    # ── Invoice Identity (extracted from submission) ───────────────────────────
    supplier_invoice_number = models.CharField(
        max_length=100, db_index=True,
        help_text='Invoice number as assigned by the supplier.'
    )
    invoice_type      = models.CharField(
        max_length=20, choices=INVOICE_TYPE_CHOICES, default='tax_invoice'
    )
    transaction_type  = models.CharField(
        max_length=10, choices=TRANSACTION_TYPE_CHOICES, default='b2b'
    )

    # ── Dates ──────────────────────────────────────────────────────────────────
    issue_date        = models.DateField()
    due_date          = models.DateField(null=True, blank=True)
    supply_date       = models.DateField(null=True, blank=True)

    # ── Currency & Totals ─────────────────────────────────────────────────────
    currency          = models.CharField(
        max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_AED
    )
    subtotal          = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )
    total_vat         = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )
    total_amount      = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # ── Supplier References ────────────────────────────────────────────────────
    purchase_order_ref = models.CharField(max_length=100, blank=True, default='')
    contract_ref       = models.CharField(max_length=200, blank=True, default='')
    notes              = models.TextField(blank=True, default='')

    # ── Raw Payload ────────────────────────────────────────────────────────────
    raw_xml           = models.TextField(
        blank=True, default='',
        help_text='Original UBL XML as submitted by the supplier.'
    )
    raw_json          = models.JSONField(
        null=True, blank=True,
        help_text='Parsed JSON payload if submitted via API (non-XML path).'
    )
    attachment        = models.FileField(
        upload_to='inbound/attachments/%Y/%m/',
        null=True, blank=True,
        help_text='PDF or XML attachment received by email.'
    )

    # ── Validation Summary ─────────────────────────────────────────────────────
    validation_score  = models.SmallIntegerField(
        null=True, blank=True,
        help_text='0–100 score after validation (100 = fully compliant).'
    )
    has_critical_errors = models.BooleanField(default=False)
    observation_sent_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When the observation email was last sent to supplier.'
    )
    observation_count   = models.PositiveSmallIntegerField(default=0)

    # ── Internal Review ───────────────────────────────────────────────────────
    reviewed_by       = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_inbound_invoices',
    )
    reviewed_at       = models.DateTimeField(null=True, blank=True)
    reviewer_notes    = models.TextField(blank=True, default='')

    # ── FTA Submission (post-approval) ────────────────────────────────────────
    fta_submission_id = models.CharField(max_length=255, blank=True, default='')
    fta_submitted_at  = models.DateTimeField(null=True, blank=True)
    fta_response      = models.JSONField(null=True, blank=True)

    class Meta:
        db_table      = 'inbound_invoices'
        verbose_name  = 'Inbound Invoice'
        verbose_name_plural = 'Inbound Invoices'
        ordering      = ['-received_at']
        indexes = [
            models.Index(fields=['supplier', 'status'],     name='idx_inbound_supplier_status'),
            models.Index(fields=['receiving_company', 'status'], name='idx_inbound_company_status'),
            models.Index(fields=['received_at'],             name='idx_inbound_received_at'),
        ]

    def __str__(self):
        return f'INB-{self.supplier_invoice_number} from {self.supplier.name} [{self.status}]'

    @property
    def can_approve(self) -> bool:
        return self.status == INBOUND_STATUS_PENDING_REVIEW

    @property
    def can_reject(self) -> bool:
        return self.status in (
            INBOUND_STATUS_PENDING_REVIEW,
            INBOUND_STATUS_VALIDATION_FAILED,
        )

    @property
    def needs_resubmission(self) -> bool:
        return self.status == INBOUND_STATUS_VALIDATION_FAILED


# ─── Inbound Invoice Item ──────────────────────────────────────────────────────

class InboundInvoiceItem(BaseModel):
    """Line items extracted from the inbound invoice."""
    invoice     = models.ForeignKey(
        InboundInvoice, on_delete=models.CASCADE, related_name='items'
    )
    line_number  = models.PositiveSmallIntegerField(default=1)
    description  = models.CharField(max_length=500)
    quantity     = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('1.0000'))
    unit         = models.CharField(max_length=20, blank=True, default='')
    unit_price   = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal('0.0000'))
    vat_rate     = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('5.00'))
    vat_amount   = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    subtotal     = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'inbound_invoice_items'
        ordering = ['line_number']

    def __str__(self):
        return f'{self.invoice.supplier_invoice_number} / L{self.line_number}: {self.description[:40]}'


# ─── Inbound Observation ──────────────────────────────────────────────────────

class InboundObservation(BaseModel):
    """
    A single validation finding on an inbound invoice.

    CRITICAL findings block the invoice — supplier must fix and resubmit.
    HIGH/MEDIUM are included in the observation email as warnings.
    INFO findings are logged but not sent to the supplier.
    """
    invoice     = models.ForeignKey(
        InboundInvoice, on_delete=models.CASCADE, related_name='observations'
    )
    rule_code   = models.CharField(
        max_length=20,
        help_text='Validation rule identifier (e.g. V001, FAF-VAT-01).'
    )
    severity    = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    field_name  = models.CharField(
        max_length=100, blank=True, default='',
        help_text='The specific field that triggered this observation.'
    )
    message     = models.TextField(help_text='Human-readable description of the issue.')
    suggestion  = models.TextField(
        blank=True, default='',
        help_text='What the supplier should do to fix this issue.'
    )
    line_number = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Line item number if observation is item-level.'
    )

    # Track if this observation was included in the sent email
    included_in_email = models.BooleanField(default=False)

    class Meta:
        db_table  = 'inbound_observations'
        ordering  = ['severity', 'rule_code']

    def __str__(self):
        return f'[{self.severity.upper()}] {self.rule_code}: {self.message[:60]}'


# ─── Inbound Audit Log ────────────────────────────────────────────────────────

class InboundAuditLog(models.Model):
    """
    Immutable audit trail for every status change on an inbound invoice.
    Never updated — only appended. No soft-delete.
    """
    invoice     = models.ForeignKey(
        InboundInvoice, on_delete=models.CASCADE, related_name='audit_log'
    )
    timestamp   = models.DateTimeField(default=timezone.now, db_index=True)
    actor       = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        help_text='User who triggered the change. Null = system/Celery.'
    )
    from_status = models.CharField(max_length=30, blank=True, default='')
    to_status   = models.CharField(max_length=30)
    event       = models.CharField(
        max_length=100,
        help_text='Short description of what happened (e.g. "Validation passed").'
    )
    detail      = models.JSONField(
        null=True, blank=True,
        help_text='Extra data (observation counts, FTA response, etc.).'
    )

    class Meta:
        db_table = 'inbound_audit_log'
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.invoice} | {self.from_status} → {self.to_status} @ {self.timestamp}'
