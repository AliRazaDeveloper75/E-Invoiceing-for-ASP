"""
Async invoice processing tasks — Celery workers consume from RabbitMQ.

Pipeline triggered when an invoice is submitted (status → PENDING):

  process_invoice(invoice_id)
    ├── 1. Load & lock invoice
    ├── 2. Validate (InvoiceValidationService)
    ├── 3. Generate XML (UAEInvoiceXMLGenerator)
    ├── 4. Save XML to media storage
    ├── 5. Transmit to ASP (ASPIntegrationService)
    └── 6. Update invoice status

Periodic tasks (Celery Beat):
  retry_failed_transmissions()  — every 15 min: retry PENDING stuck invoices
  poll_submitted_invoices()     — every 5 min: poll ASP for SUBMITTED status
"""
import logging
import os
import uuid
from io import BytesIO
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


# ─── Main Pipeline ────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name='tasks.invoice_tasks.process_invoice',
    queue='invoice_processing',
    acks_late=True,          # Acknowledge only after task completes (prevents message loss)
    reject_on_worker_lost=True,
)
def process_invoice(self, invoice_id: str) -> dict:
    """
    Full async pipeline: validate → generate XML → submit to ASP → update status.

    Called immediately when InvoiceService.submit_invoice() sets status to PENDING.

    Retry strategy (exponential backoff):
      Attempt 1 (immediate)
      Attempt 2 after 60s
      Attempt 3 after 120s
      Attempt 4 after 240s — then mark as error, stop retrying

    Args:
        invoice_id: UUID string of the Invoice to process

    Returns:
        dict with processing result for logging/monitoring
    """
    from apps.invoices.models import Invoice
    from apps.invoices.services import InvoiceService, VATCalculationService
    from apps.integrations.asp.services import ASPIntegrationService
    from services.validation_service import InvoiceValidationService
    from services.xml_generator import UAEInvoiceXMLGenerator

    logger.info('Processing invoice: %s (attempt %d)', invoice_id, self.request.retries + 1)

    # ── Step 1: Load invoice ──────────────────────────────────────────────────
    try:
        invoice = Invoice.objects.select_related('company', 'customer').get(
            id=invoice_id
        )
    except Invoice.DoesNotExist:
        logger.error('Invoice not found: %s — task aborted.', invoice_id)
        return {'status': 'error', 'reason': 'Invoice not found.'}

    # Guard: only process PENDING invoices
    if invoice.status != 'pending':
        logger.warning(
            'Invoice %s is not in PENDING status (current: %s) — skipping.',
            invoice.invoice_number, invoice.status
        )
        return {'status': 'skipped', 'reason': f'Status is "{invoice.status}", not "pending".'}

    # ── Step 2: Validate ──────────────────────────────────────────────────────
    logger.info('Validating invoice: %s', invoice.invoice_number)

    try:
        validation = InvoiceValidationService().validate(invoice)
    except Exception as exc:
        logger.exception('Validation service crashed for %s', invoice.invoice_number)
        raise self.retry(exc=exc, countdown=_backoff(self.request.retries))

    if not validation.is_valid:
        logger.warning(
            'Invoice %s failed validation: %s',
            invoice.invoice_number, validation.errors
        )
        InvoiceService.mark_rejected(invoice, {
            'source':   'validation',
            'errors':   validation.errors,
            'warnings': validation.warnings,
        })
        return {
            'status':   'rejected',
            'reason':   'Validation failed',
            'errors':   validation.errors,
        }

    # Log warnings even if valid
    if validation.warnings:
        logger.warning(
            'Invoice %s has validation warnings: %s',
            invoice.invoice_number, validation.warnings
        )

    # ── Step 3: Generate XML ──────────────────────────────────────────────────
    logger.info('Generating XML for invoice: %s', invoice.invoice_number)

    try:
        # Ensure totals are current before generating XML
        VATCalculationService.recalculate_invoice_totals(invoice)
        invoice.refresh_from_db()

        generator = UAEInvoiceXMLGenerator()
        xml_bytes = generator.generate(invoice)

    except Exception as exc:
        logger.exception('XML generation failed for %s', invoice.invoice_number)
        raise self.retry(exc=exc, countdown=_backoff(self.request.retries))

    # ── Step 4: Save XML to media storage ─────────────────────────────────────
    logger.info('Saving XML file for invoice: %s', invoice.invoice_number)

    try:
        xml_filename = _build_xml_filename(invoice)
        invoice.xml_file.save(xml_filename, ContentFile(xml_bytes), save=False)
        invoice.xml_generated_at = timezone.now()
        invoice.save(update_fields=['xml_file', 'xml_generated_at', 'updated_at'])
        logger.info('XML saved: %s', invoice.xml_file.name)

    except Exception as exc:
        logger.exception('XML file save failed for %s', invoice.invoice_number)
        raise self.retry(exc=exc, countdown=_backoff(self.request.retries))

    # ── Step 5: Submit to ASP ─────────────────────────────────────────────────
    logger.info('Submitting invoice %s to ASP', invoice.invoice_number)

    try:
        asp_response = ASPIntegrationService.transmit(invoice, xml_bytes)

    except Exception as exc:
        logger.exception('ASP transmission error for %s', invoice.invoice_number)
        raise self.retry(exc=exc, countdown=_backoff(self.request.retries))

    # ── Step 6: Update status from ASP response ───────────────────────────────
    if asp_response.is_accepted:
        InvoiceService.mark_submitted_to_asp(invoice, asp_response.submission_id)
        logger.info(
            'Invoice %s submitted to ASP. Submission ID: %s',
            invoice.invoice_number, asp_response.submission_id
        )

        # Some ASPs respond synchronously (immediate validation)
        if asp_response.status == 'accepted':
            InvoiceService.mark_validated(invoice, asp_response.raw)
            logger.info('Invoice %s immediately validated by ASP.', invoice.invoice_number)

            # ── Step 7: Report to FTA (Corner 5) ─────────────────────────────
            _report_to_fta(invoice, xml_bytes)

            return {'status': 'validated', 'submission_id': asp_response.submission_id}

        # Async ASP: status is 'pending' — poll later via poll_submitted_invoices
        return {'status': 'submitted', 'submission_id': asp_response.submission_id}

    elif asp_response.is_rejected:
        InvoiceService.mark_rejected(invoice, {
            'source':   'asp',
            'message':  asp_response.message,
            'errors':   asp_response.errors,
            'raw':      asp_response.raw,
        })
        logger.warning(
            'Invoice %s rejected by ASP: %s',
            invoice.invoice_number, asp_response.message
        )
        return {'status': 'rejected', 'reason': asp_response.message}

    else:
        # status='error' — transient failure, should retry
        exc = RuntimeError(f'ASP returned error: {asp_response.message}')
        raise self.retry(exc=exc, countdown=_backoff(self.request.retries))


