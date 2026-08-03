from django.urls import path
from .views import DemoRequestSubmitView

urlpatterns = [
    path('', DemoRequestSubmitView.as_view(), name='demo-submit'),
]
