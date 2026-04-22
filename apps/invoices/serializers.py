"""
Invoice serializers.

Input validation only — no business logic.
"""
from decimal import Decimal
from rest_framework import serializers

from apps.common.constants import (
    INVOICE_TYPE_CHOICES, TRANSACTION_TYPE_CHOICES,
    INVOICE_STATUS_CHOICES, CURRENCY_CHOICES, VAT_RATE_CHOICES,
    INVOICE_TYPE_CREDIT_NOTE, INVOICE_TYPE_CONTINUOUS,
    PAYMENT_MEANS_CHOICES,
)
from .models import Invoice, InvoiceItem


# ─── InvoiceItem ──────────────────────────────────────────────────────────────

class InvoiceItemSerializer(serializers.ModelSerializer):
    """Full line item representation."""

    vat_rate_type_display = serializers.CharField(
        source='get_vat_rate_type_display', read_only=True
    )

    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'item_name', 'description', 'quantity', 'unit', 'unit_price',
            'vat_rate_type', 'vat_rate_type_display',
            'vat_rate', 'subtotal', 'vat_amount', 'total_amount',
            'sort_order', 'is_active',
        ]
        read_only_fields = ['id', 'vat_rate', 'subtotal', 'vat_amount', 'total_amount']


class InvoiceItemCreateSerializer(serializers.Serializer):
    """Input for adding a new line item."""

    item_name = serializers.CharField(max_length=150, required=False, default='',
                                      help_text='Short product/service name (UBL Item/Name).')
    description = serializers.CharField(max_length=500)
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=4,
        min_value=Decimal('0.0001')
    )
    unit = serializers.CharField(max_length=20, required=False, default='')
    unit_price = serializers.DecimalField(
        max_digits=15, decimal_places=4,
        min_value=Decimal('0.00')
    )
    vat_rate_type = serializers.ChoiceField(
        choices=[c[0] for c in VAT_RATE_CHOICES],
        default='standard'
    )
    sort_order = serializers.IntegerField(required=False, default=0, min_value=0)


class InvoiceItemUpdateSerializer(serializers.Serializer):
    """All fields optional for partial item updates."""

    item_name = serializers.CharField(max_length=150, required=False)
    description = serializers.CharField(max_length=500, required=False)
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=4,
        min_value=Decimal('0.0001'), required=False
    )
    unit = serializers.CharField(max_length=20, required=False)
    unit_price = serializers.DecimalField(
        max_digits=15, decimal_places=4,
        min_value=Decimal('0.00'), required=False
    )
    vat_rate_type = serializers.ChoiceField(
        choices=[c[0] for c in VAT_RATE_CHOICES],
        required=False
    )
    sort_order = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        return attrs


# ─── Invoice ──────────────────────────────────────────────────────────────────

