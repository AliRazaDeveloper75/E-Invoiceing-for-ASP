from django.urls import path
from .views import ChatView, ChatQueryView

app_name = 'chat'

urlpatterns = [
    path('',       ChatView.as_view(),      name='chat'),
    path('query/', ChatQueryView.as_view(), name='chat-query'),
]
