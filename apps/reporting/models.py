"""
UAE E-Invoicing reporting models.

FATAuditFile — UAE VAT Audit File (FAF) required under Federal Decree-Law No. 16.
               Quarterly submission to FTA data platform.

APIRequestLog — API access log for compliance, abuse detection, and debugging.
"""
from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


# ─── FTA Audit File (FAF) ─────────────────────────────────────────────────────

class FATAuditFile(BaseModel):
    """
    UAE VAT Audit File (FAF) — quarterly extract of invoice data.

    Required under Federal Decree-Law No. 16 of 2024 (UAE e-invoicing).
    Submitted to FTA data platform by the ASP on behalf of the company.

    A FAF covers all tax invoices and credit notes issued in a VAT period.
    """

    STATUS_GENERATED  = 'generated'
    STATUS_SUBMITTED  = 'submitted'
    STATUS_ACCEPTED   = 'accepted'
    STATUS_REJECTED   = 'rejected'

    STATUS_CHOICES = [
        (STATUS_GENERATED, 'Generated — awaiting submission'),
        (STATUS_SUBMITTED, 'Submitted to FTA'),
        (STATUS_ACCEPTED,  'Accepted by FTA'),
        (STATUS_REJECTED,  'Rejected by FTA — needs correction'),
    ]

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.PROTECT,
        related_name='faf_files',
    )
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_fafs',
    )

    # VAT period
    period_start = models.DateField(help_text='First day of the VAT reporting period.')
    period_end   = models.DateField(help_text='Last day of the VAT reporting period.')

    # File
    file = models.FileField(
        upload_to='reports/faf/%Y/%m/',
        null=True,
        blank=True,
        help_text='Generated FAF file (CSV/XML format per FTA spec).'
    )
    file_format = models.CharField(
        max_length=10,
        default='csv',
        choices=[('csv', 'CSV'), ('xml', 'XML')],
    )

    # FTA submission
    status       = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_GENERATED,
        db_index=True,
    )
    fta_reference = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='FTA-assigned reference number on acceptance.'
    )
    submitted_at  = models.DateTimeField(null=True, blank=True)
    accepted_at   = models.DateTimeField(null=True, blank=True)

    # Statistics
    invoice_count    = models.PositiveIntegerField(default=0)
    credit_note_count = models.PositiveIntegerField(default=0)
    total_taxable_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )
    total_vat_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )

    error_detail  = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'fta_audit_files'
        verbose_name = 'FTA Audit File (FAF)'
        verbose_name_plural = 'FTA Audit Files (FAF)'
        ordering = ['-period_end']
        unique_together = [('company', 'period_start', 'period_end')]
        indexes = [
            models.Index(fields=['company', 'period_end'], name='idx_faf_company_period'),
            models.Index(fields=['status'],                name='idx_faf_status'),
        ]

    def __str__(self):
        return (
            f'{self.company.name} FAF: '
            f'{self.period_start} → {self.period_end} ({self.status})'
        )


# ─── API Request Log ──────────────────────────────────────────────────────────

class APIRequestLog(models.Model):
    """
    API access log for compliance, abuse detection, and debugging.

    Populated by the RequestLoggingMiddleware on every API request.
    Retained for 90 days by default (configurable via API_LOG_RETENTION_DAYS).
    """

    id = models.BigAutoField(primary_key=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='api_request_logs',
    )
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='api_request_logs',
    )

    # Request
    method       = models.CharField(max_length=10)
    path         = models.CharField(max_length=500, db_index=True)
    query_string = models.CharField(max_length=1000, blank=True, default='')
    request_id   = models.CharField(max_length=64, blank=True, default='', db_index=True)

    # Response
    status_code  = models.PositiveSmallIntegerField(db_index=True)
    duration_ms  = models.PositiveIntegerField(default=0)

    # Client
    ip_address   = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent   = models.CharField(max_length=500, blank=True, default='')

    # Metadata
    error_detail = models.TextField(blank=True, default='')
    timestamp    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'api_request_logs'
        verbose_name = 'API Request Log'
        verbose_name_plural = 'API Request Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp', 'status_code'], name='idx_apilog_ts_status'),
            models.Index(fields=['ip_address', 'timestamp'],  name='idx_apilog_ip_ts'),
            models.Index(fields=['user', 'timestamp'],        name='idx_apilog_user_ts'),
        ]
