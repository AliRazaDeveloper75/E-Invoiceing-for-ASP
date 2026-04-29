"""
Payment model — records buyer payments against validated invoices.

Payment status is tracked on the Invoice side (paid / partially_paid).
This model is the audit trail of every payment event.
"""
from decimal import Decimal
from django.db import models
from apps.common.models import BaseModel


PAYMENT_METHOD_CHOICES = [
    ('bank_transfer', 'Bank Transfer'),
    ('cash',          'Cash'),
    ('cheque',        'Cheque'),
    ('card',          'Card'),
    ('online',        'Online Transfer'),
    ('other',         'Other'),
]


class Payment(BaseModel):
    """A single payment recorded against an invoice."""

    invoice = models.ForeignKey(
        'invoices.Invoice',
        on_delete=models.CASCADE,
        related_name='payments',
    )
    amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Amount paid in invoice currency.'
    )
    method = models.CharField(
        max_length=20, choices=PAYMENT_METHOD_CHOICES, default='bank_transfer'
    )
    payment_date = models.DateField(help_text='Date payment was made by the buyer.')
    reference = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Bank reference / transaction ID / cheque number.'
    )
    notes = models.CharField(max_length=500, blank=True, default='')
    recorded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_payments',
    )

    class Meta:
        db_table = 'payments'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f'{self.invoice.invoice_number} — {self.amount} ({self.method})'
