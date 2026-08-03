from django.contrib import admin
from .models import AIConversation

# Here we are registering the AI conversation in admin panel so that only admin
# can see the chats of what others are conversating with agent

@admin.register(AIConversation)
class AIConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'company', 'role_snapshot', 'is_active', 'last_active_at')
    list_filter = ('role_snapshot', 'is_active')
    search_fields = ('user__email', 'company__name')
    readonly_fields = ('id', 'created_at', 'last_active_at')

