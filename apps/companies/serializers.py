"""
Companies serializers.

Input validation only. No business logic.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.common.constants import USER_ROLE_CHOICES
from .models import Company, CompanyMember, EMIRATE_CHOICES

User = get_user_model()


# ─── Company ──────────────────────────────────────────────────────────────────

class CompanySerializer(serializers.ModelSerializer):
    """Full company representation for GET responses."""

    formatted_address = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'legal_name', 'trn', 'tin',
            'is_vat_group',
            'street_address', 'city', 'emirate', 'po_box', 'country',
            'formatted_address',
            'phone', 'email', 'website',
            'peppol_endpoint',
            'is_active', 'member_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tin', 'is_active', 'created_at', 'updated_at']

    def get_formatted_address(self, obj) -> str:
        return obj.formatted_address

    def get_member_count(self, obj) -> int:
        return obj.members.filter(is_active=True).count()


class CompanyCreateSerializer(serializers.Serializer):
    """Validates input for creating a new company."""

    name = serializers.CharField(max_length=255)
    legal_name = serializers.CharField(max_length=255, required=False)
    trn = serializers.CharField(
        max_length=15,
        min_length=15,
        help_text='15-digit UAE Tax Registration Number.'
    )
    is_vat_group = serializers.BooleanField(default=False, required=False)

    # Address
    street_address = serializers.CharField(max_length=500)
    city = serializers.CharField(max_length=100)
    emirate = serializers.ChoiceField(
        choices=[e[0] for e in EMIRATE_CHOICES],
        default='dubai'
    )
    po_box = serializers.CharField(max_length=20, required=False, default='')
    country = serializers.CharField(max_length=2, default='AE', required=False)

    # Contact
    phone = serializers.CharField(max_length=20, required=False, default='')
    email = serializers.EmailField(required=False, default='')
    website = serializers.URLField(required=False, default='')

    def validate_trn(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError('TRN must contain digits only.')
        if len(value) != 15:
            raise serializers.ValidationError('TRN must be exactly 15 digits.')
        return value

    def validate_country(self, value: str) -> str:
        return value.upper()


class CompanyUpdateSerializer(serializers.Serializer):
    """Validates input for updating a company. TRN is excluded (immutable)."""

    name = serializers.CharField(max_length=255, required=False)
    legal_name = serializers.CharField(max_length=255, required=False)
    is_vat_group = serializers.BooleanField(required=False)
    street_address = serializers.CharField(max_length=500, required=False)
    city = serializers.CharField(max_length=100, required=False)
    emirate = serializers.ChoiceField(
        choices=[e[0] for e in EMIRATE_CHOICES],
        required=False
    )
    po_box = serializers.CharField(max_length=20, required=False)
    country = serializers.CharField(max_length=2, required=False)
    phone = serializers.CharField(max_length=20, required=False)
    email = serializers.EmailField(required=False)
    website = serializers.URLField(required=False)
    peppol_endpoint = serializers.CharField(max_length=255, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        return attrs


# ─── Company Member ───────────────────────────────────────────────────────────

class CompanyMemberSerializer(serializers.ModelSerializer):
    """Representation of a company member (includes user info)."""

    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    user_id = serializers.UUIDField(source='user.id', read_only=True)

    class Meta:
        model = CompanyMember
        fields = [
            'id', 'user_id', 'user_email', 'user_full_name',
            'role', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AddMemberSerializer(serializers.Serializer):
    """Input for adding a new member to a company."""

    user_email = serializers.EmailField(
        help_text='Email of the existing platform user to add.'
    )
    role = serializers.ChoiceField(
        choices=USER_ROLE_CHOICES,
        default='viewer'
    )

    def validate_user_email(self, value: str) -> User:
        """Resolve email to User instance early — fail fast."""
        try:
            return User.objects.get(email=value.lower(), is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                f'No active user found with email: {value}'
            )


class ChangeMemberRoleSerializer(serializers.Serializer):
    """Input for changing an existing member's role."""

    role = serializers.ChoiceField(choices=USER_ROLE_CHOICES)
