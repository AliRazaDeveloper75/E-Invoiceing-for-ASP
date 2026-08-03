from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    """
    Incoming request to POST /api/v1/ai-assistant/chat/
    company_id comes as a query param (matching the rest of the project's
    pattern), so it is NOT part of this body serializer.
    """
    message = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        max_length=4000,
        help_text="The user's chat message to the AI Assistant."
    )
    conversation_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Existing conversation to continue. Omit to start a new one."
    )

class ChatResponseSerializer(serializers.Serializer):
    """
    Response Shape returned by AI Assistant Chat View
    """
    conversation_id =  serializers.UUIDField()
    reply = serializers.CharField()
    role = serializers.CharField()