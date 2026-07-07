"""
Signal-based notification triggers for events that map cleanly to model saves.

Invoice lifecycle events (validated / rejected / FTA reported / buyer viewed)
are triggered explicitly from the relevant views/services, not here, because
they are status *transitions* rather than row creations.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification
from .services import NotificationService

logger = logging.getLogger(__name__)


# ── Payment received ──────────────────────────────────────────────────────────
@receiver(post_save, sender='payments.Payment')
def on_payment_created(sender, instance, created, **kwargs):
    if not created:
        return
    invoice = getattr(instance, 'invoice', None)
    if invoice:
        NotificationService.payment_received(invoice, instance.amount)


# ── Fraud alert (high risk) ───────────────────────────────────────────────────
@receiver(post_save, sender='invoices.InvoiceFraudAlert')
def on_fraud_alert(sender, instance, created, **kwargs):
    # Notify on a flagged/high-risk alert (on creation or when it becomes flagged).
    risky = getattr(instance, 'is_flagged', False) or getattr(instance, 'risk_level', '') in ('high', 'critical')
    if not risky:
        return
    invoice = getattr(instance, 'invoice', None)
    if not invoice:
        return
    title = f'Fraud alert — {invoice.invoice_number}'
    msg = f'Risk level: {getattr(instance, "risk_level", "high")}. Please review.'
    NotificationService.notify(
        getattr(invoice, 'created_by', None),
        category=Notification.CAT_FRAUD, event='fraud_alert',
        title=title, message=msg, link=f'/fraud-alerts',
    )
    NotificationService.notify_admins(
        category=Notification.CAT_FRAUD, event='fraud_alert',
        title=title, message=msg, link='/fraud-alerts',
    )


# ── New contact message (admins) ──────────────────────────────────────────────
@receiver(post_save, sender='admin_panel.ContactMessage')
def on_contact_message(sender, instance, created, **kwargs):
    if not created:
        return
    NotificationService.notify_admins(
        category=Notification.CAT_ADMIN, event='contact_message',
        title='New contact message',
        message=f'{instance.first_name} {instance.last_name} ({instance.email})',
        link='/management',
    )


# ── New user registered (admins) ──────────────────────────────────────────────
@receiver(post_save, sender='accounts.User')
def on_user_created(sender, instance, created, **kwargs):
    if not created:
        return
    NotificationService.notify_admins(
        category=Notification.CAT_ADMIN, event='user_registered',
        title='New user registered',
        message=f'{instance.email} ({getattr(instance, "role", "")})',
        link='/management',
    )


# ── Company submitted for onboarding review (admins) ──────────────────────────
@receiver(post_save, sender='companies.Company')
def on_company_onboarding(sender, instance, created, **kwargs):
    # Only when a brand-new company arrives already awaiting review.
    if not created:
        return
    if getattr(instance, 'onboarding_status', '') != 'submitted':
        return
    NotificationService.notify_admins(
        category=Notification.CAT_ADMIN, event='onboarding_submitted',
        title='New company pending review',
        message=f'{instance.name} submitted for onboarding review.',
        link='/management',
    )
