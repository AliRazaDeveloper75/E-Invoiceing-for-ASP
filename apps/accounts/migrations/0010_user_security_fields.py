from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add security tracking fields to the User model:
    - email_verified_at: timestamp of email verification
    - last_password_changed: used to invalidate old JWTs
    - failed_login_count: consecutive failed login counter
    - locked_until: temporary account lockout
    """

    dependencies = [
        ('accounts', '0009_user_mfa_verified_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verified_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Timestamp of email verification. Null = not verified.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='last_password_changed',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Used to invalidate old JWTs after password change.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='failed_login_count',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='Consecutive failed login attempts (reset on success).',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='locked_until',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Account locked until this time after too many failed logins.',
            ),
        ),
    ]
