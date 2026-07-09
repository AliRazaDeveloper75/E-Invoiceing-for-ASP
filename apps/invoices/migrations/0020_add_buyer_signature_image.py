# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0019_add_form_payload_to_invoice'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='buyer_signature_image',
            field=models.TextField(blank=True, default='', help_text='Base64-encoded PNG image of the buyer drawn signature.'),
        ),
    ]
