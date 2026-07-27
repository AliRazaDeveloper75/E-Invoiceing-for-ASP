from django.urls import path
from .views import ChatView, ChatQueryView, PublicChatView, PublicChatRegisterView

app_name = 'chat'

urlpatterns = [
    path('',        ChatView.as_view(),               name='chat'),
    path('query/',  ChatQueryView.as_view(),           name='chat-query'),
    path('public/', PublicChatView.as_view(),          name='chat-public'),
    path('lead/',   PublicChatRegisterView.as_view(),  name='chat-lead'),
]
