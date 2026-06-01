"""
Reporting URLs. Mounted at /api/v1/reports/ in config/urls.py
"""
from django.urls import path
from .views import (
    FAFGenerateView,
    FAFListView,
    FAFDownloadView,
    InvoiceAuditLogView,
    APIRequestLogView,
)
from .analytics_views import (
    AnalyticsReportView,
    RevenueAnalyticsView,
    VATAnalyticsView,
    PaymentAnalyticsView,
)

app_name = 'reporting'

urlpatterns = [
    # FAF
    path('faf/',                   FAFListView.as_view(),     name='faf-list'),
    path('faf/generate/',          FAFGenerateView.as_view(), name='faf-generate'),
    path('faf/<uuid:faf_id>/download/', FAFDownloadView.as_view(), name='faf-download'),

    # Audit / logs
    path('audit-logs/',            InvoiceAuditLogView.as_view(), name='audit-logs'),
    path('api-logs/',              APIRequestLogView.as_view(),   name='api-logs'),

    # AI Analytics
    path('analytics/',             AnalyticsReportView.as_view(),  name='analytics-report'),
    path('analytics/revenue/',     RevenueAnalyticsView.as_view(), name='analytics-revenue'),
    path('analytics/vat/',         VATAnalyticsView.as_view(),     name='analytics-vat'),
    path('analytics/payments/',    PaymentAnalyticsView.as_view(), name='analytics-payments'),
]
