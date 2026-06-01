import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('companies', '__first__'),
        ('invoices',  '__first__'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OCRDocument',
            fields=[
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('id',           models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('is_active',    models.BooleanField(default=True)),
                ('file',         models.FileField(upload_to='ocr/documents/%Y/%m/%d/')),
                ('original_name', models.CharField(blank=True, max_length=255)),
                ('mime_type',    models.CharField(choices=[('application/pdf','PDF'),('image/png','PNG Image'),('image/jpeg','JPEG Image')], default='application/pdf', max_length=50)),
                ('file_size_bytes', models.PositiveIntegerField(default=0)),
                ('status',       models.CharField(choices=[('uploaded','Uploaded — awaiting processing'),('processing','Processing — AI extracting data'),('completed','Completed — data extracted'),('failed','Failed — extraction error'),('reviewed','Reviewed — user confirmed data')], db_index=True, default='uploaded', max_length=20)),
                ('error_detail', models.TextField(blank=True, default='')),
                ('processing_started_at',  models.DateTimeField(blank=True, null=True)),
                ('processing_finished_at', models.DateTimeField(blank=True, null=True)),
                ('company',      models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='ocr_documents', to='companies.company')),
                ('linked_invoice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ocr_source_documents', to='invoices.invoice')),
                ('uploaded_by',  models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ocr_documents', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'ocr_documents', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='OCRResult',
            fields=[
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('id',           models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('is_active',    models.BooleanField(default=True)),
                ('supplier_name',    models.CharField(blank=True, default='', max_length=255)),
                ('supplier_trn',     models.CharField(blank=True, default='', max_length=15)),
                ('supplier_address', models.TextField(blank=True, default='')),
                ('customer_name',    models.CharField(blank=True, default='', max_length=255)),
                ('customer_trn',     models.CharField(blank=True, default='', max_length=15)),
                ('customer_address', models.TextField(blank=True, default='')),
                ('invoice_number',   models.CharField(blank=True, default='', max_length=100)),
                ('invoice_type',     models.CharField(blank=True, default='', max_length=30)),
                ('issue_date',       models.DateField(blank=True, null=True)),
                ('due_date',         models.DateField(blank=True, null=True)),
                ('supply_date',      models.DateField(blank=True, null=True)),
                ('currency',         models.CharField(default='AED', max_length=3)),
                ('subtotal',         models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('total_vat',        models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('total_amount',     models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('vat_rate',         models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('payment_terms',    models.CharField(blank=True, default='', max_length=200)),
                ('purchase_order',   models.CharField(blank=True, default='', max_length=100)),
                ('notes',            models.TextField(blank=True, default='')),
                ('line_items_json',  models.JSONField(default=list)),
                ('confidence_overall',      models.FloatField(default=0.0)),
                ('confidence_supplier_trn', models.FloatField(default=0.0)),
                ('confidence_customer_trn', models.FloatField(default=0.0)),
                ('confidence_amounts',      models.FloatField(default=0.0)),
                ('confidence_dates',        models.FloatField(default=0.0)),
                ('confidence_line_items',   models.FloatField(default=0.0)),
                ('warnings',          models.JSONField(default=list)),
                ('provider_used',     models.CharField(blank=True, default='', max_length=30)),
                ('raw_text_excerpt',  models.TextField(blank=True, default='')),
                ('is_reviewed',       models.BooleanField(default=False)),
                ('reviewed_at',       models.DateTimeField(blank=True, null=True)),
                ('document',   models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='result', to='ai_ocr.ocrdocument')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_ocr_results', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'ocr_results'},
        ),
        migrations.AddIndex(
            model_name='ocrdocument',
            index=models.Index(fields=['company', 'status'], name='idx_ocr_doc_company_status'),
        ),
        migrations.AddIndex(
            model_name='ocrdocument',
            index=models.Index(fields=['uploaded_by', 'created_at'], name='idx_ocr_doc_user_ts'),
        ),
        migrations.AddIndex(
            model_name='ocrresult',
            index=models.Index(fields=['confidence_overall'], name='idx_ocr_confidence'),
        ),
        migrations.AddIndex(
            model_name='ocrresult',
            index=models.Index(fields=['supplier_trn'], name='idx_ocr_supplier_trn'),
        ),
    ]
