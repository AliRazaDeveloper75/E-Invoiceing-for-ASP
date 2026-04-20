"""
Initial migration for Invoice and InvoiceItem models.
Depends on: customers.0001_initial → companies.0001 → accounts.0001
"""
import uuid
from decimal import Decimal
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('customers', '0001_initial'),
        ('companies', '0001_initial'),
        settings.AUTH_USER_MODEL.split('.')[0] + '.0001_initial'
        if False else ('accounts', '0001_initial'),
    ]

    operations = [
        # ── Invoice ───────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('invoice_number', models.CharField(db_index=True, max_length=50, unique=True)),
                ('invoice_sequence', models.PositiveIntegerField(default=0)),
                ('invoice_type', models.CharField(
                    choices=[('tax_invoice','Tax Invoice'),('simplified','Simplified Invoice'),('credit_note','Credit Note')],
                    default='tax_invoice', max_length=20
                )),
                ('transaction_type', models.CharField(
                    choices=[('b2b','B2B'),('b2g','B2G'),('b2c','B2C')],
                    default='b2b', max_length=10
                )),
                ('status', models.CharField(
                    choices=[
                        ('draft','Draft'),('pending','Pending Submission'),
                        ('submitted','Submitted to ASP'),('validated','Validated by ASP'),
                        ('rejected','Rejected'),('cancelled','Cancelled'),('paid','Paid'),
                    ],
                    db_index=True, default='draft', max_length=20
                )),
                ('issue_date', models.DateField(default=django.utils.timezone.localdate)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('supply_date', models.DateField(blank=True, null=True)),
                ('currency', models.CharField(
                    choices=[('AED','UAE Dirham (AED)'),('USD','US Dollar (USD)'),('EUR','Euro (EUR)')],
                    default='AED', max_length=3
                )),
                ('exchange_rate', models.DecimalField(decimal_places=6, default=Decimal('1.000000'), max_digits=10)),
                ('subtotal', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('discount_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('taxable_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('total_vat', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('total_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('reference_number', models.CharField(blank=True, default='', max_length=100)),
                ('purchase_order_number', models.CharField(blank=True, default='', max_length=100)),
                ('xml_file', models.FileField(blank=True, null=True, upload_to='invoices/xml/%Y/%m/')),
                ('xml_generated_at', models.DateTimeField(blank=True, null=True)),
                ('asp_submission_id', models.CharField(blank=True, default='', max_length=255)),
                ('asp_submitted_at', models.DateTimeField(blank=True, null=True)),
                ('asp_response', models.JSONField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                    related_name='invoices', to='companies.company')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                    related_name='invoices', to='customers.customer')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_invoices', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'invoices', 'ordering': ['-issue_date', '-invoice_sequence']},
        ),
        migrations.AddIndex(model_name='invoice',
            index=models.Index(fields=['company', 'status'], name='idx_invoice_company_status')),
        migrations.AddIndex(model_name='invoice',
            index=models.Index(fields=['company', 'issue_date'], name='idx_invoice_company_date')),
        migrations.AddIndex(model_name='invoice',
            index=models.Index(fields=['company', 'customer'], name='idx_invoice_company_customer')),

        # ── InvoiceItem ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name='InvoiceItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('description', models.CharField(max_length=500)),
                ('quantity', models.DecimalField(decimal_places=4, max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))])),
                ('unit', models.CharField(blank=True, default='', max_length=20)),
                ('unit_price', models.DecimalField(decimal_places=4, max_digits=15,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))])),
                ('vat_rate_type', models.CharField(
                    choices=[('standard','Standard Rate (5%)'),('zero','Zero Rate (0%)'),
                             ('exempt','Exempt'),('out_of_scope','Out of Scope')],
                    default='standard', max_length=20
                )),
                ('vat_rate', models.DecimalField(decimal_places=2, default=Decimal('5.00'), max_digits=5)),
                ('subtotal', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('vat_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('total_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='items', to='invoices.invoice')),
            ],
            options={'db_table': 'invoice_items', 'ordering': ['sort_order', 'created_at']},
        ),
    ]
