"""
Initial migration for custom User model.
Generated manually — run: python manage.py migrate
"""
import uuid
import django.utils.timezone
from django.db import migrations, models
import django.contrib.auth.models
import django.contrib.auth.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('is_superuser', models.BooleanField(
                    default=False,
                    help_text='Designates that this user has all permissions without explicitly assigning them.',
                    verbose_name='superuser status'
                )),
                ('id', models.UUIDField(
                    default=uuid.uuid4,
                    editable=False,
                    primary_key=True,
                    serialize=False
                )),
                ('email', models.EmailField(
                    db_index=True,
                    help_text='Primary login identifier.',
                    max_length=254,
                    unique=True
                )),
                ('first_name', models.CharField(max_length=150)),
                ('last_name', models.CharField(max_length=150)),
                ('role', models.CharField(
                    choices=[
                        ('admin', 'Admin'),
                        ('accountant', 'Accountant'),
                        ('viewer', 'Viewer'),
                    ],
                    db_index=True,
                    default='viewer',
                    help_text='Platform-level default role.',
                    max_length=20
                )),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(
                    default=False,
                    help_text='Grants access to the Django admin site.'
                )),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now)),
                ('last_login', models.DateTimeField(blank=True, null=True)),
                ('groups', models.ManyToManyField(
                    blank=True,
                    help_text='The groups this user belongs to.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups'
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    help_text='Specific permissions for this user.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions'
                )),
            ],
            options={
                'verbose_name': 'User',
                'verbose_name_plural': 'Users',
                'db_table': 'accounts_users',
                'ordering': ['-date_joined'],
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),
    ]
