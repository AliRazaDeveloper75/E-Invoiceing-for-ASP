from django.contrib import admin
from .models import ASPSubmissionLog


@admin.register(ASPSubmissionLog)
class ASPSubmissionLogAdmin(admin.ModelAdmin):
    list_display = [
        'invoice',
        'attempt_number',
        'status',
        'submission_id',
        'request_size_bytes',
        'submitted_at',
    ]
    list_filter = ['status', 'submitted_at']
    search_fields = [
        'invoice__invoice_number',
        'submission_id',
        'error_message',
    ]
    readonly_fields = [
        'invoice',
        'attempt_number',
        'status',
        'submission_id',
        'request_size_bytes',
        'response_payload',
        'error_message',
        'submitted_at',
        'created_at',
        'updated_at',
    ]
    ordering = ['-submitted_at']

    def has_add_permission(self, request):
        return False   # logs are only created programmatically

    def has_delete_permission(self, request, obj=None):
        return False   # immutable audit trail — never delete via admin
