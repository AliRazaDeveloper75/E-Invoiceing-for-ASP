"""
AS4 PEPPOL transmission Celery tasks.

Tasks:
  transmit_invoice_via_as4(invoice_id)
    — Full AS4 pipeline: SMP lookup → envelope build → sign → MTOM → transmit
    — Retries with exponential backoff on transient failures
    — Writes PEPPOLMessage audit record on every attempt
    — Updates invoice.peppol_status field

  retry_failed_as4_transmissions()
    — Periodic: picks up FAILED or QUEUED PEPPOLMessages older than 5 min
    — Re-dispatches transmit_invoice_via_as4 for each

Queue: peppol_transmission
Beat schedule (defined in config/celery.py):
  retry_failed_as4_transmissions: every 15 minutes
"""
import logging

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


# ─── MLS (Message Level Status) Task ──────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    name='tasks.as4_tasks.send_mls_for_received',
    queue='peppol_transmission',
    acks_late=True,
)
def send_mls_for_received(self, sbd_b64: str, conversation_id: str = '',
                          ref_to_message_id: str = '') -> dict:
    """
    Generate and transmit a Peppol MLS (ApplicationResponse) for a received
    PINT-AE business document. ``sbd_b64`` is the base64-encoded received SBD.

    Runs out-of-band from the AS4 reception so the synchronous AS4 receipt is
    not delayed. The PINT-AE testbed waits up to 10 minutes for the MLS.
    """
    import base64
    from services.peppol.mls import send_mls_for_received as _send

    try:
        sbd = base64.b64decode(sbd_b64)
    except Exception as exc:
        logger.error('MLS task: bad base64 payload: %s', exc)
        return {'sent': False, 'error': 'bad payload'}

    result = _send(sbd, conversation_id=conversation_id,
                   ref_to_message_id=ref_to_message_id)
    if not result.sent and result.errors:
        logger.warning('MLS task: not sent (%s) — %s', result.response_code, result.errors)
        # Retry transient failures (e.g. SMP/endpoint hiccup).
        try:
            raise self.retry(countdown=60, exc=RuntimeError('; '.join(result.errors)))
        except self.MaxRetriesExceededError:
            pass
    return {
        'sent': result.sent,
        'response_code': result.response_code,
        'receiver': result.receiver,
        'endpoint': result.endpoint,
        'errors': result.errors,
    }


