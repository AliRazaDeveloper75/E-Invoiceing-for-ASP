"""
Initial migration for ASPSubmissionLog.
Depends on: invoices.0001_initial
"""
import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('invoices', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ASPSubmissionLog',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4,
                    editable=False,
                    primary_key=True,
                    serialize=False,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('invoice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='submission_logs',
                    to='invoices.invoice',
                )),
                ('attempt_number', models.PositiveSmallIntegerField(
                    default=1,
                    help_text='Sequential attempt number (1 = first try, 2 = first retry, etc.)',
                )),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('accepted', 'Accepted'),
                        ('rejected', 'Rejected'),
                        ('error', 'Error'),
                    ],
                    db_index=True,
                    default='pending',
                    max_length=20,
                )),
                ('submission_id', models.CharField(
                    blank=True,
                    default='',
                    help_text='Transaction ID returned by ASP on acceptance.',
                    max_length=255,
                )),
                ('request_size_bytes', models.PositiveIntegerField(
                    default=0,
                    help_text='Size of the XML payload sent to the ASP.',
                )),
                ('response_payload', models.JSONField(
                    blank=True,
                    null=True,
                    help_text='Complete raw JSON response from the ASP.',
                )),
                ('error_message', models.TextField(
                    blank=True,
                    default='',
                    help_text='Error or rejection message from the ASP.',
                )),
                ('submitted_at', models.DateTimeField(
                    help_text='Timestamp when the request was sent to the ASP.',
                )),
            ],
            options={
                'verbose_name': 'ASP Submission Log',
                'verbose_name_plural': 'ASP Submission Logs',
                'db_table': 'asp_submission_logs',
                'ordering': ['-submitted_at'],
            },
        ),
        migrations.AddIndex(
            model_name='aspsubmissionlog',
            index=models.Index(
                fields=['invoice', 'status'],
                name='idx_asplog_invoice_status',
            ),
        ),
    ]
