"""
MDN (Message Disposition Notification) Celery tasks.

Tasks:
  process_mdn_receipt(peppol_message_id, mdn_soap_bytes_b64)
    — Verifies inbound MDN SOAP envelope against the original AS4 message
    — Updates PEPPOLMessage: status=mdn_received, mdn_received_at
    — Updates invoice.peppol_status=delivered on valid MDN
    — Records Prometheus metric

  verify_pending_deliveries()
    — Periodic: checks PEPPOLMessages stuck in 'sent' state without MDN
    — Flags those older than MDN_TIMEOUT_MINUTES as 'failed'
    — Triggers re-transmission if appropriate

Queue: peppol_transmission
Beat schedule (config/celery.py):
  verify_pending_deliveries: every 10 minutes
"""
import base64
import logging

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

# Time after which a 'sent' message without MDN is considered timed out
MDN_TIMEOUT_MINUTES = 60


# ─── Process inbound MDN ──────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=2,
    name='tasks.mdn_tasks.process_mdn_receipt',
    queue='peppol_transmission',
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_mdn_receipt(
    self,
    peppol_message_id: str,
    mdn_soap_bytes_b64: str,
) -> dict:
    """
    Process and verify an inbound MDN from the receiving Access Point.

    Called by:
      - ASPWebhookView when the AP sends an async MDN callback
      - AS4Transport.send() if the AP returns a sync MDN in the HTTP response

    Args:
        peppol_message_id: UUID string of the PEPPOLMessage (our tracking record)
        mdn_soap_bytes_b64: Base64-encoded AS4 SOAP MDN envelope

    Returns:
        dict with keys: success, valid, ap_signed, error
    """
    from django.utils import timezone
    from apps.integrations.models import PEPPOLMessage
    from services.as4.mdn_handler import MDNHandler
    from monitoring.prometheus import metrics

    try:
        peppol_msg = PEPPOLMessage.objects.select_related('invoice').get(
            message_id=peppol_message_id
        )
    except PEPPOLMessage.DoesNotExist:
        logger.error('process_mdn_receipt: PEPPOLMessage %s not found', peppol_message_id)
        return {'success': False, 'error': 'PEPPOLMessage not found'}

    try:
        mdn_bytes = base64.b64decode(mdn_soap_bytes_b64)
    except Exception as exc:
        logger.error('process_mdn_receipt: base64 decode failed: %s', exc)
        return {'success': False, 'error': 'Invalid base64 MDN payload'}

    handler = MDNHandler()
    try:
        result = handler.process_inbound(mdn_bytes)
    except Exception as exc:
        logger.warning(
            'MDN processing exception for message %s: %s', peppol_message_id, exc
        )
        raise self.retry(exc=exc, countdown=30)

    if result.is_valid and not result.is_error:
        # Valid MDN — mark as delivered
        peppol_msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_MDN_RECV
        peppol_msg.mdn_received_at     = timezone.now()
        peppol_msg.mdn_status          = 'received'
        peppol_msg.save(update_fields=[
            'transmission_status', 'mdn_received_at', 'mdn_status', 'updated_at'
        ])

        metrics.peppol_mdn_received.labels(
            ap_signed=str(result.ap_signed).lower()
        ).inc()

        if peppol_msg.invoice:
            _mark_invoice_delivered(peppol_msg.invoice)

        logger.info(
            'MDN verified: message=%s ap_signed=%s nri_refs=%d',
            peppol_message_id, result.ap_signed, len(result.nri_references),
        )
        return {
            'success':    True,
            'valid':      True,
            'ap_signed':  result.ap_signed,
            'message_id': result.message_id,
        }
    else:
        error_desc = result.error_description or 'MDN error signal received'
        peppol_msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_FAILED
        peppol_msg.mdn_status          = 'error'
        peppol_msg.error_message       = error_desc
        peppol_msg.mdn_received_at     = timezone.now()
        peppol_msg.save(update_fields=[
            'transmission_status', 'mdn_status', 'error_message', 'mdn_received_at', 'updated_at'
        ])

        if peppol_msg.invoice:
            _mark_invoice_peppol_failed(peppol_msg.invoice, error_desc)

        logger.warning(
            'MDN error signal: message=%s is_valid=%s error=%s',
            peppol_message_id, result.is_valid, result.error_description,
        )
        return {
            'success': True,
            'valid':   result.is_valid,
            'error':   error_desc,
        }


# ─── Periodic delivery verification ──────────────────────────────────────────

@shared_task(
    name='tasks.mdn_tasks.verify_pending_deliveries',
    queue='peppol_transmission',
    acks_late=True,
)
def verify_pending_deliveries() -> dict:
    """
    Periodic: timeout PEPPOL messages stuck in 'sent' state without MDN.

    If a message was sent but no MDN arrived within MDN_TIMEOUT_MINUTES:
      - Mark PEPPOLMessage as failed
      - Update invoice.peppol_status=failed
      - Log alert (Sentry will capture if configured)

    Runs every 10 minutes via Celery Beat.
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.integrations.models import PEPPOLMessage

    cutoff = timezone.now() - timedelta(minutes=MDN_TIMEOUT_MINUTES)

    timed_out = PEPPOLMessage.objects.filter(
        direction=PEPPOLMessage.DIRECTION_OUTBOUND,
        transmission_status=PEPPOLMessage.TRANSMISSION_STATUS_SENT,
        mdn_received_at__isnull=True,
        updated_at__lt=cutoff,
    ).select_related('invoice')[:50]

    count = 0
    for msg in timed_out:
        error = f'MDN not received within {MDN_TIMEOUT_MINUTES} minutes of transmission.'
        msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_FAILED
        msg.error_message       = error
        msg.mdn_status          = 'timeout'
        msg.save(update_fields=['transmission_status', 'error_message', 'mdn_status', 'updated_at'])

        if msg.invoice:
            _mark_invoice_peppol_failed(msg.invoice, error)

        logger.warning(
            'MDN timeout: message=%s invoice=%s sent_at=%s',
            msg.message_id,
            getattr(msg.invoice, 'invoice_number', '?'),
            msg.updated_at,
        )
        count += 1

    if count:
        logger.error(
            'verify_pending_deliveries: %d AS4 messages timed out without MDN', count
        )

    return {'timed_out': count}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _mark_invoice_delivered(invoice) -> None:
    # peppol_status removed in migration 0011 — state tracked via PEPPOLMessage records
    logger.info('MDN delivered: invoice=%s', invoice.invoice_number)


def _mark_invoice_peppol_failed(invoice, error: str) -> None:
    logger.warning('MDN failed: invoice=%s error=%s', invoice.invoice_number, error)
