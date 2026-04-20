"""
Taxes app serializers.

VATCalculateSerializer — validates input for the on-demand VAT calculation endpoint.
"""
from decimal import Decimal
from rest_framework import serializers
from apps.common.constants import VAT_RATE_CHOICES


class VATCalculateSerializer(serializers.Serializer):
    """
    Input for POST /api/v1/taxes/calculate/

    Calculates VAT for a given amount and rate type.
    Useful for frontend previews before creating a full invoice.
    """
    amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=4,
        min_value=Decimal('0.00'),
        help_text='Net amount before VAT (in AED).',
    )
    vat_rate_type = serializers.ChoiceField(
        choices=[c[0] for c in VAT_RATE_CHOICES],
        default='standard',
        help_text='UAE VAT rate type to apply.',
    )
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        default=Decimal('1.0000'),
        required=False,
        help_text='Optional quantity multiplier. Defaults to 1.',
    )
