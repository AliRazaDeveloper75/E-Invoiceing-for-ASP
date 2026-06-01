"""
OCR Celery Tasks.

process_ocr_document(document_id)
  — Full OCR pipeline: load file → AI extraction → persist result → update status

Queue: ocr_processing
"""
import logging
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(
    bind=True,
    name='tasks.ocr_tasks.process_ocr_document',
    max_retries=2,
    queue='ocr_processing',
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_ocr_document(self, document_id: str) -> dict:
    """
    Run the AI OCR pipeline on an uploaded document.

    Steps:
      1. Load OCRDocument from DB
      2. Read file bytes from storage
      3. Call OCRService.extract()
      4. Persist OCRResult
      5. Update document status

    Retry on transient failures (network, rate limits) with 30s backoff.
    """
    from django.utils import timezone
    from apps.ai_ocr.models import OCRDocument, OCRResult
    from services.ai.ocr_service import OCRService

    # Load document
    try:
        doc = OCRDocument.objects.get(id=document_id, is_active=True)
    except OCRDocument.DoesNotExist:
        logger.error('OCR task: document %s not found', document_id)
        return {'success': False, 'error': 'Document not found'}

    # Mark as processing
    doc.status = OCRDocument.STATUS_PROCESSING
    doc.processing_started_at = timezone.now()
    doc.save(update_fields=['status', 'processing_started_at', 'updated_at'])

    # Read file bytes
    try:
        doc.file.seek(0)
        file_bytes = doc.file.read()
    except Exception as exc:
        logger.error('OCR task: cannot read file for doc %s: %s', document_id, exc)
        doc.status       = OCRDocument.STATUS_FAILED
        doc.error_detail = f'File read error: {exc}'
        doc.processing_finished_at = timezone.now()
        doc.save(update_fields=['status', 'error_detail', 'processing_finished_at', 'updated_at'])
        return {'success': False, 'error': str(exc)}

    # Run OCR extraction
    service = OCRService()
    try:
        result = service.extract(
            file_bytes=file_bytes,
            mime_type=doc.mime_type,
            filename=doc.original_name,
        )
    except Exception as exc:
        logger.error('OCR extraction raised exception for doc %s: %s', document_id, exc)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30)
        doc.status       = OCRDocument.STATUS_FAILED
        doc.error_detail = f'AI extraction error: {exc}'
        doc.processing_finished_at = timezone.now()
        doc.save(update_fields=['status', 'error_detail', 'processing_finished_at', 'updated_at'])
        return {'success': False, 'error': str(exc)}

    if result.error:
        doc.status       = OCRDocument.STATUS_FAILED
        doc.error_detail = result.error
        doc.processing_finished_at = timezone.now()
        doc.save(update_fields=['status', 'error_detail', 'processing_finished_at', 'updated_at'])
        return {'success': False, 'error': result.error}

    # Persist OCRResult
    _persist_result(doc, result)

    doc.status = OCRDocument.STATUS_COMPLETED
    doc.processing_finished_at = timezone.now()
    doc.save(update_fields=['status', 'processing_finished_at', 'updated_at'])

    logger.info(
        'OCR complete: doc=%s confidence=%.2f warnings=%d provider=%s',
        document_id, result.confidence.overall, len(result.warnings), result.provider_used,
    )

    return {
        'success':    True,
        'document_id': document_id,
        'confidence': result.confidence.overall,
        'needs_review': result.needs_review,
        'warnings':   result.warnings,
    }


def _persist_result(doc, result) -> None:
    """Write OCRResult to the database, updating if it already exists."""
    from decimal import Decimal
    from apps.ai_ocr.models import OCRResult

    def to_decimal(val):
        if val is None:
            return None
        try:
            return Decimal(str(round(val, 4)))
        except Exception:
            return None

    defaults = {
        'supplier_name':    result.supplier_name or '',
        'supplier_trn':     result.supplier_trn or '',
        'supplier_address': result.supplier_address or '',
        'customer_name':    result.customer_name or '',
        'customer_trn':     result.customer_trn or '',
        'customer_address': result.customer_address or '',
        'invoice_number':   result.invoice_number or '',
        'invoice_type':     result.invoice_type or '',
        'issue_date':       result.issue_date or None,
        'due_date':         result.due_date or None,
        'supply_date':      result.supply_date or None,
        'currency':         result.currency or 'AED',
        'subtotal':         to_decimal(result.subtotal),
        'total_vat':        to_decimal(result.total_vat),
        'total_amount':     to_decimal(result.total_amount),
        'vat_rate':         to_decimal(result.vat_rate),
        'payment_terms':    result.payment_terms or '',
        'purchase_order':   result.purchase_order or '',
        'notes':            result.notes or '',
        'line_items_json':  [
            {
                'description':  li.description,
                'quantity':     li.quantity,
                'unit':         li.unit,
                'unit_price':   li.unit_price,
                'vat_rate_pct': li.vat_rate_pct,
                'line_total':   li.line_total,
            }
            for li in result.line_items
        ],
        'confidence_overall':      result.confidence.overall,
        'confidence_supplier_trn': result.confidence.supplier_trn,
        'confidence_customer_trn': result.confidence.customer_trn,
        'confidence_amounts':      result.confidence.amounts,
        'confidence_dates':        result.confidence.dates,
        'confidence_line_items':   result.confidence.line_items,
        'warnings':       result.warnings,
        'provider_used':  result.provider_used,
        'raw_text_excerpt': result.raw_text[:2000] if result.raw_text else '',
    }

    OCRResult.objects.update_or_create(document=doc, defaults=defaults)
