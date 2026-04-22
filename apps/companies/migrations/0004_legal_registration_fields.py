from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0003_alter_companymember_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='legal_registration_id',
            field=models.CharField(
                max_length=100,
                blank=True,
                default='',
                help_text='Legal entity registration number (trade license, CR number, etc.).',
            ),
        ),
        migrations.AddField(
            model_name='company',
            name='legal_registration_type',
            field=models.CharField(
                max_length=5,
                choices=[
                    ('TL',  'Trade License (TL)'),
                    ('CRN', 'Commercial Registration Number (CRN)'),
                    ('EID', 'Emirates ID (EID)'),
                    ('PAS', 'Passport (PAS)'),
                    ('CD',  'Commercial Document (CD)'),
                ],
                blank=True,
                default='',
                help_text='Type of legal registration document (schemeID for UBL CompanyID).',
            ),
        ),
    ]
