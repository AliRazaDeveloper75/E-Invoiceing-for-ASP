"""Buyer invite flow — mounted at /api/v1/buyers/"""
from django.urls import path
from .views import BuyerInviteView, AcceptInviteView

app_name = 'buyers'

urlpatterns = [
    path('invite/',        BuyerInviteView.as_view(),  name='invite'),
    path('accept-invite/', AcceptInviteView.as_view(), name='accept-invite'),
]
