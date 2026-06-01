import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0003_ftasubmissionlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='SMPEndpointCache',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('participant_id', models.CharField(db_index=True, max_length=255)),
                ('document_type_id', models.CharField(max_length=500)),
                ('transport_url', models.URLField(max_length=500)),
                ('transport_profile', models.CharField(default='peppol-transport-as4-v2_0', max_length=100)),
                ('certificate_uid', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'SMP Endpoint Cache',
                'db_table': 'smp_endpoint_cache',
                'unique_together': {('participant_id', 'document_type_id')},
            },
        ),
        migrations.AddIndex(
            model_name='smpendpointcache',
            index=models.Index(fields=['participant_id'], name='idx_smp_participant'),
        ),
    ]
