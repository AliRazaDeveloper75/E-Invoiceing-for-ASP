from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0006_alter_companymember_role'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='company_logos/'),
        ),
        migrations.AddField(
            model_name='company',
            name='business_type',
            field=models.CharField(
                blank=True, default='', max_length=20,
                choices=[
                    ('llc', 'Limited Liability Company (LLC)'),
                    ('sole', 'Sole Proprietorship'),
                    ('partnership', 'Partnership'),
                    ('branch', 'Branch of Foreign Company'),
                    ('freezone', 'Free Zone Company'),
                    ('civil', 'Civil Company'),
                    ('public', 'Public Joint Stock Company'),
                    ('private', 'Private Joint Stock Company'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='company',
            name='industry_type',
            field=models.CharField(
                blank=True, default='', max_length=20,
                choices=[
                    ('technology', 'Technology'), ('manufacturing', 'Manufacturing'),
                    ('trading', 'Trading'), ('retail', 'Retail'),
                    ('construction', 'Construction'), ('hospitality', 'Hospitality'),
                    ('healthcare', 'Healthcare'), ('finance', 'Finance'),
                    ('real_estate', 'Real Estate'), ('logistics', 'Logistics'),
                    ('education', 'Education'), ('consulting', 'Consulting'),
                    ('other', 'Other'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='company',
            name='contact_person_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='company',
            name='contact_person_email',
            field=models.EmailField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='company',
            name='contact_person_phone',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='company',
            name='onboarding_status',
            field=models.CharField(
                db_index=True, default='not_started', max_length=20,
                choices=[
                    ('not_started', 'Not Started'), ('submitted', 'Submitted'),
                    ('under_review', 'Under Review'), ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='company',
            name='onboarding_notes',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='company',
            name='onboarding_reviewed_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_companies',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='company',
            name='onboarding_reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
