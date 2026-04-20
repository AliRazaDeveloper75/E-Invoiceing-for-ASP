"""
Invoices URL configuration.
Mounted at: /api/v1/invoices/ in config/urls.py
"""
from django.urls import path
from .views import (
    InvoiceListCreateView,
    InvoiceDetailView,
    InvoiceSubmitView,
    InvoiceCancelView,
    InvoiceXMLDownloadView,
    InvoicePDFDownloadView,
    InvoiceVATSummaryView,
    InvoiceItemListCreateView,
    InvoiceItemDetailView,
    InvoiceDashboardView,
)

app_name = 'invoices'

urlpatterns = [
    # ── Dashboard ─────────────────────────────────────────────────────────────
    # Must be declared before <uuid:invoice_id>/ to avoid URL collision
    path('dashboard/',
         InvoiceDashboardView.as_view(),
         name='invoice-dashboard'),

    # ── Invoice CRUD ──────────────────────────────────────────────────────────
    path('',
         InvoiceListCreateView.as_view(),
         name='invoice-list-create'),

    path('<uuid:invoice_id>/',
         InvoiceDetailView.as_view(),
         name='invoice-detail'),

    # ── Status Transitions ────────────────────────────────────────────────────
    path('<uuid:invoice_id>/submit/',
         InvoiceSubmitView.as_view(),
         name='invoice-submit'),

    path('<uuid:invoice_id>/cancel/',
         InvoiceCancelView.as_view(),
         name='invoice-cancel'),

    # ── Downloads ─────────────────────────────────────────────────────────────
    path('<uuid:invoice_id>/download-xml/',
         InvoiceXMLDownloadView.as_view(),
         name='invoice-download-xml'),

    path('<uuid:invoice_id>/download-pdf/',
         InvoicePDFDownloadView.as_view(),
         name='invoice-download-pdf'),

    # ── VAT Summary ───────────────────────────────────────────────────────────
    path('<uuid:invoice_id>/vat-summary/',
         InvoiceVATSummaryView.as_view(),
         name='invoice-vat-summary'),

    # ── Line Items ────────────────────────────────────────────────────────────
    path('<uuid:invoice_id>/items/',
         InvoiceItemListCreateView.as_view(),
         name='invoice-item-list-create'),

    path('<uuid:invoice_id>/items/<uuid:item_id>/',
         InvoiceItemDetailView.as_view(),
         name='invoice-item-detail'),
]
