from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0004_invoice_continuous_commercial_fields'),
    ]

    operations = [
        # ── Invoice: payment means code ───────────────────────────────────────
        migrations.AddField(
            model_name='invoice',
            name='payment_means_code',
            field=models.CharField(
                max_length=5,
                choices=[
                    ('10', 'Cash (10)'),
                    ('20', 'Cheque (20)'),
                    ('30', 'Credit Transfer (30)'),
                    ('48', 'Bank Card (48)'),
                    ('49', 'Direct Debit (49)'),
                    ('57', 'Standing Order (57)'),
                    ('58', 'SEPA Credit Transfer (58)'),
                ],
                default='30',
                help_text='UN/ECE UNCL 4461 payment means code. Mandatory in UBL PaymentMeans element.',
            ),
        ),

        # ── InvoiceItem: item name ────────────────────────────────────────────
        migrations.AddField(
            model_name='invoiceitem',
            name='item_name',
            field=models.CharField(
                max_length=150,
                blank=True,
                default='',
                help_text='Short product/service name (UBL Item/Name). Falls back to description[:80] if blank.',
            ),
        ),
    ]
