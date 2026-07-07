"""
Notification background tasks (Celery Beat).

  notify_receivable_reminders()  — daily: due-soon + overdue invoice reminders
"""
from datetime import timedelta

from celery import shared_task
from celery.utils.log import get_task_logger
from django.utils import timezone

logger = get_task_logger(__name__)

# Statuses that are NOT collectible receivables.
_EXCLUDED = ['draft', 'cancelled', 'deactivated', 'paid']
# How many days ahead counts as "due soon".
_DUE_SOON_DAYS = 3


@shared_task(name='tasks.notification_tasks.notify_receivable_reminders')
def notify_receivable_reminders():
    """
    Once a day: notify invoice creators about invoices that are due soon or
    overdue, so nothing slips through. One notification per invoice per run.
    """
    from apps.invoices.models import Invoice
    from apps.notifications.models import Notification
    from apps.notifications.services import NotificationService

    today = timezone.now().date()
    soon = today + timedelta(days=_DUE_SOON_DAYS)

    qs = (Invoice.objects.filter(is_active=True, due_date__isnull=False)
          .exclude(status__in=_EXCLUDED)
          .select_related('created_by'))

    due_soon = qs.filter(due_date__gte=today, due_date__lte=soon)
    overdue = qs.filter(due_date__lt=today)

    made = 0
    for inv in due_soon:
        # Only if it still has an outstanding balance.
        if (inv.total_amount or 0) - (inv.amount_paid or 0) <= 0:
            continue
        NotificationService.notify(
            inv.created_by,
            category=Notification.CAT_PAYMENT, event='invoice_due_soon',
            title=f'Invoice due soon — {inv.invoice_number}',
            message=f'Due on {inv.due_date}. Balance {inv.currency} {inv.balance_due}.',
            link=f'/invoices/{inv.id}',
        )
        made += 1

    for inv in overdue:
        if (inv.total_amount or 0) - (inv.amount_paid or 0) <= 0:
            continue
        NotificationService.notify(
            inv.created_by,
            category=Notification.CAT_PAYMENT, event='invoice_overdue',
            title=f'Invoice overdue — {inv.invoice_number}',
            message=f'Was due on {inv.due_date}. Balance {inv.currency} {inv.balance_due}.',
            link=f'/invoices/{inv.id}',
        )
        made += 1

    logger.info('Receivable reminders: %s notifications created.', made)
    return made


@shared_task(name='tasks.notification_tasks.cleanup_old_notifications')
def cleanup_old_notifications():
    """
    Delete notifications older than 1 day — they are only valid for a day
    ("next day remove"). Keeps the table small and the bell relevant.
    """
    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(days=1)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff).delete()
    logger.info('Notification cleanup: deleted %s old notifications.', deleted)
    return deleted
