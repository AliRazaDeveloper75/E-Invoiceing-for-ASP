from django.urls import path
from .views import BuyerPaymentCreateView, BuyerPaymentListView

# These are appended to the buyer portal URL patterns
urlpatterns = [
    path('invoices/<uuid:invoice_id>/pay/',      BuyerPaymentCreateView.as_view(), name='buyer-pay'),
    path('invoices/<uuid:invoice_id>/payments/', BuyerPaymentListView.as_view(),   name='buyer-payments'),
]
