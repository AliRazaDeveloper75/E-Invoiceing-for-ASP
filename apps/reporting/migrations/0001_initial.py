import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Initial migration for the reporting app.
    - FATAuditFile: UAE VAT Audit File (FAF) under Federal Decree-Law No. 16
    - APIRequestLog: API access log for compliance, abuse detection, debugging
    """

    initial = True

    dependencies = [
        ('companies', '0001_initial'),
        ('invoices',  '0009_invoice_sequence_auditlog'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── FATAuditFile ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='FATAuditFile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('period_start', models.DateField(help_text='First day of the VAT reporting period.')),
                ('period_end',   models.DateField(help_text='Last day of the VAT reporting period.')),
                ('file', models.FileField(
                    blank=True,
                    null=True,
                    upload_to='reports/faf/%Y/%m/',
                    help_text='Generated FAF file (CSV/XML format per FTA spec).',
                )),
                ('file_format', models.CharField(
                    choices=[('csv', 'CSV'), ('xml', 'XML')],
                    default='csv',
                    max_length=10,
                )),
                ('status', models.CharField(
                    choices=[
                        ('generated', 'Generated — awaiting submission'),
                        ('submitted', 'Submitted to FTA'),
                        ('accepted',  'Accepted by FTA'),
                        ('rejected',  'Rejected by FTA — needs correction'),
                    ],
                    db_index=True,
                    default='generated',
                    max_length=20,
                )),
                ('fta_reference', models.CharField(
                    blank=True, default='', max_length=100,
                    help_text='FTA-assigned reference number on acceptance.',
                )),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('accepted_at',  models.DateTimeField(blank=True, null=True)),
                ('invoice_count',     models.PositiveIntegerField(default=0)),
                ('credit_note_count', models.PositiveIntegerField(default=0)),
                ('total_taxable_amount', models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ('total_vat_amount',     models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ('error_detail', models.TextField(blank=True, default='')),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='faf_files',
                    to='companies.company',
                )),
                ('generated_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='generated_fafs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'FTA Audit File (FAF)',
                'verbose_name_plural': 'FTA Audit Files (FAF)',
                'db_table': 'fta_audit_files',
                'ordering': ['-period_end'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='fatauditfile',
            unique_together={('company', 'period_start', 'period_end')},
        ),
        migrations.AddIndex(
            model_name='fatauditfile',
            index=models.Index(
                fields=['company', 'period_end'],
                name='idx_faf_company_period',
            ),
        ),
        migrations.AddIndex(
            model_name='fatauditfile',
            index=models.Index(
                fields=['status'],
                name='idx_faf_status',
            ),
        ),

        # ── APIRequestLog ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='APIRequestLog',
            fields=[
                ('id',           models.BigAutoField(primary_key=True, serialize=False)),
                ('method',       models.CharField(max_length=10)),
                ('path',         models.CharField(db_index=True, max_length=500)),
                ('query_string', models.CharField(blank=True, default='', max_length=1000)),
                ('request_id',   models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('status_code',  models.PositiveSmallIntegerField(db_index=True)),
                ('duration_ms',  models.PositiveIntegerField(default=0)),
                ('ip_address',   models.GenericIPAddressField(blank=True, db_index=True, null=True)),
                ('user_agent',   models.CharField(blank=True, default='', max_length=500)),
                ('error_detail', models.TextField(blank=True, default='')),
                ('timestamp',    models.DateTimeField(auto_now_add=True, db_index=True)),
                ('company', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='api_request_logs',
                    to='companies.company',
                )),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='api_request_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'API Request Log',
                'verbose_name_plural': 'API Request Logs',
                'db_table': 'api_request_logs',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='apirequestlog',
            index=models.Index(
                fields=['timestamp', 'status_code'],
                name='idx_apilog_ts_status',
            ),
        ),
        migrations.AddIndex(
            model_name='apirequestlog',
            index=models.Index(
                fields=['ip_address', 'timestamp'],
                name='idx_apilog_ip_ts',
            ),
        ),
        migrations.AddIndex(
            model_name='apirequestlog',
            index=models.Index(
                fields=['user', 'timestamp'],
                name='idx_apilog_user_ts',
            ),
        ),
    ]
