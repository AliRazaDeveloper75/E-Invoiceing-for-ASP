import django.db.models.deletion
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0002_alter_aspsubmissionlog_response_payload'),
        ('invoices', '0003_invoice_fta_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='FTASubmissionLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('invoice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='fta_logs',
                    to='invoices.invoice',
                )),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending Reporting'),
                        ('reported', 'Reported to FTA'),
                        ('error', 'Reporting Error'),
                    ],
                    db_index=True,
                    default='pending',
                    max_length=20,
                )),
                ('fta_reference', models.CharField(
                    blank=True,
                    default='',
                    help_text='Reference number assigned by the FTA data platform on acceptance.',
                    max_length=255,
                )),
                ('response_payload', models.JSONField(
                    blank=True,
                    null=True,
                    help_text='Raw JSON response from the FTA relay endpoint.',
                )),
                ('error_message', models.TextField(
                    blank=True,
                    default='',
                    help_text='Error details if the FTA report was rejected.',
                )),
                ('reported_at', models.DateTimeField(
                    help_text='Timestamp when the report was sent to the FTA data platform.',
                )),
            ],
            options={
                'verbose_name': 'FTA Submission Log',
                'verbose_name_plural': 'FTA Submission Logs',
                'db_table': 'fta_submission_logs',
                'ordering': ['-reported_at'],
            },
        ),
        migrations.AddIndex(
            model_name='ftasubmissionlog',
            index=models.Index(
                fields=['invoice', 'status'],
                name='idx_ftalog_invoice_status',
            ),
        ),
    ]