# ─── AS4 Transmission Task ────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=4,
    name='tasks.as4_tasks.transmit_invoice_via_as4',
    queue='peppol_transmission',
    acks_late=True,
    reject_on_worker_lost=True,
)
def transmit_invoice_via_as4(self, invoice_id: str, receiver_participant_id: str = '') -> dict:
    """
    Transmit a signed invoice XML to the receiver's PEPPOL Access Point via AS4.

    Pipeline:
      1. Load Invoice + validated signed XML
      2. Resolve receiver PEPPOL participant ID (from invoice or argument)
      3. SMP lookup → AS4 endpoint URL
      4. Create PEPPOLMessage record (status=queued)
      5. Call AS4Transport.send() — builds envelope, signs, MTOM, HTTP POST
      6. Handle result: update PEPPOLMessage + invoice.peppol_status
      7. Publish Prometheus metric

    Retry strategy (exponential backoff):
      Attempt 1 (immediate), 2 (60s), 3 (300s), 4 (900s), 5 → mark failed

    Args:
        invoice_id:              UUID string of the Invoice
        receiver_participant_id: PEPPOL ID of the buyer (0235:TRN). If empty,
                                 derived from invoice.customer.peppol_id
    """
    from django.utils import timezone
    from apps.invoices.models import Invoice
    from apps.integrations.models import PEPPOLMessage, SMPEndpointCache
    from services.as4.transport import AS4Transport
    from services.peppol.sandbox import PEPPOLEnvironmentManager
    from monitoring.prometheus import metrics

    try:
        invoice = Invoice.objects.select_related('company', 'customer').get(id=invoice_id)
    except Invoice.DoesNotExist:
        logger.error('transmit_invoice_via_as4: Invoice %s not found — aborting.', invoice_id)
        return {'success': False, 'error': 'Invoice not found'}

    # Resolve receiver PEPPOL ID
    if not receiver_participant_id:
        receiver_participant_id = _resolve_receiver_id(invoice)

    if not receiver_participant_id:
        logger.error(
            'transmit_invoice_via_as4: Cannot determine receiver PEPPOL ID for invoice %s',
            invoice_id,
        )
        _mark_invoice_peppol_failed(invoice, 'No receiver PEPPOL participant ID configured.')
        return {'success': False, 'error': 'Receiver participant ID unknown'}

    # Load the signed XML — stored as media file after invoice processing
    invoice_xml = _load_signed_xml(invoice)
    if not invoice_xml:
        logger.error('transmit_invoice_via_as4: No signed XML for invoice %s', invoice_id)
        _mark_invoice_peppol_failed(invoice, 'Signed XML not found.')
        return {'success': False, 'error': 'Signed XML not found'}

    # Validate environment (sandbox vs production)
    env_mgr = PEPPOLEnvironmentManager()
    config   = env_mgr.get_config()

    # Create audit record
    sender_id = config.sender_participant_id or f'0235:{getattr(invoice.company, "trn", "")}'

    peppol_msg = _create_peppol_message(invoice, sender_id, receiver_participant_id)

    logger.info(
        'AS4 transmit: invoice=%s sender=%s receiver=%s sandbox=%s',
        invoice.invoice_number, sender_id, receiver_participant_id, config.is_sandbox,
    )

    # Sandbox capture mode — skip actual transmission
    if config.sandbox_capture_mode:
        from services.peppol.sandbox import SandboxMessageCapture
        import uuid
        msg_id = str(uuid.uuid4())
        capture = SandboxMessageCapture()
        result  = capture.capture_outbound(
            sender_id, receiver_participant_id, invoice_xml, msg_id, invoice
        )
        _update_peppol_message_success(peppol_msg, msg_id, 'sandbox://capture')
        _mark_invoice_peppol_delivered(invoice)
        metrics.record_peppol_transmission(success=True, duration_ms=0)
        logger.info('AS4 sandbox capture: invoice=%s', invoice.invoice_number)
        return {'success': True, 'sandbox': True, **result}

    # Real AS4 transmission
    transport = AS4Transport()
    try:
        result = transport.send(
            receiver_participant_id=receiver_participant_id,
            invoice_xml=invoice_xml,
            sender_participant_id=sender_id,
        )
    except Exception as exc:
        logger.warning(
            'AS4 transmission exception for invoice %s (attempt %d): %s',
            invoice_id, self.request.retries + 1, exc,
        )
        _update_peppol_message_failed(peppol_msg, str(exc))
        backoff = _backoff(self.request.retries)
        raise self.retry(exc=exc, countdown=backoff)

    if result.success:
        _update_peppol_message_success(peppol_msg, result.message_id, result.endpoint_url if hasattr(result, 'endpoint_url') else '')
        _mark_invoice_peppol_sent(invoice, result.message_id)
        metrics.record_peppol_transmission(success=True, duration_ms=result.duration_ms)
        logger.info(
            'AS4 transmission success: invoice=%s message_id=%s duration=%dms',
            invoice.invoice_number, result.message_id, result.duration_ms,
        )
        return {
            'success':    True,
            'message_id': result.message_id,
            'receipt_id': result.receipt_id,
            'duration_ms': result.duration_ms,
        }
    else:
        _update_peppol_message_failed(peppol_msg, result.error_message)
        metrics.record_peppol_transmission(success=False, duration_ms=result.duration_ms)
        logger.warning(
            'AS4 transmission failed: invoice=%s error=%s (attempt %d)',
            invoice.invoice_number, result.error_message, self.request.retries + 1,
        )
        if self.request.retries < self.max_retries:
            backoff = _backoff(self.request.retries)
            raise self.retry(
                exc=Exception(result.error_message),
                countdown=backoff,
            )
        _mark_invoice_peppol_failed(invoice, result.error_message)
        return {'success': False, 'error': result.error_message}


# ─── Periodic Retry Task ──────────────────────────────────────────────────────

