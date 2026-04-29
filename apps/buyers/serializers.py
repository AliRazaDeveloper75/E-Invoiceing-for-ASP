from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import BuyerInvite, BuyerProfile

User = get_user_model()


class BuyerInviteSerializer(serializers.Serializer):
    """Input: supplier invites a buyer by customer + email."""
    customer_id = serializers.UUIDField()
    email = serializers.EmailField()


class AcceptInviteSerializer(serializers.Serializer):
    """Input: buyer accepts invite and registers."""
    token = serializers.UUIDField()
    full_name = serializers.CharField(max_length=200)
    password = serializers.CharField(min_length=8, write_only=True)


class BuyerProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_id = serializers.UUIDField(source='customer.id', read_only=True)

    class Meta:
        model = BuyerProfile
        fields = ['id', 'email', 'full_name', 'customer_id', 'customer_name', 'created_at']
