"""Chat lead capture serializer. Input validation only."""
import re

from rest_framework import serializers

from .models import ChatLead


class ChatLeadRegisterSerializer(serializers.Serializer):
    """Validates a public-site visitor's details before they can start chatting."""

    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=100)
    phone = serializers.CharField(max_length=9, help_text='UAE local number, digits only, no +971 prefix.')

    def validate_name(self, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError('Name must be at least 2 characters.')
        if not re.fullmatch(r"[a-zA-Z؀-ۿ\s'-]+", trimmed):
            raise serializers.ValidationError('Name can only contain letters, spaces, hyphens, apostrophes.')
        return trimmed

    def validate_phone(self, value: str) -> str:
        digits = re.sub(r'\D', '', value)
        if not re.fullmatch(r'5[0-9]{8}', digits) and not re.fullmatch(r'[2-46-79][0-9]{7}', digits):
            raise serializers.ValidationError('Enter a valid UAE mobile or landline number.')
        return f'+971{digits}'

    def create(self, validated_data) -> ChatLead:
        lead, _created = ChatLead.objects.update_or_create(
            email=validated_data['email'],
            defaults={
                'name': validated_data['name'],
                'phone': validated_data['phone'],
                'is_active': True,
            },
        )
        return lead
