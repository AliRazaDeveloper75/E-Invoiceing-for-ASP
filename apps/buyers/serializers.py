from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.common.constants import (
    INVOICE_TYPE_CHOICES, INVOICE_TYPE_TAX, INVOICE_TYPE_CREDIT_NOTE,
    TRANSACTION_TYPE_CHOICES, CURRENCY_CHOICES, VAT_RATE_CHOICES,
    PAYMENT_MEANS_CHOICES, CREDIT_NOTE_REASON_CHOICES, ACCOUNTS_TYPE_CHOICES,
)

from .models import BuyerInvite, BuyerProfile

User = get_user_model()

# Buyer self-billed invoices only cover tax invoices and credit notes.
BUYER_INVOICE_TYPE_CHOICES = [
    (INVOICE_TYPE_TAX, 'Tax Invoice'),
    (INVOICE_TYPE_CREDIT_NOTE, 'Credit Note'),
]


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

    # Buyer (own customer record) details — used by the buyer portal wizard.
    customer_id = serializers.UUIDField(source='customer.id', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_legal_name = serializers.CharField(source='customer.legal_name', read_only=True)
    customer_type = serializers.CharField(source='customer.customer_type', read_only=True)
    customer_trn = serializers.CharField(source='customer.trn', read_only=True)
    customer_address = serializers.CharField(source='customer.formatted_address', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    # Issuing company (the supplier the buyer is linked to) — seller on invoices.
    company_id = serializers.UUIDField(source='customer.company.id', read_only=True)
    company_name = serializers.CharField(source='customer.company.name', read_only=True)
    company_legal_name = serializers.CharField(source='customer.company.legal_name', read_only=True)
    company_trn = serializers.CharField(source='customer.company.trn', read_only=True)
    company_address = serializers.CharField(source='customer.company.formatted_address', read_only=True)
    company_email = serializers.EmailField(source='customer.company.email', read_only=True)
    company_phone = serializers.CharField(source='customer.company.phone', read_only=True)

    class Meta:
        model = BuyerProfile
        fields = [
            'id', 'email', 'full_name', 'created_at',
            'customer_id', 'customer_name', 'customer_legal_name', 'customer_type',
            'customer_trn', 'customer_address', 'customer_email', 'customer_phone',
            'company_id', 'company_name', 'company_legal_name', 'company_trn',
            'company_address', 'company_email', 'company_phone',
        ]


class BuyerInvoiceItemSerializer(serializers.Serializer):
    """Line item input for a buyer-created (self-billed) invoice."""

    item_name = serializers.CharField(max_length=150, required=False, default='')
    description = serializers.CharField(max_length=500)
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=4, min_value=Decimal('0.0001')
    )
    unit = serializers.CharField(max_length=20, required=False, default='')
    unit_price = serializers.DecimalField(
        max_digits=15, decimal_places=4, min_value=Decimal('0.00')
    )
    vat_rate_type = serializers.ChoiceField(
        choices=[c[0] for c in VAT_RATE_CHOICES], default='standard'
    )


class BuyerInvoiceCreateSerializer(serializers.Serializer):
    """Input: buyer creates a self-billed invoice for their own customer record.

    The supplier company the buyer is linked to is the issuer (seller) and the
    buyer's own customer record is the recipient. The invoice is submitted
    directly to the ASP/FTA pipeline (no supplier approval step).
    """

    invoice_type = serializers.ChoiceField(
        choices=BUYER_INVOICE_TYPE_CHOICES,
        default=INVOICE_TYPE_TAX,
    )
    transaction_type = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES],
        default='b2b',
    )
    payment_means_code = serializers.ChoiceField(
        choices=[c[0] for c in PAYMENT_MEANS_CHOICES],
        default='30',
    )
    supplier_location = serializers.CharField(max_length=255, required=False, default='')
    accounts_type = serializers.ChoiceField(
        choices=[c[0] for c in ACCOUNTS_TYPE_CHOICES],
        required=False, allow_blank=True, default='',
    )
    issue_date = serializers.DateField(required=False)
    due_date = serializers.DateField(required=False, allow_null=True)
    supply_date = serializers.DateField(required=False, allow_null=True)
    currency = serializers.ChoiceField(
        choices=[c[0] for c in CURRENCY_CHOICES],
        default='AED',
    )
    exchange_rate = serializers.DecimalField(
        max_digits=10, decimal_places=6, required=False,
        default=Decimal('1.000000'), min_value=Decimal('0.000001'),
    )
    discount_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False,
        default=Decimal('0.00'), min_value=Decimal('0.00'),
    )
    reference_number = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    credit_note_reason_code = serializers.ChoiceField(
        choices=[c[0] for c in CREDIT_NOTE_REASON_CHOICES],
        required=False, allow_blank=True, default='',
    )
    purchase_order_number = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    notes = serializers.CharField(required=False, default='', allow_blank=True)
    items = BuyerInvoiceItemSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        if not attrs.get('items'):
            raise serializers.ValidationError({'items': 'At least one line item is required.'})

        if (attrs.get('invoice_type') == INVOICE_TYPE_CREDIT_NOTE
                and not attrs.get('reference_number', '').strip()):
            raise serializers.ValidationError({
                'reference_number': 'Credit notes must reference the original invoice number.'
            })

        if (attrs.get('invoice_type') == INVOICE_TYPE_CREDIT_NOTE
                and not attrs.get('credit_note_reason_code', '').strip()):
            raise serializers.ValidationError({
                'credit_note_reason_code': 'Credit notes must include a reason code (BTAE-03).'
            })

        issue_date = attrs.get('issue_date')
        if issue_date and attrs.get('due_date') and attrs['due_date'] < issue_date:
            raise serializers.ValidationError({
                'due_date': 'Due date cannot be before the issue date.'
            })

        return attrs
