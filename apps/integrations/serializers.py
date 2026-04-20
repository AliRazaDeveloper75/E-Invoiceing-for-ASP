"""
Serializers for the integrations app.

ASPSubmissionLogSerializer — read-only; exposes the audit trail for
invoice submission attempts. Never writable via the API.
"""
from rest_framework import serializers
from .models import ASPSubmissionLog


class ASPSubmissionLogSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number',
        read_only=True,
    )

    class Meta:
        model = ASPSubmissionLog
        fields = [
            'id',
            'invoice',
            'invoice_number',
            'attempt_number',
            'status',
            'submission_id',
            'request_size_bytes',
            'response_payload',
            'error_message',
            'submitted_at',
            'created_at',
        ]
        read_only_fields = fields


class ASPWebhookSerializer(serializers.Serializer):
    """
    Validates inbound webhook payloads from the ASP.

    The ASP calls our /api/v1/integrations/asp/webhook/ endpoint
    when invoice status changes (e.g. validated / rejected by FTA).

    Required fields follow the PEPPOL 5-corner notification contract.
    """
    submission_id = serializers.CharField(max_length=255)
    invoice_number = serializers.CharField(max_length=50)
    status = serializers.ChoiceField(choices=['validated', 'rejected', 'pending'])
    errors = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    timestamp = serializers.DateTimeField()
    raw_payload = serializers.DictField(required=False, default=dict)
