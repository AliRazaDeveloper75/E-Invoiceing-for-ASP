"""
Keep each Invoice's payment state in sync with its Payment records.

Whenever a Payment is created, updated, or deleted we recompute the invoice's
`amount_paid` (sum of active payments) and advance its status to
`partially_paid` / `paid`. This is the single source of truth for Accounts
Receivable, so every payment path (buyer portal, Stripe, supplier-recorded)
stays consistent.
"""
from decimal import Decimal

from django.db.models import Sum
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Payment


def recompute_invoice_payments(invoice):
    """Recalculate amount_paid + status for one invoice from its active payments."""
    if invoice is None:
        return
    paid = invoice.payments.filter(is_active=True).aggregate(
        s=Sum('amount'))['s'] or Decimal('0.00')
    total = invoice.total_amount or Decimal('0.00')

    fields = []
    if invoice.amount_paid != paid:
        invoice.amount_paid = paid
        fields.append('amount_paid')

    # Only advance status — never downgrade a draft/cancelled/deactivated invoice.
    if invoice.status not in ('draft', 'cancelled', 'deactivated'):
        new_status = invoice.status
        if total > 0 and paid >= total:
            new_status = 'paid'
        elif paid > 0:
            new_status = 'partially_paid'
        if new_status != invoice.status:
            invoice.status = new_status
            fields.append('status')

    if fields:
        fields.append('updated_at')
        invoice.save(update_fields=fields)


@receiver(post_save, sender=Payment)
def _payment_saved(sender, instance, **kwargs):
    recompute_invoice_payments(instance.invoice)


@receiver(post_delete, sender=Payment)
def _payment_deleted(sender, instance, **kwargs):
    recompute_invoice_payments(instance.invoice)