# ─── Periodic: Retry Stuck PENDING Invoices ───────────────────────────────────

@shared_task(
    name='tasks.invoice_tasks.retry_failed_transmissions',
    queue='invoice_processing',
)
def retry_failed_transmissions() -> dict:
    """
    Periodic task (every 15 minutes via Celery Beat).

    Finds invoices that have been stuck in PENDING for more than 10 minutes
    and re-queues them for processing.

    Covers: task worker crashes, RabbitMQ restarts, etc.
    """
    from django.utils import timezone
    from datetime import timedelta
    from apps.invoices.models import Invoice

    stuck_threshold = timezone.now() - timedelta(minutes=10)
    stuck_invoices  = Invoice.objects.filter(
        status='pending',
        updated_at__lt=stuck_threshold,
        is_active=True,
    )

    count = stuck_invoices.count()
    if count == 0:
        logger.info('retry_failed_transmissions: no stuck invoices.')
        return {'queued': 0}

    logger.warning('retry_failed_transmissions: found %d stuck invoice(s). Re-queuing.', count)

    queued = 0
    for invoice in stuck_invoices:
        process_invoice.apply_async(
            args=[str(invoice.id)],
            queue='invoice_processing',
        )
        queued += 1
        logger.info('Re-queued invoice: %s', invoice.invoice_number)

    return {'queued': queued}


