from django.urls import path
from apps.ai_assistant.views import AIAssistantChatView


app_name = "ai_assistant"

urlpatterns = [
    path("chat/", AIAssistantChatView.as_view(), name="chat"),
]

