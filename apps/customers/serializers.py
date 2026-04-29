"""
Customer serializers.

Input validation only. No business logic.
"""
from rest_framework import serializers
from apps.common.constants import TRANSACTION_TYPE_CHOICES
from .models import Customer


# ─── Read Serializer ──────────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    """Full customer representation for API responses."""

    formatted_address   = serializers.SerializerMethodField()
    is_peppol_connected = serializers.BooleanField(read_only=True)
    customer_type_display = serializers.CharField(
        source='get_customer_type_display',
        read_only=True
    )
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id',
            'company_name',
            'name', 'legal_name', 'customer_type', 'customer_type_display',
            # Tax
            'trn', 'tin', 'vat_number',
            # PEPPOL
            'peppol_endpoint', 'is_peppol_connected',
            # Address
            'street_address', 'city', 'state_province', 'postal_code', 'country',
            'formatted_address',
            # Contact
            'email', 'phone',
            # Meta
            'notes', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tin', 'is_active', 'created_at', 'updated_at']

    def get_formatted_address(self, obj) -> str:
        return obj.formatted_address


# ─── Create Serializer ────────────────────────────────────────────────────────

class CustomerCreateSerializer(serializers.Serializer):
    """Validates input for creating a new customer."""

    name = serializers.CharField(max_length=255)
    legal_name = serializers.CharField(max_length=255, required=False, default='', allow_blank=True)
    customer_type = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES],
        default='b2b'
    )

    # Tax — at least one should be provided for B2B/B2G
    trn = serializers.CharField(
        max_length=15,
        required=False,
        default='',
        allow_blank=True,
        help_text='15-digit UAE TRN. Required for UAE B2B/B2G customers.'
    )
    vat_number = serializers.CharField(
        max_length=20,
        required=False,
        default='',
        allow_blank=True,
        help_text='VAT number for non-UAE (international) customers.'
    )

    # PEPPOL
    peppol_endpoint = serializers.CharField(max_length=255, required=False, default='', allow_blank=True)

    # Address
    street_address = serializers.CharField(max_length=500, required=False, default='', allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    state_province = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    postal_code = serializers.CharField(max_length=20, required=False, default='', allow_blank=True)
    country = serializers.CharField(
        max_length=2,
        default='AE',
        required=False,
        allow_blank=False,
        help_text='ISO 3166-1 alpha-2 country code (e.g. AE, US, GB).'
    )

    # Contact
    email = serializers.EmailField(required=False, default='', allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, default='', allow_blank=True)
    notes = serializers.CharField(required=False, default='', allow_blank=True)

    def validate_trn(self, value: str) -> str:
        if value and (not value.isdigit() or len(value) != 15):
            raise serializers.ValidationError(
                'TRN must be exactly 15 numeric digits.'
            )
        return value

    def validate_country(self, value: str) -> str:
        if len(value) != 2:
            raise serializers.ValidationError(
                'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. AE, US).'
            )
        return value.upper()

    def validate(self, attrs):
        """
        Cross-field: UAE B2B/B2G customers must supply a TRN.
        International customers should supply a vat_number.
        """
        is_uae = attrs.get('country', 'AE').upper() == 'AE'
        is_b2b_or_b2g = attrs.get('customer_type') in ('b2b', 'b2g')

        if is_uae and is_b2b_or_b2g and not attrs.get('trn'):
            raise serializers.ValidationError({
                'trn': (
                    'UAE B2B and B2G customers must have a TRN. '
                    'The TIN (first 10 digits) is used as the B2B business identifier per UAE MoF.'
                )
            })

        return attrs


# ─── Update Serializer ────────────────────────────────────────────────────────

class CustomerUpdateSerializer(serializers.Serializer):
    """All fields optional for partial updates. TIN remains auto-derived."""

    name = serializers.CharField(max_length=255, required=False)
    legal_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer_type = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES],
        required=False
    )
    trn = serializers.CharField(max_length=15, required=False, allow_blank=True)
    vat_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    peppol_endpoint = serializers.CharField(max_length=255, required=False, allow_blank=True)
    street_address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state_province = serializers.CharField(max_length=100, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=2, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_trn(self, value: str) -> str:
        if value and (not value.isdigit() or len(value) != 15):
            raise serializers.ValidationError('TRN must be exactly 15 numeric digits.')
        return value

    def validate_country(self, value: str) -> str:
        if value and len(value) != 2:
            raise serializers.ValidationError('Country must be a 2-letter ISO code.')
        return value.upper() if value else value

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        return attrs


# ─── List Query Params ────────────────────────────────────────────────────────

class CustomerFilterSerializer(serializers.Serializer):
    """Validates query params for the customer list endpoint."""

    company_id = serializers.UUIDField(
        help_text='Required. UUID of the company whose customers to list.'
    )
    search = serializers.CharField(required=False, default='')
    customer_type = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES],
        required=False
    )
    country = serializers.CharField(max_length=2, required=False)
