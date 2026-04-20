"""
Customers URL configuration.
Mounted at: /api/v1/customers/ in config/urls.py
"""
from django.urls import path
from .views import CustomerListCreateView, CustomerDetailView

app_name = 'customers'

urlpatterns = [
    path('',
         CustomerListCreateView.as_view(),
         name='customer-list-create'),

    path('<uuid:customer_id>/',
         CustomerDetailView.as_view(),
         name='customer-detail'),
]
