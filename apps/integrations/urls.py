from django.urls import path
from .views import InvoiceSubmissionLogsView, ASPWebhookView, InvoiceTimelineView

app_name = 'integrations'

urlpatterns = [
    # Audit trail: list all ASP submission attempts for a given invoice
    path(
        'invoices/<uuid:invoice_id>/logs/',
        InvoiceSubmissionLogsView.as_view(),
        name='invoice-submission-logs',
    ),
    # Full 5-corner flow state + event timeline for a given invoice
    path(
        'invoices/<uuid:invoice_id>/timeline/',
        InvoiceTimelineView.as_view(),
        name='invoice-timeline',
    ),
    # Inbound webhook from ASP (Corner 2 status-change notifications)
    path(
        'asp/webhook/',
        ASPWebhookView.as_view(),
        name='asp-webhook',
    ),
]
