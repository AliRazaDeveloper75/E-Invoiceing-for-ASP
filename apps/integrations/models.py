"""
Integrations app models.

  ASPSubmissionLog   — immutable audit trail of every ASP transmission attempt
  FTASubmissionLog   — immutable audit trail of every FTA report attempt
  SMPEndpointCache   — cached PEPPOL SMP endpoint lookups
  CertificateRecord  — PKI certificate management (PEPPOL signing certs)
  WebhookEndpoint    — company-configured outbound webhook receivers
  PEPPOLMessage      — full audit trail of every PEPPOL network message
"""
import hashlib
import uuid

from django.conf import settings
from django.db import models
from apps.common.models import BaseModel
from apps.common.constants import (
    ASP_STATUS_CHOICES, ASP_STATUS_PENDING,
    FTA_STATUS_CHOICES, FTA_STATUS_REPORTED,
)


class ASPSubmissionLog(BaseModel):
    """
    Immutable record of an invoice transmission attempt to the ASP.

    Created on every submit attempt (success, failure, or error).
    Provides full audit trail for compliance and debugging.
    Never updated — create a new record for each retry.
    """

    invoice = models.ForeignKey(
        'invoices.Invoice',
        on_delete=models.CASCADE,
        related_name='submission_logs',
    )
    attempt_number = models.PositiveSmallIntegerField(
        default=1,
        help_text='Sequential attempt number (1 = first try, 2 = first retry, etc.)'
    )
    status = models.CharField(
        max_length=20,
        choices=ASP_STATUS_CHOICES,
        default=ASP_STATUS_PENDING,
        db_index=True,
    )
    submission_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Transaction ID returned by ASP on acceptance.'
    )
    request_size_bytes = models.PositiveIntegerField(
        default=0,
        help_text='Size of the XML payload sent to the ASP.'
    )
    response_payload = models.JSONField(
        null=True,
        blank=True,
        help_text='Complete raw JSON response from the ASP (sanitized, no PII).'
    )
    error_message = models.TextField(
        blank=True,
        default='',
        help_text='Error or rejection message from the ASP.'
    )
    submitted_at = models.DateTimeField(
        help_text='Timestamp when the request was sent to the ASP.'
    )

    class Meta:
        db_table = 'asp_submission_logs'
        verbose_name = 'ASP Submission Log'
        verbose_name_plural = 'ASP Submission Logs'
        ordering = ['-submitted_at']
        indexes = [
            models.Index(
                fields=['invoice', 'status'],
                name='idx_asplog_invoice_status'
            ),
        ]

    def __str__(self):
        return (
            f'{self.invoice.invoice_number} — '
            f'Attempt #{self.attempt_number} ({self.status})'
        )


# ─── FTA Submission Log ───────────────────────────────────────────────────────

class FTASubmissionLog(BaseModel):
    """
    Immutable record of every FTA reporting attempt (Corner 5).

    Created after each call to FTAReportingService.report().
    Never updated — create a new record for each retry.
    Provides full audit trail for MoF compliance and debugging.
    """

    invoice = models.ForeignKey(
        'invoices.Invoice',
        on_delete=models.CASCADE,
        related_name='fta_logs',
    )
    status = models.CharField(
        max_length=20,
        choices=FTA_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )
    fta_reference = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Reference number assigned by the FTA data platform on acceptance.'
    )
    response_payload = models.JSONField(
        null=True,
        blank=True,
        help_text='Raw JSON response from the FTA relay endpoint.'
    )
    error_message = models.TextField(
        blank=True,
        default='',
        help_text='Error details if the FTA report was rejected.'
    )
    reported_at = models.DateTimeField(
        help_text='Timestamp when the report was sent to the FTA data platform.'
    )

    class Meta:
        db_table = 'fta_submission_logs'
        verbose_name = 'FTA Submission Log'
        verbose_name_plural = 'FTA Submission Logs'
        ordering = ['-reported_at']
        indexes = [
            models.Index(
                fields=['invoice', 'status'],
                name='idx_ftalog_invoice_status'
            ),
        ]

    def __str__(self):
        return f'{self.invoice.invoice_number} — FTA ({self.status})'


# ─── SMP Endpoint Cache ───────────────────────────────────────────────────────

class SMPEndpointCache(BaseModel):
    """
    Local cache of PEPPOL SMP endpoint lookups.

    Avoids repeated DNS + HTTP round-trips for the same participant.
    Records are refreshed when the TTL expires (PEPPOL_SMP_CACHE_TTL_HOURS).

    participant_id:    Full PEPPOL participant ID, e.g. '0235:123456789'
    document_type_id:  PEPPOL document type identifier (UBL Invoice BIS 3.0)
    transport_url:     AS4 endpoint URL of the receiving Access Point
    transport_profile: PEPPOL transport profile identifier
    certificate_uid:   Base64-encoded certificate of the receiving AP
    """

    participant_id   = models.CharField(max_length=255, db_index=True)
    document_type_id = models.CharField(max_length=500)
    transport_url    = models.URLField(max_length=500)
    transport_profile = models.CharField(
        max_length=100,
        default='peppol-transport-as4-v2_0',
    )
    certificate_uid  = models.TextField(blank=True, default='')

    class Meta:
        db_table     = 'smp_endpoint_cache'
        verbose_name = 'SMP Endpoint Cache'
        unique_together = [('participant_id', 'document_type_id')]
        indexes = [
            models.Index(
                fields=['participant_id'],
                name='idx_smp_participant',
            ),
        ]

    def __str__(self):
        return f'{self.participant_id} → {self.transport_url}'


