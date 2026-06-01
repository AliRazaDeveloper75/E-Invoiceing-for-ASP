from django.urls import path
from .fraud_views import FraudAnalyzeView, FraudAlertDetailView, FraudResolveView

# Mounted under /api/v1/invoices/<uuid>/fraud/
urlpatterns = [
    path('',         FraudAlertDetailView.as_view(), name='fraud-detail'),
    path('analyze/', FraudAnalyzeView.as_view(),     name='fraud-analyze'),
    path('resolve/', FraudResolveView.as_view(),     name='fraud-resolve'),
]