class InvoiceSerializer(serializers.ModelSerializer):
    """Full invoice representation including summary and customer info."""

    customer_name   = serializers.CharField(source='customer.name',          read_only=True)
    customer_trn    = serializers.CharField(source='customer.trn',           read_only=True)
    company_name    = serializers.CharField(source='company.name',           read_only=True)
    company_trn     = serializers.CharField(source='company.trn',            read_only=True)
    status_display  = serializers.CharField(source='get_status_display',     read_only=True)
    type_display    = serializers.CharField(source='get_invoice_type_display', read_only=True)
    is_editable     = serializers.BooleanField(read_only=True)
    is_submittable  = serializers.BooleanField(read_only=True)
    is_cancellable  = serializers.BooleanField(read_only=True)
    items           = serializers.SerializerMethodField()
    item_count      = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'type_display',
            'transaction_type', 'status', 'status_display',
            # Parties
            'company_name', 'company_trn',
            'customer', 'customer_name', 'customer_trn',
            # Dates
            'issue_date', 'due_date', 'supply_date', 'supply_date_end',
            # Continuous supply
            'contract_reference',
            # Financial
            'currency', 'exchange_rate',
            'subtotal', 'discount_amount', 'taxable_amount', 'total_vat', 'total_amount',
            # Payment
            'payment_means_code',
            # References
            'reference_number', 'purchase_order_number',
            # XML / ASP
            'xml_file', 'xml_generated_at',
            'asp_submission_id', 'asp_submitted_at',
            # Items
            'items', 'item_count',
            # Flags
            'is_editable', 'is_submittable', 'is_cancellable',
            # Meta
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'invoice_number', 'subtotal', 'taxable_amount',
            'total_vat', 'total_amount', 'xml_file', 'xml_generated_at',
            'asp_submission_id', 'asp_submitted_at', 'asp_response',
            'created_at', 'updated_at',
        ]

    def get_items(self, obj):
        return InvoiceItemSerializer(
            obj.items.filter(is_active=True).order_by('sort_order'), many=True
        ).data

    def get_item_count(self, obj) -> int:
        return obj.items.filter(is_active=True).count()


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (excludes items)."""

    customer_name   = serializers.CharField(source='customer.name', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    type_display    = serializers.CharField(source='get_invoice_type_display', read_only=True)
    item_count      = serializers.SerializerMethodField()
    has_xml         = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'type_display',
            'status', 'status_display', 'customer', 'customer_name',
            'issue_date', 'due_date', 'currency',
            'subtotal', 'total_vat', 'total_amount',
            'item_count', 'has_xml', 'created_at',
        ]

    def get_item_count(self, obj) -> int:
        return obj.items.filter(is_active=True).count()

    def get_has_xml(self, obj) -> bool:
        return bool(obj.xml_file)


# ─── Invoice Create / Update ──────────────────────────────────────────────────

class InvoiceCreateSerializer(serializers.Serializer):
    """Validates input for creating a new invoice (optionally with items)."""

    company_id       = serializers.UUIDField()
    customer_id      = serializers.UUIDField()
    invoice_type     = serializers.ChoiceField(
        choices=[c[0] for c in INVOICE_TYPE_CHOICES],
        default='tax_invoice'
    )
    transaction_type = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES],
        default='b2b'
    )
    issue_date          = serializers.DateField(required=False)
    due_date            = serializers.DateField(required=False)
    supply_date         = serializers.DateField(required=False)
    supply_date_end     = serializers.DateField(required=False, allow_null=True)
    contract_reference  = serializers.CharField(max_length=200, required=False, default='')
    currency         = serializers.ChoiceField(
        choices=[c[0] for c in CURRENCY_CHOICES],
        default='AED'
    )
    discount_amount  = serializers.DecimalField(
        max_digits=15, decimal_places=2,
        min_value=Decimal('0.00'),
        default=Decimal('0.00'),
        required=False
    )
    payment_means_code     = serializers.ChoiceField(
        choices=[c[0] for c in PAYMENT_MEANS_CHOICES],
        default='30',
        required=False,
        help_text='UN/ECE UNCL 4461 payment means code (30=Credit Transfer, 10=Cash, etc.).'
    )
    reference_number       = serializers.CharField(max_length=100, required=False, default='')
    purchase_order_number  = serializers.CharField(max_length=100, required=False, default='')
    notes                  = serializers.CharField(required=False, default='')

    # Optional: create items in the same request
    items = serializers.ListField(
        child=InvoiceItemCreateSerializer(),
        required=False,
        default=list,
        help_text='Optional list of line items to create with the invoice.'
    )

    def validate(self, attrs):
        invoice_type = attrs.get('invoice_type', '')

        if invoice_type == INVOICE_TYPE_CREDIT_NOTE and not attrs.get('reference_number'):
            raise serializers.ValidationError({
                'reference_number': 'Credit notes must include the original invoice number.'
            })

        if invoice_type == INVOICE_TYPE_CONTINUOUS:
            if not attrs.get('supply_date'):
                raise serializers.ValidationError({
                    'supply_date': 'Continuous supplies require a supply period start date.'
                })
            if not attrs.get('supply_date_end'):
                raise serializers.ValidationError({
                    'supply_date_end': 'Continuous supplies require a supply period end date.'
                })

        return attrs


class InvoiceUpdateSerializer(serializers.Serializer):
    """Update invoice header fields (only DRAFT invoices)."""

    customer_id            = serializers.UUIDField(required=False)
    invoice_type           = serializers.ChoiceField(
        choices=[c[0] for c in INVOICE_TYPE_CHOICES], required=False
    )
    transaction_type       = serializers.ChoiceField(
        choices=[c[0] for c in TRANSACTION_TYPE_CHOICES], required=False
    )
    issue_date             = serializers.DateField(required=False)
    due_date               = serializers.DateField(required=False)
    supply_date            = serializers.DateField(required=False)
    supply_date_end        = serializers.DateField(required=False, allow_null=True)
    contract_reference     = serializers.CharField(max_length=200, required=False)
    currency               = serializers.ChoiceField(
        choices=[c[0] for c in CURRENCY_CHOICES], required=False
    )
    discount_amount        = serializers.DecimalField(
        max_digits=15, decimal_places=2,
        min_value=Decimal('0.00'), required=False
    )
    payment_means_code     = serializers.ChoiceField(
        choices=[c[0] for c in PAYMENT_MEANS_CHOICES],
        required=False
    )
    reference_number       = serializers.CharField(max_length=100, required=False)
    purchase_order_number  = serializers.CharField(max_length=100, required=False)
    notes                  = serializers.CharField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        return attrs


# ─── List Filters ─────────────────────────────────────────────────────────────

class InvoiceFilterSerializer(serializers.Serializer):
    """Validates query params for the invoice list endpoint."""

    company_id    = serializers.UUIDField()
    status        = serializers.ChoiceField(
        choices=[c[0] for c in INVOICE_STATUS_CHOICES], required=False
    )
    customer_id   = serializers.UUIDField(required=False)
    invoice_type  = serializers.ChoiceField(
        choices=[c[0] for c in INVOICE_TYPE_CHOICES], required=False
    )
    date_from     = serializers.DateField(required=False)
    date_to       = serializers.DateField(required=False)
    search        = serializers.CharField(required=False, default='')
