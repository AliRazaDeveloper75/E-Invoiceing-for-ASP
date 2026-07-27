"""
Chat lead capture — public marketing-site visitors who start an AI chat.

Captured once per browser session before the visitor can chat (name, email,
UAE phone), so marketing/sales can follow up. No account or login is created.
"""
from django.core.validators import RegexValidator
from django.db import models

from apps.common.models import BaseModel


class ChatLead(BaseModel):
    """A public-site visitor who registered to use the AI chat widget."""

    name = models.CharField(max_length=60)
    email = models.EmailField()
    phone = models.CharField(
        max_length=20,
        validators=[RegexValidator(r'^\+971[0-9]{8,9}$', 'Enter a valid UAE phone number.')],
        help_text='UAE number in +971XXXXXXXXX format.',
    )
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_leads'
        verbose_name = 'Chat Lead'
        verbose_name_plural = 'Chat Leads'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} <{self.email}>'
