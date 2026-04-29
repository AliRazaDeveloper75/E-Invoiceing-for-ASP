"""
Buyer Portal models.

BuyerProfile  — links a platform User (role=buyer) to a Customer record.
BuyerInvite   — pending invitation token sent by a supplier to a buyer email.

Invite flow:
  1. Supplier: POST /api/v1/buyers/invite/ → BuyerInvite created, email sent
  2. Buyer: clicks email link → /buyer/accept-invite?token=<uuid>
  3. Buyer: POST /api/v1/buyers/accept-invite/ → User + BuyerProfile created
"""
import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta

from apps.common.models import BaseModel


class BuyerInvite(models.Model):
    """Pending invitation for a buyer to join and access their invoices."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.UUIDField(
        default=uuid.uuid4, unique=True, db_index=True,
        help_text='Unique token sent in the invite email link.'
    )
    email = models.EmailField(
        db_index=True,
        help_text='Email address of the invited buyer.'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='buyer_invites',
        help_text='Customer record the buyer will be linked to.'
    )
    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_buyer_invites',
    )
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'buyer_invites'
        verbose_name = 'Buyer Invite'
        verbose_name_plural = 'Buyer Invites'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at

    def __str__(self):
        return f'Invite → {self.email} ({self.customer.name})'


class BuyerProfile(BaseModel):
    """Links a registered buyer User to one or more Customer records."""

    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='buyer_profile',
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='buyer_profiles',
        help_text='Customer record this buyer has access to.'
    )
    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_buyer_profiles',
    )

    class Meta:
        db_table = 'buyer_profiles'
        verbose_name = 'Buyer Profile'
        verbose_name_plural = 'Buyer Profiles'

    def __str__(self):
        return f'{self.user.email} → {self.customer.name}'
