"""
FTA reporting tasks — dedicated Celery tasks for Corner 5.

Why separate from invoice_tasks.py?
  The FTA relay can be independently slow or unavailable.
  Isolating FTA tasks means ASP pipeline failures and FTA failures
  are tracked, retried, and monitored independently.

Tasks:
  report_invoice_to_fta(invoice_id)   — report a single validated invoice to FTA
  retry_failed_fta_reports()          — periodic: re-queue failed FTA reports
"""
import logging

from celery import shared_task
from celery.utils.log import get_task_logger
from django.utils import timezone

logger = get_task_logger(__name__)


# ─── Single Invoice FTA Report ────────────────────────────────────────────────

@shared_task(
    bind=True,
    name='tasks.fta_tasks.report_invoice_to_fta',
    max_retries=5,
    queue='celery',
    acks_late=True,
    reject_on_worker_lost=True,
)
def report_invoice_to_fta(self, invoice_id: str) -> dict:
    """
    Report a validated invoice to the UAE FTA data platform (Corner 5).

    Retry strategy (exponential backoff):
      Attempt 1: immediate
      Attempt 2: 60s
      Attempt 3: 120s
      Attempt 4: 240s
      Attempt 5: 480s
      Attempt 6: 960s — then mark fta_status='error', stop retrying

    The invoice must be in status 'validated' or 'paid'.
    Non-existent or non-validated invoices are skipped (idempotent).
    """
    from apps.invoices.models import Invoice
    from apps.integrations.fta_service import FTAReportingService

    logger.info('FTA report task: invoice=%s attempt=%d', invoice_id, self.request.retries + 1)

    # Load invoice
    try:
        invoice = Invoice.objects.select_related('company').get(
            id=invoice_id,
            is_active=True,
        )
    except Invoice.DoesNotExist:
        logger.error('FTA report: invoice not found: %s', invoice_id)
        return {'status': 'error', 'reason': 'Invoice not found.'}

    # Only report validated/paid invoices
    if invoice.status not in ('validated', 'paid'):
        logger.warning(
            'FTA report skipped for %s — status is "%s" (need validated/paid).',
            invoice.invoice_number, invoice.status
        )
        return {'status': 'skipped', 'reason': f'Invoice status is "{invoice.status}".'}

    # Skip if already reported
    if invoice.fta_status == 'reported':
        logger.info(
            'FTA report skipped for %s — already reported (ref: %s).',
            invoice.invoice_number, invoice.fta_reference
        )
        return {'status': 'already_reported', 'fta_reference': invoice.fta_reference}

    # Read XML from file
    xml_bytes = _read_xml_bytes(invoice)

    # Submit to FTA
    try:
        FTAReportingService.report(invoice, xml_bytes)
        logger.info(
            'FTA report succeeded for %s — ref: %s',
            invoice.invoice_number, invoice.fta_reference
        )
        return {'status': 'reported', 'fta_reference': invoice.fta_reference}

    except Exception as exc:
        logger.error(
            'FTA report attempt %d failed for %s: %s',
            self.request.retries + 1, invoice.invoice_number, exc
        )

        # Exponential backoff: 60s × 2^retry
        countdown = 60 * (2 ** self.request.retries)

        if self.request.retries < self.max_retries:
            logger.info(
                'FTA retry #%d for %s in %ds.',
                self.request.retries + 2, invoice.invoice_number, countdown
            )
            raise self.retry(exc=exc, countdown=countdown)

        # Max retries exhausted — mark as error (notify ops)
        logger.error(
            'FTA reporting permanently failed for %s after %d attempts. '
            'Manual intervention required.',
            invoice.invoice_number, self.max_retries + 1
        )
        Invoice.objects.filter(pk=invoice.pk).update(
            fta_status='error',
            fta_reported_at=timezone.now(),
            updated_at=timezone.now(),
        )
        _send_fta_failure_alert(invoice, str(exc))
        return {'status': 'failed', 'error': str(exc)}


# ─── Periodic: Retry Failed FTA Reports ──────────────────────────────────────

@shared_task(
    name='tasks.fta_tasks.retry_failed_fta_reports',
    queue='celery',
)
def retry_failed_fta_reports() -> dict:
    """
    Periodic task (every 30 minutes via Celery Beat).

    Finds validated/paid invoices where fta_status='error' and re-queues them.
    This handles cases where the FTA relay was down for an extended period.
    """
    from datetime import timedelta
    from apps.invoices.models import Invoice

    # Re-queue errors older than 30 minutes (give time for transient failures to clear)
    retry_threshold = timezone.now() - timedelta(minutes=30)
    failed = Invoice.objects.filter(
        status__in=['validated', 'paid'],
        fta_status='error',
        fta_reported_at__lt=retry_threshold,
        is_active=True,
    )

    count = failed.count()
    if count == 0:
        logger.info('retry_failed_fta_reports: no failed FTA reports found.')
        return {'queued': 0}

    logger.warning('retry_failed_fta_reports: re-queuing %d failed FTA report(s).', count)

    queued = 0
    for invoice in failed:
        # Reset to pending before re-queue so the task doesn't skip it
        Invoice.objects.filter(pk=invoice.pk).update(fta_status='pending')

        report_invoice_to_fta.apply_async(
            args=[str(invoice.id)],
            queue='celery',
        )
        queued += 1
        logger.info('Re-queued FTA report: %s', invoice.invoice_number)

    return {'queued': queued}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _read_xml_bytes(invoice) -> bytes:
    """Read signed XML from media storage. Returns empty bytes if not available."""
    if not invoice.xml_file:
        logger.warning(
            'No XML file for invoice %s — FTA report will use live generation.',
            invoice.invoice_number
        )
        return b''

    try:
        invoice.xml_file.open('rb')
        xml_bytes = invoice.xml_file.read()
        invoice.xml_file.close()
        return xml_bytes
    except Exception as exc:
        logger.error(
            'Failed to read XML for invoice %s: %s',
            invoice.invoice_number, exc
        )
        return b''


def _send_fta_failure_alert(invoice, error_message: str) -> None:
    """
    Send an alert email to PEPPOL_ALERT_EMAILS when FTA reporting permanently fails.
    Requires EMAIL_BACKEND to be configured.
    """
    from django.conf import settings
    from django.core.mail import send_mail

    alert_emails = getattr(settings, 'PEPPOL_ALERT_EMAILS', [])
    if not alert_emails:
        return

    try:
        send_mail(
            subject=f'[UAE E-Invoicing] FTA Report Failed: {invoice.invoice_number}',
            message=(
                f'Invoice: {invoice.invoice_number}\n'
                f'Company: {invoice.company.name} (TRN: {invoice.company.trn})\n'
                f'Amount: {invoice.total_amount} {invoice.currency}\n'
                f'Error: {error_message}\n\n'
                f'Action required: manually resubmit via admin panel or '
                f'POST /api/v1/invoices/{invoice.id}/report-fta/'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=alert_emails,
            fail_silently=True,
        )
    except Exception as exc:
        logger.error('Failed to send FTA alert email: %s', exc)
