"""
AI OCR Models.

OCRDocument  — uploaded file awaiting or undergoing AI extraction
OCRResult    — extracted + validated data from an OCR pass
"""
import uuid
from django.conf import settings
from django.db import models
from apps.common.models import BaseModel


class OCRDocument(BaseModel):
    """
    An uploaded invoice document submitted for AI OCR extraction.

    Lifecycle: uploaded → processing → completed | failed
    """

    STATUS_UPLOADED    = 'uploaded'
    STATUS_PROCESSING  = 'processing'
    STATUS_COMPLETED   = 'completed'
    STATUS_FAILED      = 'failed'
    STATUS_REVIEWED    = 'reviewed'

    STATUS_CHOICES = [
        (STATUS_UPLOADED,   'Uploaded — awaiting processing'),
        (STATUS_PROCESSING, 'Processing — AI extracting data'),
        (STATUS_COMPLETED,  'Completed — data extracted'),
        (STATUS_FAILED,     'Failed — extraction error'),
        (STATUS_REVIEWED,   'Reviewed — user confirmed data'),
    ]

    MIME_PDF  = 'application/pdf'
    MIME_PNG  = 'image/png'
    MIME_JPEG = 'image/jpeg'

    MIME_CHOICES = [
        (MIME_PDF,  'PDF'),
        (MIME_PNG,  'PNG Image'),
        (MIME_JPEG, 'JPEG Image'),
    ]

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ocr_documents',
    )
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='ocr_documents',
        null=True,
        blank=True,
    )

    file         = models.FileField(upload_to='ocr/documents/%Y/%m/%d/')
    original_name = models.CharField(max_length=255, blank=True)
    mime_type    = models.CharField(max_length=50, choices=MIME_CHOICES, default=MIME_PDF)
    file_size_bytes = models.PositiveIntegerField(default=0)

    status       = models.CharField(max_length=20, choices=STATUS_CHOICES,
                                    default=STATUS_UPLOADED, db_index=True)
    error_detail = models.TextField(blank=True, default='')

    # Link to invoice if this document was used to create/match one
    linked_invoice = models.ForeignKey(
        'invoices.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ocr_source_documents',
    )

    processing_started_at  = models.DateTimeField(null=True, blank=True)
    processing_finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ocr_documents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_ocr_doc_company_status'),
            models.Index(fields=['uploaded_by', 'created_at'], name='idx_ocr_doc_user_ts'),
        ]

    def __str__(self):
        return f'OCR:{self.original_name} ({self.status})'

    @property
    def processing_duration_ms(self) -> int:
        if self.processing_started_at and self.processing_finished_at:
            delta = self.processing_finished_at - self.processing_started_at
            return int(delta.total_seconds() * 1000)
        return 0


class OCRResult(BaseModel):
    """
    Structured data extracted from an OCRDocument by the AI pipeline.
    Stores the raw extraction + confidence scores + user review state.
    """

    document = models.OneToOneField(
        OCRDocument,
        on_delete=models.CASCADE,
        related_name='result',
    )

    # Extracted fields — mirroring OCRExtractionResult dataclass
    supplier_name    = models.CharField(max_length=255, blank=True, default='')
    supplier_trn     = models.CharField(max_length=15,  blank=True, default='')
    supplier_address = models.TextField(blank=True, default='')

    customer_name    = models.CharField(max_length=255, blank=True, default='')
    customer_trn     = models.CharField(max_length=15,  blank=True, default='')
    customer_address = models.TextField(blank=True, default='')

    invoice_number   = models.CharField(max_length=100, blank=True, default='')
    invoice_type     = models.CharField(max_length=30,  blank=True, default='')
    issue_date       = models.DateField(null=True, blank=True)
    due_date         = models.DateField(null=True, blank=True)
    supply_date      = models.DateField(null=True, blank=True)

    currency         = models.CharField(max_length=3, default='AED')
    subtotal         = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    total_vat        = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    total_amount     = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    vat_rate         = models.DecimalField(max_digits=5,  decimal_places=2, null=True, blank=True)

    payment_terms    = models.CharField(max_length=200, blank=True, default='')
    purchase_order   = models.CharField(max_length=100, blank=True, default='')
    notes            = models.TextField(blank=True, default='')

    # Line items stored as JSON
    line_items_json  = models.JSONField(default=list)

    # Confidence scores (0.0–1.0)
    confidence_overall      = models.FloatField(default=0.0)
    confidence_supplier_trn = models.FloatField(default=0.0)
    confidence_customer_trn = models.FloatField(default=0.0)
    confidence_amounts      = models.FloatField(default=0.0)
    confidence_dates        = models.FloatField(default=0.0)
    confidence_line_items   = models.FloatField(default=0.0)

    warnings       = models.JSONField(default=list)
    provider_used  = models.CharField(max_length=30, blank=True, default='')
    raw_text_excerpt = models.TextField(blank=True, default='')

    # Review state
    is_reviewed    = models.BooleanField(default=False)
    reviewed_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_ocr_results',
    )
    reviewed_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ocr_results'
        indexes = [
            models.Index(fields=['confidence_overall'], name='idx_ocr_confidence'),
            models.Index(fields=['supplier_trn'],       name='idx_ocr_supplier_trn'),
        ]

    def __str__(self):
        return f'OCRResult:{self.document.original_name} conf={self.confidence_overall:.2f}'

    @property
    def needs_review(self) -> bool:
        return (
            self.confidence_overall < 0.7
            or self.confidence_supplier_trn < 0.8
            or self.confidence_amounts < 0.7
            or bool(self.warnings)
        )
