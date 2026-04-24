import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_password_reset_token'),
    ]

    operations = [
        # ── MFA fields on User ────────────────────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='mfa_enabled',
            field=models.BooleanField(default=False,
                                      help_text='True when TOTP-based MFA is active.'),
        ),
        migrations.AddField(
            model_name='user',
            name='mfa_secret',
            field=models.CharField(blank=True, default='', max_length=64,
                                   help_text='Base32 TOTP secret.'),
        ),

        # ── MFALoginToken model ───────────────────────────────────────────────
        migrations.CreateModel(
            name='MFALoginToken',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False,
                                        primary_key=True, serialize=False)),
                ('token', models.UUIDField(db_index=True, default=uuid.uuid4, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('used', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mfa_login_tokens',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'accounts_mfa_login_tokens'},
        ),
    ]
