from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='mfa_verified_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Last successful MFA verification. Login skips MFA if within 24 hours.',
            ),
        ),
    ]
