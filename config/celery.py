"""
Celery application — RabbitMQ broker for async invoice processing.

Tasks are explicitly included from:
  - tasks/invoice_tasks.py  — main invoice pipeline
  - tasks/cert_tasks.py     — certificate expiry monitoring
  - tasks/as4_tasks.py      — PEPPOL AS4 transmission
  - tasks/mdn_tasks.py      — MDN receipt processing
  - tasks/fta_tasks.py      — FTA data platform reporting
  - tasks/ocr_tasks.py      — AI OCR document processing
  - tasks/fraud_tasks.py    — AI fraud detection + periodic scan
"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('einvoicing')

# Namespace 'CELERY' means all celery config keys start with CELERY_ in settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Explicitly include all task modules so workers register them at startup
app.conf.include = [
    'tasks.invoice_tasks',
    'tasks.cert_tasks',
    'tasks.as4_tasks',
    'tasks.mdn_tasks',
    'tasks.fta_tasks',
    'tasks.ocr_tasks',
    'tasks.fraud_tasks',
]


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Utility task to verify Celery is running."""
    print(f'Request: {self.request!r}')
