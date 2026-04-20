"""
Initial migration for Company and CompanyMember models.
Depends on: accounts.0001_initial (for the User FK in CompanyMember)
"""
import uuid
import apps.companies.models
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        # ── Company ───────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Company',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('name', models.CharField(max_length=255)),
                ('legal_name', models.CharField(max_length=255)),
                ('trn', models.CharField(
                    max_length=15,
                    unique=True,
                    validators=[apps.companies.models.validate_trn],
                    help_text='UAE Tax Registration Number — 15 numeric digits.'
                )),
                ('tin', models.CharField(
                    db_index=True, editable=False, max_length=10,
                    help_text='Auto-derived: first 10 digits of TRN.'
                )),
                ('is_vat_group', models.BooleanField(default=False)),
                ('street_address', models.CharField(max_length=500)),
                ('city', models.CharField(max_length=100)),
                ('emirate', models.CharField(
                    choices=[
                        ('abu_dhabi', 'Abu Dhabi'),
                        ('dubai', 'Dubai'),
                        ('sharjah', 'Sharjah'),
                        ('ajman', 'Ajman'),
                        ('umm_al_quwain', 'Umm Al Quwain'),
                        ('ras_al_khaimah', 'Ras Al Khaimah'),
                        ('fujairah', 'Fujairah'),
                    ],
                    default='dubai', max_length=20
                )),
                ('po_box', models.CharField(blank=True, default='', max_length=20)),
                ('country', models.CharField(default='AE', max_length=2)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('email', models.EmailField(blank=True, default='')),
                ('website', models.URLField(blank=True, default='')),
                ('peppol_endpoint', models.CharField(blank=True, default='', max_length=255)),
            ],
            options={
                'verbose_name': 'Company',
                'verbose_name_plural': 'Companies',
                'db_table': 'companies',
                'ordering': ['name'],
            },
        ),

        # ── CompanyMember ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name='CompanyMember',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('role', models.CharField(
                    choices=[
                        ('admin', 'Admin'),
                        ('accountant', 'Accountant'),
                        ('viewer', 'Viewer'),
                    ],
                    default='admin', max_length=20,
                    help_text='Role within this specific company.'
                )),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='members',
                    to='companies.company'
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='company_memberships',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Company Member',
                'verbose_name_plural': 'Company Members',
                'db_table': 'company_members',
                'ordering': ['company__name', 'user__email'],
                'unique_together': {('company', 'user')},
            },
        ),
    ]
