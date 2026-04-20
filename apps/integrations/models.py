"""
Integrations app models.

ASPSubmissionLog — immutable audit trail of every transmission attempt.
Every call to the ASP is logged here, whether it succeeds or fails.
"""
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
