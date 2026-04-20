app_name = 'inbound'

from django.urls import path
from .views import (
    InboundSubmitView,
    InboundInvoiceListView,
    InboundInvoiceDetailView,
    InboundApproveView,
    InboundRejectView,
    InboundResendObservationView,
    InboundStatsView,
    SupplierListCreateView,
    SupplierActivateView,
    InboundSupplierPortalView,
    InboundPortalSubmitView,
)

urlpatterns = [
    # Supplier-facing submission
    path('submit/',             InboundSubmitView.as_view(),             name='inbound-submit'),

    # Internal team
    path('',                    InboundInvoiceListView.as_view(),         name='inbound-list'),
    path('stats/',              InboundStatsView.as_view(),               name='inbound-stats'),
    path('<uuid:pk>/',          InboundInvoiceDetailView.as_view(),       name='inbound-detail'),
    path('<uuid:pk>/approve/',  InboundApproveView.as_view(),             name='inbound-approve'),
    path('<uuid:pk>/reject/',   InboundRejectView.as_view(),              name='inbound-reject'),
    path('<uuid:pk>/resend-observation/', InboundResendObservationView.as_view(), name='inbound-resend-obs'),

    # Supplier management & activation
    path('suppliers/',          SupplierListCreateView.as_view(),         name='inbound-suppliers'),
    path('suppliers/activate/', SupplierActivateView.as_view(),           name='inbound-activate'),

    # Supplier portal (JWT auth, inbound_supplier role)
    path('portal/',             InboundSupplierPortalView.as_view(),      name='inbound-portal'),
    path('portal/submit/',      InboundPortalSubmitView.as_view(),        name='inbound-portal-submit'),
]
