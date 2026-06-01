from django.urls import path
from .fraud_views import FraudAlertListView

urlpatterns = [
    path('alerts/', FraudAlertListView.as_view(), name='fraud-alerts-list'),
]
