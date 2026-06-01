import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('companies', '0007_company_onboarding_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CompanyInvitation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('token', models.UUIDField(db_index=True, default=uuid.uuid4, unique=True)),
                ('email', models.EmailField(db_index=True)),
                ('first_name', models.CharField(blank=True, default='', max_length=150)),
                ('last_name', models.CharField(blank=True, default='', max_length=150)),
                ('company_name_hint', models.CharField(blank=True, default='', max_length=255)),
                ('role', models.CharField(default='supplier', max_length=20)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'), ('accepted', 'Accepted'),
                        ('expired', 'Expired'), ('revoked', 'Revoked'),
                    ],
                    db_index=True, default='pending', max_length=20,
                )),
                ('expires_at', models.DateTimeField()),
                ('message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('invited_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sent_company_invitations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'company_invitations', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='OnboardingDocument',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('document_type', models.CharField(
                    choices=[
                        ('trade_license', 'Trade License'),
                        ('trn_certificate', 'TRN Certificate'),
                        ('vat_certificate', 'VAT Certificate'),
                        ('memorandum', 'Memorandum of Association'),
                        ('other', 'Other'),
                    ],
                    default='other', max_length=30,
                )),
                ('file', models.FileField(upload_to='onboarding_documents/%Y/%m/')),
                ('file_name', models.CharField(blank=True, default='', max_length=255)),
                ('notes', models.TextField(blank=True, default='')),
                ('verified', models.BooleanField(default=False)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='onboarding_documents',
                    to='companies.company',
                )),
                ('uploaded_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='uploaded_onboarding_docs',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('verified_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='verified_onboarding_docs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'onboarding_documents', 'ordering': ['-created_at']},
        ),
    ]
