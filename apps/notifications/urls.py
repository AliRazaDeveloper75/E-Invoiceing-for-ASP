from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
)

app_name = 'notifications'

urlpatterns = [
    path('',                  NotificationListView.as_view(),        name='list'),
    path('read-all/',         NotificationMarkAllReadView.as_view(), name='read-all'),
    path('<uuid:pk>/read/',   NotificationMarkReadView.as_view(),    name='read'),
]
