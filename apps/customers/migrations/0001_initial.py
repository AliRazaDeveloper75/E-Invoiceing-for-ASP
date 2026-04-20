"""
Initial migration for Customer model.
Depends on: companies.0001_initial (for Company FK)
"""
import uuid
import apps.customers.models
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('companies', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Customer',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False,
                    primary_key=True, serialize=False
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('name', models.CharField(max_length=255)),
                ('legal_name', models.CharField(blank=True, default='', max_length=255)),
                ('customer_type', models.CharField(
                    choices=[
                        ('b2b', 'B2B'),
                        ('b2g', 'B2G'),
                        ('b2c', 'B2C'),
                    ],
                    db_index=True, default='b2b', max_length=10
                )),
                ('trn', models.CharField(
                    blank=True, default='', max_length=15,
                    validators=[apps.customers.models.validate_trn],
                )),
                ('tin', models.CharField(
                    blank=True, db_index=True, default='',
                    editable=False, max_length=10
                )),
                ('vat_number', models.CharField(
                    blank=True, default='', max_length=20,
                    validators=[apps.customers.models.validate_vat_number],
                )),
                ('peppol_endpoint', models.CharField(blank=True, default='', max_length=255)),
                ('street_address', models.CharField(blank=True, default='', max_length=500)),
                ('city', models.CharField(blank=True, default='', max_length=100)),
                ('state_province', models.CharField(blank=True, default='', max_length=100)),
                ('postal_code', models.CharField(blank=True, default='', max_length=20)),
                ('country', models.CharField(default='AE', max_length=2)),
                ('email', models.EmailField(blank=True, default='')),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('notes', models.TextField(blank=True, default='')),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='customers',
                    to='companies.company'
                )),
            ],
            options={
                'verbose_name': 'Customer',
                'verbose_name_plural': 'Customers',
                'db_table': 'customers',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='customer',
            index=models.Index(
                fields=['company', 'tin'],
                name='idx_customer_company_tin'
            ),
        ),
        migrations.AddIndex(
            model_name='customer',
            index=models.Index(
                fields=['company', 'customer_type'],
                name='idx_customer_company_type'
            ),
        ),
    ]
