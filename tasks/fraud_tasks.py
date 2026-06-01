"""
Fraud Detection Celery Tasks.

analyze_invoice_fraud(invoice_id)
  — Run full fraud analysis on a single invoice, persist InvoiceFraudAlert.

scan_recent_invoices()
  — Periodic task: analyse all invoices created in the last 24 h that have
    no alert yet (or whose alert is stale). Runs every hour via beat.

Queue: fraud_analysis
"""
import logging
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(
    bind=True,
    name='tasks.fraud_tasks.analyze_invoice_fraud',
    max_retries=2,
    queue='fraud_analysis',
    acks_late=True,
    reject_on_worker_lost=True,
)
def analyze_invoice_fraud(self, invoice_id: str) -> dict:
    """
    Run AI fraud analysis on a single invoice and persist the result.

    Steps:
      1. Load Invoice from DB
      2. Run FraudService.analyze()
      3. Persist / update InvoiceFraudAlert
      4. Auto-apply action (flag/block) if risk is high
    """
    from django.utils import timezone
    from apps.invoices.models import Invoice, InvoiceFraudAlert
    from services.ai.fraud_service import FraudService

    try:
        invoice = Invoice.objects.select_related('company', 'customer').get(
            id=invoice_id, is_active=True
        )
    except Invoice.DoesNotExist:
        logger.error('Fraud task: invoice %s not found', invoice_id)
        return {'success': False, 'error': 'Invoice not found'}

    service = FraudService()
    try:
        result = service.analyze(invoice)
    except Exception as exc:
        logger.error('Fraud analysis raised exception for invoice %s: %s', invoice_id, exc)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30)
        return {'success': False, 'error': str(exc)}

    # Persist result
    defaults = {
        'risk_score':             result.risk_score,
        'risk_level':             result.risk_level,
        'auto_action':            result.auto_action,
        'flags_json':             [
            {
                'code':        f.code,
                'description': f.description,
                'severity':    round(f.severity, 4),
                'category':    f.category,
            }
            for f in result.flags
        ],
        'duplicate_invoice_ids':  result.duplicate_invoice_ids,
        'ai_explanation':         result.ai_explanation or '',
        'analyzed_at':            timezone.now(),
    }

    alert, created = InvoiceFraudAlert.objects.update_or_create(
        invoice=invoice,
        defaults=defaults,
    )

    logger.info(
        'Fraud analysis complete: invoice=%s risk=%s (%.2f) action=%s flags=%d',
        invoice.invoice_number, result.risk_level, result.risk_score,
        result.auto_action, len(result.flags),
    )

    return {
        'success':      True,
        'invoice_id':   invoice_id,
        'risk_score':   result.risk_score,
        'risk_level':   result.risk_level,
        'auto_action':  result.auto_action,
        'flags_count':  len(result.flags),
        'alert_created': created,
    }


@shared_task(
    name='tasks.fraud_tasks.scan_recent_invoices',
    queue='fraud_analysis',
    ignore_result=True,
)
def scan_recent_invoices() -> None:
    """
    Periodic task: scan invoices from the last 24 h that are missing a
    fraud alert (or have a stale alert older than 12 h). Enqueues individual
    analyze_invoice_fraud tasks instead of running in-process to keep this
    task fast and non-blocking.

    Intended schedule: every hour via Celery beat.
    """
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models import Q
    from apps.invoices.models import Invoice

    cutoff = timezone.now() - timedelta(hours=24)
    stale_cutoff = timezone.now() - timedelta(hours=12)

    invoices = Invoice.objects.filter(
        is_active=True,
        created_at__gte=cutoff,
    ).filter(
        Q(fraud_alert__isnull=True) |
        Q(fraud_alert__analyzed_at__lt=stale_cutoff)
    ).values_list('id', flat=True)[:500]

    ids = list(invoices)
    for invoice_id in ids:
        analyze_invoice_fraud.apply_async(
            args=[str(invoice_id)],
            queue='fraud_analysis',
            countdown=2,
        )

    logger.info('Fraud scan: queued %d invoices for analysis', len(ids))