@shared_task(
    name='tasks.as4_tasks.retry_failed_as4_transmissions',
    queue='peppol_transmission',
    acks_late=True,
)
def retry_failed_as4_transmissions() -> dict:
    """
    Periodic task: re-queue PEPPOL messages that are stuck in failed/queued state.

    Targets:
      - PEPPOLMessages with status=failed and invoice.peppol_status != 'delivered'
      - PEPPOLMessages with status=queued older than 10 minutes (worker crash)

    Runs every 15 minutes via Celery Beat.
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.integrations.models import PEPPOLMessage

    cutoff_queued = timezone.now() - timedelta(minutes=10)
    cutoff_failed = timezone.now() - timedelta(minutes=30)

    stuck = PEPPOLMessage.objects.filter(
        direction=PEPPOLMessage.DIRECTION_OUTBOUND,
    ).filter(
        # Queued too long (worker lost) OR recently failed
        transmission_status__in=[
            PEPPOLMessage.TRANSMISSION_STATUS_QUEUED,
            PEPPOLMessage.TRANSMISSION_STATUS_FAILED,
        ]
    ).filter(
        created_at__lt=cutoff_queued,
    ).select_related('invoice').order_by('created_at')[:20]

    count = 0
    for msg in stuck:
        if not msg.invoice_id:
            continue
        # Check invoice hasn't been delivered by another PEPPOLMessage already
        invoice = msg.invoice
        from apps.integrations.models import PEPPOLMessage as _PM
        already_delivered = _PM.objects.filter(
            invoice=invoice,
            direction=_PM.DIRECTION_OUTBOUND,
            transmission_status=_PM.TRANSMISSION_STATUS_SENT,
        ).exclude(id=msg.id).exists()
        if already_delivered:
            continue

        logger.info(
            'Requeueing AS4 transmission for invoice=%s (message=%s status=%s)',
            getattr(invoice, 'invoice_number', '?'), msg.message_id, msg.transmission_status,
        )
        transmit_invoice_via_as4.apply_async(
            args=[str(invoice.id)],
            kwargs={'receiver_participant_id': msg.receiver_participant_id},
            countdown=5,
        )
        count += 1

    logger.info('retry_failed_as4_transmissions: requeued %d messages', count)
    return {'requeued': count}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_receiver_id(invoice) -> str:
    """Derive receiver PEPPOL participant ID from customer record."""
    customer = getattr(invoice, 'customer', None)
    if not customer:
        return ''
    # Check for explicit peppol_id field
    pid = getattr(customer, 'peppol_id', '') or ''
    if pid:
        return pid
    # Derive from TRN using UAE scheme 0235
    trn = getattr(customer, 'trn', '') or getattr(customer, 'vat_number', '') or ''
    if trn and trn.isdigit() and len(trn) == 15:
        return f'0235:{trn}'
    return ''


def _load_signed_xml(invoice) -> bytes:
    """Load the signed UBL XML file from invoice media storage."""
    try:
        xml_file = getattr(invoice, 'xml_file', None)
        if xml_file:
            xml_file.seek(0)
            return xml_file.read()
    except Exception as exc:
        logger.warning('Could not read invoice.xml_file: %s', exc)
    # Fallback: check xml_path field
    try:
        xml_path = getattr(invoice, 'xml_path', '') or ''
        if xml_path:
            import os
            from django.conf import settings
            full_path = os.path.join(settings.MEDIA_ROOT, xml_path.lstrip('/'))
            with open(full_path, 'rb') as f:
                return f.read()
    except Exception as exc:
        logger.warning('Could not read xml_path: %s', exc)
    return b''


def _create_peppol_message(invoice, sender_id: str, receiver_id: str):
    """Insert a PEPPOLMessage record in queued state."""
    from apps.integrations.models import PEPPOLMessage
    from services.as4.constants import PEPPOL_DOCTYPE_PINT_AE_INVOICE, PEPPOL_PROCESS_BIS30

    return PEPPOLMessage.objects.create(
        company=invoice.company,
        invoice=invoice,
        direction=PEPPOLMessage.DIRECTION_OUTBOUND,
        sender_participant_id=sender_id,
        receiver_participant_id=receiver_id,
        document_type_id=PEPPOL_DOCTYPE_PINT_AE_INVOICE,
        process_id=PEPPOL_PROCESS_BIS30,
        transmission_status=PEPPOLMessage.TRANSMISSION_STATUS_QUEUED,
    )


def _update_peppol_message_success(peppol_msg, message_id: str, endpoint_url: str) -> None:
    peppol_msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_SENT
    peppol_msg.as4_message_id      = message_id
    peppol_msg.as4_endpoint_url    = endpoint_url[:500] if endpoint_url else ''
    peppol_msg.save(update_fields=[
        'transmission_status', 'as4_message_id', 'as4_endpoint_url', 'updated_at'
    ])


def _update_peppol_message_failed(peppol_msg, error: str) -> None:
    peppol_msg.transmission_status = 'failed'
    peppol_msg.error_message        = error[:2000]
    peppol_msg.save(update_fields=['transmission_status', 'error_message', 'updated_at'])


def _mark_invoice_peppol_sent(invoice, message_id: str) -> None:
    # peppol_status/peppol_message_id were removed in migration 0011;
    # PEPPOL state is tracked exclusively via PEPPOLMessage records.
    logger.info('AS4 sent: invoice=%s message_id=%s', invoice.invoice_number, message_id)


def _mark_invoice_peppol_delivered(invoice) -> None:
    logger.info('AS4 delivered: invoice=%s', invoice.invoice_number)


def _mark_invoice_peppol_failed(invoice, error: str) -> None:
    logger.warning('AS4 failed: invoice=%s error=%s', invoice.invoice_number, error)


def _backoff(retry_count: int) -> int:
    """Exponential backoff in seconds: 60, 300, 900, 1800."""
    schedule = [60, 300, 900, 1800]
    return schedule[min(retry_count, len(schedule) - 1)]