# ─── Certificate Record ───────────────────────────────────────────────────────

class CertificateRecord(BaseModel):
    """
    Tracks PKI certificates used for PEPPOL document signing and TLS.

    In production, private keys should be in KMS/HSM.
    This model records the certificate metadata and where the key material lives.
    cert_tasks.py monitors expiry and triggers alerts via this model.
    """

    CERT_TYPE_PEPPOL_SIGNING = 'peppol_signing'
    CERT_TYPE_FTA_AUTH       = 'fta_auth'
    CERT_TYPE_TLS_CLIENT     = 'tls_client'

    CERT_TYPE_CHOICES = [
        (CERT_TYPE_PEPPOL_SIGNING, 'PEPPOL Signing Certificate'),
        (CERT_TYPE_FTA_AUTH,       'FTA Authentication Certificate'),
        (CERT_TYPE_TLS_CLIENT,     'TLS Client Certificate'),
    ]

    KEY_STORAGE_FILESYSTEM = 'filesystem'
    KEY_STORAGE_KMS        = 'kms'
    KEY_STORAGE_HSM        = 'hsm'
    KEY_STORAGE_VAULT      = 'vault'

    KEY_STORAGE_CHOICES = [
        (KEY_STORAGE_FILESYSTEM, 'Filesystem (dev only)'),
        (KEY_STORAGE_KMS,        'AWS KMS / Azure Key Vault'),
        (KEY_STORAGE_HSM,        'Hardware Security Module'),
        (KEY_STORAGE_VAULT,      'HashiCorp Vault'),
    ]

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='certificates',
        null=True,
        blank=True,
        help_text='Null = platform-level cert shared across all companies.'
    )
    cert_type = models.CharField(
        max_length=20,
        choices=CERT_TYPE_CHOICES,
        default=CERT_TYPE_PEPPOL_SIGNING,
        db_index=True,
    )
    common_name  = models.CharField(max_length=255, help_text='Certificate CN field.')
    serial_number = models.CharField(
        max_length=100,
        unique=True,
        help_text='X.509 serial number (hex).'
    )
    issued_by    = models.CharField(max_length=255, help_text='Issuer CN.')
    issued_at    = models.DateTimeField()
    expires_at   = models.DateTimeField(db_index=True)
    fingerprint_sha256 = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='SHA-256 fingerprint of the DER-encoded certificate.'
    )

    # Key storage configuration
    key_storage  = models.CharField(
        max_length=20,
        choices=KEY_STORAGE_CHOICES,
        default=KEY_STORAGE_FILESYSTEM,
    )
    key_reference = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text=(
            'Filesystem: path to private key file. '
            'KMS: key ARN. Vault: secret path. '
            'Never store the key material itself here.'
        )
    )
    cert_path = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='Path to the certificate file (PEM/DER).'
    )

    is_active  = models.BooleanField(default=True, db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'certificate_records'
        verbose_name = 'Certificate Record'
        verbose_name_plural = 'Certificate Records'
        ordering = ['-expires_at']
        indexes = [
            models.Index(fields=['cert_type', 'is_active', 'expires_at'],
                         name='idx_cert_type_active_expiry'),
        ]

    def __str__(self):
        return f'{self.common_name} ({self.cert_type}) expires {self.expires_at.date()}'

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def days_until_expiry(self) -> int:
        from django.utils import timezone
        delta = self.expires_at - timezone.now()
        return delta.days


# ─── Webhook Endpoint ─────────────────────────────────────────────────────────

class WebhookEndpoint(BaseModel):
    """
    Company-configured outbound webhook receivers.

    When an invoice changes status (validated, rejected, paid), the platform
    posts the event to all active webhook endpoints for that company.

    Security: each endpoint has a HMAC secret so the receiver can verify
    the payload. The secret is never returned via API after creation.
    """

    EVENT_INVOICE_VALIDATED = 'invoice.validated'
    EVENT_INVOICE_REJECTED  = 'invoice.rejected'
    EVENT_INVOICE_PAID      = 'invoice.paid'
    EVENT_INVOICE_CANCELLED = 'invoice.cancelled'
    EVENT_FTA_REPORTED      = 'fta.reported'

    ALL_EVENTS = [
        EVENT_INVOICE_VALIDATED,
        EVENT_INVOICE_REJECTED,
        EVENT_INVOICE_PAID,
        EVENT_INVOICE_CANCELLED,
        EVENT_FTA_REPORTED,
    ]

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='webhook_endpoints',
    )
    name = models.CharField(
        max_length=100,
        help_text='Human-readable name for this webhook (e.g. "ERP System", "Accounting App").'
    )
    url = models.URLField(
        max_length=500,
        help_text='HTTPS URL to POST events to.'
    )
    secret = models.CharField(
        max_length=128,
        help_text='HMAC-SHA256 secret. Used to sign payloads. Never expose via API after creation.'
    )
    events = models.JSONField(
        default=list,
        help_text='List of event types to deliver (e.g. ["invoice.validated", "invoice.rejected"]).'
    )
    is_active       = models.BooleanField(default=True, db_index=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    failure_count   = models.PositiveSmallIntegerField(
        default=0,
        help_text='Consecutive delivery failures. Auto-disabled at 10.'
    )

    class Meta:
        db_table = 'webhook_endpoints'
        verbose_name = 'Webhook Endpoint'
        verbose_name_plural = 'Webhook Endpoints'
        ordering = ['company__name', 'name']

    def __str__(self):
        return f'{self.company.name} → {self.url} [{", ".join(self.events)}]'

    @classmethod
    def generate_secret(cls) -> str:
        """Generate a cryptographically secure webhook secret."""
        import secrets as _secrets
        return _secrets.token_hex(32)


# ─── PEPPOL Message Log ───────────────────────────────────────────────────────

class PEPPOLMessage(BaseModel):
    """
    Full audit trail of every PEPPOL network message (inbound + outbound).

    Provides non-repudiation evidence required by PEPPOL governance.
    The raw_payload_hash is the SHA-256 of the signed XML — can be verified
    against the stored XML file at any time.
    """

    DIRECTION_OUTBOUND = 'outbound'
    DIRECTION_INBOUND  = 'inbound'

    DIRECTION_CHOICES = [
        (DIRECTION_OUTBOUND, 'Outbound (Supplier → Buyer)'),
        (DIRECTION_INBOUND,  'Inbound (Buyer → Supplier)'),
    ]

    TRANSMISSION_STATUS_QUEUED    = 'queued'
    TRANSMISSION_STATUS_SENT      = 'sent'
    TRANSMISSION_STATUS_DELIVERED = 'delivered'
    TRANSMISSION_STATUS_FAILED    = 'failed'
    TRANSMISSION_STATUS_MDN_RECV  = 'mdn_received'

    TRANSMISSION_STATUS_CHOICES = [
        (TRANSMISSION_STATUS_QUEUED,    'Queued'),
        (TRANSMISSION_STATUS_SENT,      'Sent'),
        (TRANSMISSION_STATUS_DELIVERED, 'Delivered'),
        (TRANSMISSION_STATUS_FAILED,    'Failed'),
        (TRANSMISSION_STATUS_MDN_RECV,  'MDN Received'),
    ]

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='peppol_messages',
    )
    invoice = models.ForeignKey(
        'invoices.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='peppol_messages',
    )

    direction  = models.CharField(max_length=10, choices=DIRECTION_CHOICES, db_index=True)
    message_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)

    # PEPPOL participant identifiers
    sender_participant_id   = models.CharField(max_length=200)
    receiver_participant_id = models.CharField(max_length=200)

    # PEPPOL document type (e.g. urn:oasis:names:specification:ubl:schema:xsd:Invoice-2)
    document_type_id = models.CharField(max_length=500)
    process_id       = models.CharField(max_length=500, blank=True, default='')

    transmission_status = models.CharField(
        max_length=20,
        choices=TRANSMISSION_STATUS_CHOICES,
        default=TRANSMISSION_STATUS_QUEUED,
        db_index=True,
    )

    # AS4 transport
    as4_message_id    = models.CharField(max_length=255, blank=True, default='')
    as4_endpoint_url  = models.URLField(max_length=500, blank=True, default='')

    # MDN (Message Disposition Notification) — proof of delivery
    mdn_received_at  = models.DateTimeField(null=True, blank=True)
    mdn_status       = models.CharField(max_length=50, blank=True, default='')

    # Payload integrity
    raw_payload_hash = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='SHA-256 hex digest of the transmitted XML payload.'
    )
    payload_size_bytes = models.PositiveIntegerField(default=0)

    error_message = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'peppol_messages'
        verbose_name = 'PEPPOL Message'
        verbose_name_plural = 'PEPPOL Messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'direction', 'created_at'],
                         name='idx_peppol_company_dir'),
            models.Index(fields=['invoice', 'direction'],
                         name='idx_peppol_invoice'),
            models.Index(fields=['transmission_status'],
                         name='idx_peppol_status'),
        ]

    def __str__(self):
        return f'{self.direction.upper()} {self.message_id} ({self.transmission_status})'

    @staticmethod
    def compute_hash(payload_bytes: bytes) -> str:
        return hashlib.sha256(payload_bytes).hexdigest()
