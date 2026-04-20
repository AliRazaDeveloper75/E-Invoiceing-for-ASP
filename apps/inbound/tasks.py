"""
Celery tasks for inbound invoice processing.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue='invoice_processing',
    max_retries=3,
    default_retry_delay=30,
    name='tasks.inbound.validate_inbound_invoice',
)
def validate_inbound_invoice(self, invoice_id: str):
    """
    Run validation engine on an inbound invoice.
    Triggered immediately after reception.
    """
    from .models import InboundInvoice
    from .services import InboundInvoiceService

    try:
        invoice = InboundInvoice.objects.get(pk=invoice_id)
    except InboundInvoice.DoesNotExist:
        logger.error('validate_inbound_invoice: invoice %s not found', invoice_id)
        return

    try:
        result = InboundInvoiceService.run_validation(invoice)
        logger.info(
            'Validated inbound invoice %s: score=%s critical=%s findings=%s',
            invoice.supplier_invoice_number,
            result.score,
            result.critical_count,
            len(result.findings),
        )
    except Exception as exc:
        logger.exception('Error validating inbound invoice %s', invoice_id)
        raise self.retry(exc=exc)
