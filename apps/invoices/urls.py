"""
Invoices URL configuration.
Mounted at: /api/v1/invoices/ in config/urls.py
"""
from django.urls import path, include
from .views import (
    InvoiceListCreateView,
    InvoiceDetailView,
    InvoiceSubmitView,
    InvoiceSendForApprovalView,
    InvoiceCancelView,
    InvoiceDeactivateView,
    InvoiceCreditNoteView,
    InvoiceXMLDownloadView,
    InvoicePDFDownloadView,
    InvoiceVATSummaryView,
    InvoiceItemListCreateView,
    InvoiceItemDetailView,
    InvoiceDashboardView,
    InvoiceValidateView,
    InvoiceFTAReportView,
    InvoiceExportView,
    InvoiceGapReportView,
    InvoiceDraftAutosaveView,
)
from apps.payments.views import SupplierPaymentListView
from .workflow_views import WorkflowEvaluateView
from .product_views import ProductListCreateView, ProductDetailView

app_name = 'invoices'

urlpatterns = [
    # ── Product catalog ───────────────────────────────────────────────────────
    # Must be declared before <uuid:invoice_id>/ to avoid URL collision
    path('products/',
         ProductListCreateView.as_view(),
         name='product-list-create'),
    path('products/<uuid:pk>/',
         ProductDetailView.as_view(),
         name='product-detail'),

    # ── Dashboard ─────────────────────────────────────────────────────────────
    # Must be declared before <uuid:invoice_id>/ to avoid URL collision
    path('dashboard/',
         InvoiceDashboardView.as_view(),
         name='invoice-dashboard'),

    # ── Draft autosave (server-side scratchpad) ───────────────────────────────
    # Must be declared before <uuid:invoice_id>/ to avoid URL collision
    path('draft-autosave/',
         InvoiceDraftAutosaveView.as_view(),
         name='invoice-draft-autosave'),

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

    path('<uuid:invoice_id>/send-for-approval/',
         InvoiceSendForApprovalView.as_view(),
         name='invoice-send-for-approval'),

    path('<uuid:invoice_id>/cancel/',
         InvoiceCancelView.as_view(),
         name='invoice-cancel'),

    path('<uuid:invoice_id>/deactivate/',
         InvoiceDeactivateView.as_view(),
         name='invoice-deactivate'),

    path('<uuid:invoice_id>/credit-note/',
         InvoiceCreditNoteView.as_view(),
         name='invoice-credit-note'),

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

    # ── Pre-submit Validation ─────────────────────────────────────────────────
    path('<uuid:invoice_id>/validate/',
         InvoiceValidateView.as_view(),
         name='invoice-validate'),

    # ── Manual FTA Re-Report ──────────────────────────────────────────────────
    path('<uuid:invoice_id>/report-fta/',
         InvoiceFTAReportView.as_view(),
         name='invoice-report-fta'),

    # ── Export ────────────────────────────────────────────────────────────────
    # Must be declared before <uuid:invoice_id>/ to avoid URL collision
    path('export/',
         InvoiceExportView.as_view(),
         name='invoice-export'),

    # ── UAE Article 70 Gap Report ─────────────────────────────────────────────
    path('gap-report/',
         InvoiceGapReportView.as_view(),
         name='invoice-gap-report'),

    # ── Payments (supplier view) ──────────────────────────────────────────────
    path('<uuid:invoice_id>/payments/',
         SupplierPaymentListView.as_view(),
         name='invoice-payments'),

    # ── Fraud Detection ───────────────────────────────────────────────────────
    path('<uuid:invoice_pk>/fraud/', include('apps.invoices.fraud_urls')),

    # ── Workflow Automation ───────────────────────────────────────────────────
    path('<uuid:invoice_pk>/workflow/evaluate/',
         WorkflowEvaluateView.as_view(),
         name='workflow-evaluate'),
]
