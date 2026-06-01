import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0011_remove_invoice_idx_invoice_peppol_fta_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InvoiceFraudAlert',
            fields=[
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
                ('id',          models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('is_active',   models.BooleanField(default=True)),
                ('risk_score',  models.FloatField(default=0.0)),
                ('risk_level',  models.CharField(
                    choices=[('low', 'Low Risk'), ('medium', 'Medium Risk — Review Required'), ('high', 'High Risk — Blocked')],
                    db_index=True, default='low', max_length=10,
                )),
                ('auto_action', models.CharField(
                    choices=[('none', 'No Action'), ('flag', 'Flagged for Review'), ('block', 'Blocked'), ('approve', 'Auto-Approved')],
                    default='none', max_length=10,
                )),
                ('flags_json',             models.JSONField(default=list)),
                ('duplicate_invoice_ids',  models.JSONField(default=list)),
                ('ai_explanation',         models.TextField(blank=True, default='')),
                ('is_resolved',            models.BooleanField(default=False)),
                ('resolved_at',            models.DateTimeField(blank=True, null=True)),
                ('resolution_note',        models.TextField(blank=True, default='')),
                ('analyzed_at',            models.DateTimeField(blank=True, null=True)),
                ('invoice',   models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='fraud_alert',
                    to='invoices.invoice',
                )),
                ('resolved_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='resolved_fraud_alerts',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'invoice_fraud_alerts', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='invoicefraudalert',
            index=models.Index(fields=['risk_level', 'is_resolved'], name='idx_fraud_risk_resolved'),
        ),
        migrations.AddIndex(
            model_name='invoicefraudalert',
            index=models.Index(fields=['invoice'], name='idx_fraud_invoice'),
        ),
    ]
