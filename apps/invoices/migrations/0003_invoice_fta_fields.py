from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0002_alter_invoice_options_alter_invoiceitem_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='fta_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('pending', 'Pending Reporting'),
                    ('reported', 'Reported to FTA'),
                    ('error', 'Reporting Error'),
                ],
                db_index=True,
                help_text='FTA reporting status (Corner 5 in PEPPOL 5-corner model).',
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='fta_reference',
            field=models.CharField(
                blank=True,
                default='',
                help_text='FTA-assigned reference number after successful reporting.',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='fta_reported_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Timestamp when invoice data was reported to FTA data platform.',
            ),
        ),
    ]
