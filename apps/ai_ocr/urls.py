from django.urls import path
from .views import (
    OCRUploadView, OCRDocumentListView, OCRDocumentDetailView,
    OCRReviewView, OCRRetryView,
)

app_name = 'ai_ocr'

urlpatterns = [
    path('',               OCRDocumentListView.as_view(),  name='list'),
    path('upload/',        OCRUploadView.as_view(),         name='upload'),
    path('<uuid:pk>/',     OCRDocumentDetailView.as_view(), name='detail'),
    path('<uuid:pk>/review/', OCRReviewView.as_view(),      name='review'),
    path('<uuid:pk>/retry/',  OCRRetryView.as_view(),       name='retry'),
]
