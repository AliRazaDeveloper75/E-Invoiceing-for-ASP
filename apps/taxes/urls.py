from django.urls import path
from .views import VATRateListView, VATCalculateView

app_name = 'taxes'

urlpatterns = [
    path('rates/',     VATRateListView.as_view(),  name='vat-rate-list'),
    path('calculate/', VATCalculateView.as_view(), name='vat-calculate'),
]
