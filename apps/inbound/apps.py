from django.apps import AppConfig


class InboundConfig(AppConfig):
    name            = 'apps.inbound'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name    = 'Inbound Invoices'
