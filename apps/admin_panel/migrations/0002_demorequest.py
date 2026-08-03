# Generated manually for DemoRequest model

import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DemoRequest',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('is_active', models.BooleanField(default=True)),
                ('full_name', models.CharField(max_length=200)),
                ('email', models.EmailField(max_length=254)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('company', models.CharField(max_length=200)),
                ('message', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('new', 'New'), ('contacted', 'Contacted'), ('scheduled', 'Scheduled'), ('completed', 'Completed')], default='new', max_length=20)),
                ('admin_note', models.TextField(blank=True)),
            ],
            options={
                'db_table': 'demo_requests',
                'ordering': ['-created_at'],
            },
        ),
    ]
