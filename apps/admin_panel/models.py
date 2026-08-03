from django.db import models
from apps.common.models import BaseModel


class DemoRequest(BaseModel):
    STATUS_NEW = 'new'
    STATUS_CONTACTED = 'contacted'
    STATUS_SCHEDULED = 'scheduled'
    STATUS_COMPLETED = 'completed'
    STATUS_CHOICES = [
        (STATUS_NEW,       'New'),
        (STATUS_CONTACTED, 'Contacted'),
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    full_name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    company = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    admin_note = models.TextField(blank=True)

    class Meta:
        db_table = 'demo_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} <{self.email}> — {self.company}"


class ContactMessage(BaseModel):
    STATUS_NEW = 'new'
    STATUS_READ = 'read'
    STATUS_REPLIED = 'replied'
    STATUS_CHOICES = [
        (STATUS_NEW,     'New'),
        (STATUS_READ,    'Read'),
        (STATUS_REPLIED, 'Replied'),
    ]

    SUBJECT_CHOICES = [
        ('fta_compliance',    'FTA Compliance Question'),
        ('peppol',            'PEPPOL Integration'),
        ('support',           'Platform Support'),
        ('pricing',           'Pricing / Demo'),
        ('other',             'Other'),
    ]

    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField()
    company    = models.CharField(max_length=200, blank=True)
    subject    = models.CharField(max_length=50, choices=SUBJECT_CHOICES, default='other')
    message    = models.TextField()
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    admin_note = models.TextField(blank=True)

    class Meta:
        db_table = 'contact_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name} <{self.email}> — {self.subject}"
