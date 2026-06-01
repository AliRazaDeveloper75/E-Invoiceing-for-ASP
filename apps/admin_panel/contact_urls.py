from django.urls import path
from .views import ContactMessageSubmitView

urlpatterns = [
    path('', ContactMessageSubmitView.as_view(), name='contact-submit'),
]
