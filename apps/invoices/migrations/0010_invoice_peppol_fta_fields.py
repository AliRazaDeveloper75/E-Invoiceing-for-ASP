"""
Migration: add PEPPOL transmission and FTA reporting tracking fields to Invoice.

Fields added:
  peppol_status       — status of the PEPPOL AS4 transmission lifecycle
  peppol_message_id   — AS4 MessageId of the last successful transmission
  fta_status          — status of the FTA Corner 5 report
  fta_reference       — FTA-assigned reference number on acceptance
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0009_invoice_sequence_auditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='peppol_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('not_sent',   'Not Sent'),
                    ('queued',     'Queued'),
                    ('sent',       'Sent'),
                    ('delivered',  'Delivered (MDN received)'),
                    ('failed',     'Failed'),
                ],
                default='not_sent',
                max_length=20,
                db_index=True,
                help_text='PEPPOL AS4 transmission lifecycle status.',
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='peppol_message_id',
            field=models.CharField(
                blank=True,
                default='',
                max_length=255,
                help_text='AS4 MessageId of the last successful PEPPOL transmission.',
            ),
        ),
        # fta_status and fta_reference already added by 0003 — skipped here
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['peppol_status', 'fta_status'],
                name='idx_invoice_peppol_fta',
            ),
        ),
    ]
