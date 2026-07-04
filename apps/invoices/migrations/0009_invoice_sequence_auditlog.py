import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Invoice compliance improvements:
    1. Add invoice_sequence field for per-company consecutive numbering
    2. Change invoice_number uniqueness from global to per-company (UAE Article 70)
    3. Add InvoiceAuditLog table (UAE Federal Decree-Law No. 16, Article 65)
    """

    dependencies = [
        ('invoices', '0008_buyer_viewed_at'),
        ('accounts', '0010_user_security_fields'),
    ]

    operations = [
        # invoice_sequence already exists from 0001_initial — no AddField needed

        # ── Step 2: Remove global unique constraint on invoice_number ─────────
        # PostgreSQL: use dynamic SQL to drop the constraint regardless of its name.
        # SQLite: Django's AlterUniqueTogether (Step 3) recreates the table and
        # handles constraint changes automatically — no raw SQL needed.
        migrations.RunSQL(
            sql=migrations.RunSQL.noop,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.AlterUniqueTogether(
                    name='invoice',
                    unique_together=set(),
                ),
            ],
        ),

        # ── Step 3: Add per-company unique constraint ──────────────────────────
        migrations.AlterUniqueTogether(
            name='invoice',
            unique_together={('company', 'invoice_number')},
        ),

        # ── Step 4: Add performance index on company + invoice_sequence ────────
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['company', 'invoice_sequence'],
                name='idx_invoice_company_seq',
            ),
        ),

        # ── Step 5: Create InvoiceAuditLog ────────────────────────────────────
        migrations.CreateModel(
            name='InvoiceAuditLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('action', models.CharField(
                    choices=[
                        ('created',      'Invoice Created'),
                        ('updated',      'Invoice Updated'),
                        ('submitted',    'Submitted for Processing'),
                        ('validated',    'Validated by ASP'),
                        ('rejected',     'Rejected'),
                        ('cancelled',    'Cancelled'),
                        ('paid',         'Marked Paid'),
                        ('xml_generated','XML Generated'),
                        ('asp_sent',     'Sent to ASP'),
                        ('fta_reported', 'Reported to FTA'),
                        ('item_added',   'Item Added'),
                        ('item_updated', 'Item Updated'),
                        ('item_removed', 'Item Removed'),
                        ('deleted',      'Invoice Deleted'),
                    ],
                    db_index=True,
                    max_length=30,
                )),
                ('performed_by_email', models.EmailField(
                    blank=True,
                    default='',
                    help_text='Denormalized email for historical accuracy after user deletion.',
                    max_length=254,
                )),
                ('field_name',  models.CharField(blank=True, default='', max_length=100)),
                ('old_value',   models.TextField(blank=True, default='')),
                ('new_value',   models.TextField(blank=True, default='')),
                ('description', models.TextField(blank=True, default='')),
                ('metadata',    models.JSONField(blank=True, null=True)),
                ('ip_address',  models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent',  models.CharField(blank=True, default='', max_length=500)),
                ('request_id',  models.CharField(blank=True, default='', max_length=64)),
                ('timestamp',   models.DateTimeField(auto_now_add=True, db_index=True)),
                ('invoice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs',
                    to='invoices.invoice',
                )),
                ('performed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='invoice_audit_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Invoice Audit Log',
                'verbose_name_plural': 'Invoice Audit Logs',
                'db_table': 'invoice_audit_logs',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='invoiceauditlog',
            index=models.Index(
                fields=['invoice', 'timestamp'],
                name='idx_auditlog_invoice_ts',
            ),
        ),
        migrations.AddIndex(
            model_name='invoiceauditlog',
            index=models.Index(
                fields=['invoice', 'action'],
                name='idx_auditlog_invoice_action',
            ),
        ),
        migrations.AddIndex(
            model_name='invoiceauditlog',
            index=models.Index(
                fields=['performed_by', 'timestamp'],
                name='idx_auditlog_user_ts',
            ),
        ),
    ]
