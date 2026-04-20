"""
Celery application — RabbitMQ broker for async invoice processing.

Tasks are auto-discovered from:
  - tasks/invoice_tasks.py
  - apps/*/tasks.py  (if added later)
"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('einvoicing')

# Namespace 'CELERY' means all celery config keys start with CELERY_ in settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from both locations
app.autodiscover_tasks(['tasks'])


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Utility task to verify Celery is running."""
    print(f'Request: {self.request!r}')
