"""Buyer portal — mounted at /api/v1/buyer/"""
from django.urls import path
from .views import (
    BuyerMeView,
    BuyerDashboardView,
    BuyerInvoiceListView,
    BuyerInvoiceDetailView,
    BuyerInvoicePDFView,
    BuyerInvoiceXMLView,
    BuyerInvoiceApproveView,
    BuyerInvoiceRejectView,
    BuyerPaymentConfigView,
)
from apps.payments.views import (
    BuyerPaymentCreateView,
    BuyerPaymentListView,
    BuyerStripeSessionView,
    BuyerStripeConfirmView,
    BuyerPayPalCreateOrderView,
    BuyerPayPalCaptureOrderView,
)

app_name = 'buyer'

urlpatterns = [
    path('me/',             BuyerMeView.as_view(),            name='me'),
    path('dashboard/',      BuyerDashboardView.as_view(),     name='dashboard'),
    path('payment-config/', BuyerPaymentConfigView.as_view(), name='payment-config'),
    path('invoices/',       BuyerInvoiceListView.as_view(),   name='invoice-list'),
    path('invoices/<uuid:invoice_id>/',
         BuyerInvoiceDetailView.as_view(),                    name='invoice-detail'),
    path('invoices/<uuid:invoice_id>/download-pdf/',
         BuyerInvoicePDFView.as_view(),                       name='invoice-pdf'),
    path('invoices/<uuid:invoice_id>/download-xml/',
         BuyerInvoiceXMLView.as_view(),                       name='invoice-xml'),
    # Approval / e-signature (pre-ASP review flow)
    path('invoices/<uuid:invoice_id>/approve/',
         BuyerInvoiceApproveView.as_view(),                   name='invoice-approve'),
    path('invoices/<uuid:invoice_id>/reject/',
         BuyerInvoiceRejectView.as_view(),                    name='invoice-reject'),
    # Payments
    path('invoices/<uuid:invoice_id>/pay/',
         BuyerPaymentCreateView.as_view(),                    name='pay'),
    path('invoices/<uuid:invoice_id>/payments/',
         BuyerPaymentListView.as_view(),                      name='payments'),
    path('invoices/<uuid:invoice_id>/create-stripe-session/',
         BuyerStripeSessionView.as_view(),                    name='stripe-session'),
    path('invoices/<uuid:invoice_id>/confirm-stripe-payment/',
         BuyerStripeConfirmView.as_view(),                    name='stripe-confirm'),
    path('invoices/<uuid:invoice_id>/create-paypal-order/',
         BuyerPayPalCreateOrderView.as_view(),                name='paypal-create'),
    path('invoices/<uuid:invoice_id>/capture-paypal-order/',
         BuyerPayPalCaptureOrderView.as_view(),               name='paypal-capture'),
]
