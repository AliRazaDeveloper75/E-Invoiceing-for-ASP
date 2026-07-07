"""
In-app notifications.

A single lightweight table. Each row is one notification for one user. The bell
in the dashboard polls the list + unread count; clicking one marks it read and
navigates to `link`.
"""
import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    # ── Categories (for icon/colour on the frontend) ──────────────────────────
    CAT_INVOICE = 'invoice'
    CAT_PAYMENT = 'payment'
    CAT_FRAUD = 'fraud'
    CAT_ADMIN = 'admin'
    CATEGORY_CHOICES = [
        (CAT_INVOICE, 'Invoice'),
        (CAT_PAYMENT, 'Payment / Receivables'),
        (CAT_FRAUD, 'Fraud'),
        (CAT_ADMIN, 'Admin / Platform'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CAT_INVOICE)
    # A short machine key for the specific event, e.g. 'invoice_validated'.
    event = models.CharField(max_length=50, default='')
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True, default='')
    # Frontend path to open on click, e.g. '/invoices/<uuid>' or '/management'.
    link = models.CharField(max_length=300, blank=True, default='')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user_id} · {self.title}'
