"""
Notification creation service. Keep all "who gets notified" logic here so the
call sites (views / signals / tasks) stay one-liners.
"""
import logging

from django.contrib.auth import get_user_model

from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


class NotificationService:

    @staticmethod
    def notify(user, *, category, event, title, message='', link=''):
        """Create a single notification for one user. Never raises."""
        if not user:
            return None
        try:
            return Notification.objects.create(
                user=user, category=category, event=event,
                title=title, message=message, link=link,
            )
        except Exception as exc:  # notifications must never break the main flow
            logger.warning('Notification create failed (%s): %s', event, exc)
            return None

    @staticmethod
    def notify_admins(*, category, event, title, message='', link=''):
        """Notify every active platform admin."""
        admins = User.objects.filter(role='admin', is_active=True)
        objs = [
            Notification(user=u, category=category, event=event,
                         title=title, message=message, link=link)
            for u in admins
        ]
        if objs:
            try:
                Notification.objects.bulk_create(objs)
            except Exception as exc:
                logger.warning('Admin notification create failed (%s): %s', event, exc)

    # ── Domain helpers ────────────────────────────────────────────────────────

    @staticmethod
    def invoice_event(invoice, *, event, title, message=''):
        """Notify the user who created the invoice."""
        NotificationService.notify(
            getattr(invoice, 'created_by', None),
            category=Notification.CAT_INVOICE,
            event=event, title=title, message=message,
            link=f'/invoices/{invoice.id}',
        )

    @staticmethod
    def payment_received(invoice, amount):
        NotificationService.notify(
            getattr(invoice, 'created_by', None),
            category=Notification.CAT_PAYMENT,
            event='payment_received',
            title=f'Payment received — {invoice.invoice_number}',
            message=f'{invoice.currency} {amount} recorded against {invoice.invoice_number}.',
            link=f'/invoices/{invoice.id}',
        )
