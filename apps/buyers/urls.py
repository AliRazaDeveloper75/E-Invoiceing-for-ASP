"""
Buyer Portal URL configuration.

Two URL sets:
  /api/v1/buyers/  — invite flow (supplier-side)
  /api/v1/buyer/   — buyer-authenticated portal
"""
from django.urls import path
from .views import (
    BuyerInviteView,
    AcceptInviteView,
    BuyerMeView,
    BuyerDashboardView,
    BuyerInvoiceListView,
    BuyerInvoiceDetailView,
    BuyerInvoicePDFView,
    BuyerInvoiceXMLView,
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

# Mounted at /api/v1/buyers/ (invite management)
invite_urlpatterns = [
    path('invite/',        BuyerInviteView.as_view(),   name='buyer-invite'),
    path('accept-invite/', AcceptInviteView.as_view(),  name='buyer-accept-invite'),
]

# Mounted at /api/v1/buyer/ (buyer portal)
portal_urlpatterns = [
    path('me/',             BuyerMeView.as_view(),           name='buyer-me'),
    path('dashboard/',      BuyerDashboardView.as_view(),    name='buyer-dashboard'),
    path('payment-config/', BuyerPaymentConfigView.as_view(), name='buyer-payment-config'),
    path('invoices/',       BuyerInvoiceListView.as_view(),  name='buyer-invoice-list'),
    path('invoices/<uuid:invoice_id>/',
         BuyerInvoiceDetailView.as_view(),                   name='buyer-invoice-detail'),
    path('invoices/<uuid:invoice_id>/download-pdf/',
         BuyerInvoicePDFView.as_view(),                      name='buyer-invoice-pdf'),
    path('invoices/<uuid:invoice_id>/download-xml/',
         BuyerInvoiceXMLView.as_view(),                      name='buyer-invoice-xml'),
    # Payments
    path('invoices/<uuid:invoice_id>/pay/',
         BuyerPaymentCreateView.as_view(),                   name='buyer-payment-create'),
    path('invoices/<uuid:invoice_id>/payments/',
         BuyerPaymentListView.as_view(),                     name='buyer-payment-list'),
    path('invoices/<uuid:invoice_id>/create-stripe-session/',
         BuyerStripeSessionView.as_view(),                   name='buyer-stripe-session'),
    path('invoices/<uuid:invoice_id>/confirm-stripe-payment/',
         BuyerStripeConfirmView.as_view(),                   name='buyer-stripe-confirm'),
    path('invoices/<uuid:invoice_id>/create-paypal-order/',
         BuyerPayPalCreateOrderView.as_view(),               name='buyer-paypal-create'),
    path('invoices/<uuid:invoice_id>/capture-paypal-order/',
         BuyerPayPalCaptureOrderView.as_view(),              name='buyer-paypal-capture'),
]
