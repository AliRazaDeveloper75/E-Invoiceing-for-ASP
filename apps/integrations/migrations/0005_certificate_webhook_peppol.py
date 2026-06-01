import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add three new integration models:
    - CertificateRecord: PKI certificate management (PEPPOL signing, FTA auth)
    - WebhookEndpoint: company-configured outbound webhook receivers
    - PEPPOLMessage: full audit trail of PEPPOL network messages
    """

    dependencies = [
        ('integrations', '0004_smpendpointcache'),
        ('companies', '0001_initial'),
        ('invoices', '0009_invoice_sequence_auditlog'),
    ]

    operations = [

        # ── CertificateRecord ──────────────────────────────────────────────────
        migrations.CreateModel(
            name='CertificateRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True, db_index=True)),
                ('cert_type', models.CharField(
                    choices=[
                        ('peppol_signing', 'PEPPOL Signing Certificate'),
                        ('fta_auth',       'FTA Authentication Certificate'),
                        ('tls_client',     'TLS Client Certificate'),
                    ],
                    db_index=True,
                    default='peppol_signing',
                    max_length=20,
                )),
                ('common_name',   models.CharField(max_length=255, help_text='Certificate CN field.')),
                ('serial_number', models.CharField(max_length=100, unique=True, help_text='X.509 serial number (hex).')),
                ('issued_by',     models.CharField(max_length=255, help_text='Issuer CN.')),
                ('issued_at',     models.DateTimeField()),
                ('expires_at',    models.DateTimeField(db_index=True)),
                ('fingerprint_sha256', models.CharField(
                    blank=True, default='', max_length=64,
                    help_text='SHA-256 fingerprint of the DER-encoded certificate.',
                )),
                ('key_storage', models.CharField(
                    choices=[
                        ('filesystem', 'Filesystem (dev only)'),
                        ('kms',        'AWS KMS / Azure Key Vault'),
                        ('hsm',        'Hardware Security Module'),
                        ('vault',      'HashiCorp Vault'),
                    ],
                    default='filesystem',
                    max_length=20,
                )),
                ('key_reference', models.CharField(
                    blank=True, default='', max_length=500,
                    help_text='Filesystem: path to private key. KMS: key ARN. Vault: secret path.',
                )),
                ('cert_path', models.CharField(
                    blank=True, default='', max_length=500,
                    help_text='Path to the certificate file (PEM/DER).',
                )),
                ('revoked_at',         models.DateTimeField(blank=True, null=True)),
                ('revocation_reason',  models.TextField(blank=True, default='')),
                ('company', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='certificates',
                    to='companies.company',
                    help_text='Null = platform-level cert shared across all companies.',
                )),
            ],
            options={
                'verbose_name': 'Certificate Record',
                'verbose_name_plural': 'Certificate Records',
                'db_table': 'certificate_records',
                'ordering': ['-expires_at'],
            },
        ),
        migrations.AddIndex(
            model_name='certificaterecord',
            index=models.Index(
                fields=['cert_type', 'is_active', 'expires_at'],
                name='idx_cert_type_active_expiry',
            ),
        ),

        # ── WebhookEndpoint ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='WebhookEndpoint',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(
                    max_length=100,
                    help_text='Human-readable name (e.g. "ERP System").',
                )),
                ('url', models.URLField(max_length=500, help_text='HTTPS URL to POST events to.')),
                ('secret', models.CharField(
                    max_length=128,
                    help_text='HMAC-SHA256 secret. Used to sign payloads.',
                )),
                ('events', models.JSONField(
                    default=list,
                    help_text='List of event types to deliver.',
                )),
                ('is_active', models.BooleanField(default=True, db_index=True)),
                ('last_triggered_at', models.DateTimeField(blank=True, null=True)),
                ('failure_count', models.PositiveSmallIntegerField(
                    default=0,
                    help_text='Consecutive delivery failures. Auto-disabled at 10.',
                )),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='webhook_endpoints',
                    to='companies.company',
                )),
            ],
            options={
                'verbose_name': 'Webhook Endpoint',
                'verbose_name_plural': 'Webhook Endpoints',
                'db_table': 'webhook_endpoints',
                'ordering': ['company__name', 'name'],
            },
        ),

        # ── PEPPOLMessage ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='PEPPOLMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('direction', models.CharField(
                    choices=[
                        ('outbound', 'Outbound (Supplier → Buyer)'),
                        ('inbound',  'Inbound (Buyer → Supplier)'),
                    ],
                    db_index=True,
                    max_length=10,
                )),
                ('message_id', models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)),
                ('sender_participant_id',   models.CharField(max_length=200)),
                ('receiver_participant_id', models.CharField(max_length=200)),
                ('document_type_id', models.CharField(max_length=500)),
                ('process_id',       models.CharField(blank=True, default='', max_length=500)),
                ('transmission_status', models.CharField(
                    choices=[
                        ('queued',       'Queued'),
                        ('sent',         'Sent'),
                        ('delivered',    'Delivered'),
                        ('failed',       'Failed'),
                        ('mdn_received', 'MDN Received'),
                    ],
                    db_index=True,
                    default='queued',
                    max_length=20,
                )),
                ('as4_message_id',   models.CharField(blank=True, default='', max_length=255)),
                ('as4_endpoint_url', models.URLField(blank=True, default='', max_length=500)),
                ('mdn_received_at',  models.DateTimeField(blank=True, null=True)),
                ('mdn_status',       models.CharField(blank=True, default='', max_length=50)),
                ('raw_payload_hash', models.CharField(
                    blank=True, default='', max_length=64,
                    help_text='SHA-256 hex digest of the transmitted XML payload.',
                )),
                ('payload_size_bytes', models.PositiveIntegerField(default=0)),
                ('error_message',    models.TextField(blank=True, default='')),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='peppol_messages',
                    to='companies.company',
                )),
                ('invoice', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='peppol_messages',
                    to='invoices.invoice',
                )),
            ],
            options={
                'verbose_name': 'PEPPOL Message',
                'verbose_name_plural': 'PEPPOL Messages',
                'db_table': 'peppol_messages',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='peppolmessage',
            index=models.Index(
                fields=['company', 'direction', 'created_at'],
                name='idx_peppol_company_dir',
            ),
        ),
        migrations.AddIndex(
            model_name='peppolmessage',
            index=models.Index(
                fields=['invoice', 'direction'],
                name='idx_peppol_invoice',
            ),
        ),
        migrations.AddIndex(
            model_name='peppolmessage',
            index=models.Index(
                fields=['transmission_status'],
                name='idx_peppol_status',
            ),
        ),
    ]