# ─── Periodic: Poll ASP for SUBMITTED Invoice Status ─────────────────────────

@shared_task(
    name='tasks.invoice_tasks.poll_submitted_invoices',
    queue='invoice_processing',
)
def poll_submitted_invoices() -> dict:
    """
    Periodic task (every 5 minutes via Celery Beat).

    For invoices in SUBMITTED status, polls the ASP to check if they
    have been validated or rejected.

    Handles ASPs that use async validation (not immediate response).
    """
    from datetime import timedelta
    from apps.invoices.models import Invoice
    from apps.invoices.services import InvoiceService
    from apps.integrations.asp.services import ASPIntegrationService

    # Only poll invoices submitted more than 2 minutes ago (allow ASP processing time)
    poll_threshold = timezone.now() - timedelta(minutes=2)
    submitted = Invoice.objects.filter(
        status='submitted',
        asp_submitted_at__lt=poll_threshold,
        asp_submission_id__gt='',  # Must have a submission ID
        is_active=True,
    )

    validated_count = 0
    rejected_count  = 0
    still_pending   = 0

    for invoice in submitted:
        try:
            response = ASPIntegrationService.check_submission_status(invoice)

            if response.is_accepted:
                InvoiceService.mark_validated(invoice, response.raw)
                validated_count += 1
                logger.info('Invoice %s validated via polling.', invoice.invoice_number)

                # Corner 5: Report to FTA after polling validation
                # xml_bytes are no longer in memory here — read from file
                _report_to_fta_from_file(invoice)

            elif response.is_rejected:
                InvoiceService.mark_rejected(invoice, response.raw)
                rejected_count += 1
                logger.warning('Invoice %s rejected via polling.', invoice.invoice_number)

            else:
                still_pending += 1

        except Exception as exc:
            logger.error('Polling failed for invoice %s: %s', invoice.invoice_number, exc)

    result = {
        'validated':     validated_count,
        'rejected':      rejected_count,
        'still_pending': still_pending,
    }
    logger.info('poll_submitted_invoices: %s', result)
    return result


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _report_to_fta(invoice, xml_bytes: bytes) -> None:
    """
    Corner 5: Report validated invoice to FTA data platform.
    Failures are non-fatal — logged but do not affect invoice status.
    """
    from apps.integrations.fta_service import FTAReportingService
    try:
        FTAReportingService.report(invoice, xml_bytes)
    except Exception as exc:
        logger.error(
            'FTA reporting failed for invoice %s (non-fatal): %s',
            invoice.invoice_number, exc
        )


def _report_to_fta_from_file(invoice) -> None:
    """
    Corner 5: Read XML from stored file and report to FTA.
    Used by the polling task where xml_bytes are no longer in memory.
    """
    if not invoice.xml_file:
        logger.warning(
            'Cannot report invoice %s to FTA — no XML file on record.',
            invoice.invoice_number
        )
        return

    try:
        invoice.xml_file.open('rb')
        xml_bytes = invoice.xml_file.read()
        invoice.xml_file.close()
        _report_to_fta(invoice, xml_bytes)
    except Exception as exc:
        logger.error(
            'Failed to read XML for FTA reporting of invoice %s: %s',
            invoice.invoice_number, exc
        )


def _backoff(retries: int) -> int:
    """Exponential backoff: 60s, 120s, 240s."""
    return 60 * (2 ** retries)


def _build_xml_filename(invoice) -> str:
    """
    Build the XML storage filename.
    Format: {company_trn}/{YYYY}/{MM}/{invoice_number}.xml
    Stored under MEDIA_ROOT/invoices/xml/ (per upload_to on xml_file field).
    """
    return f'{invoice.company.trn}/{invoice.invoice_number}.xml'
