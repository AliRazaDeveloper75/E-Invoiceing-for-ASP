"""
Inbound invoice serializers — supplier submission + internal review APIs.
"""
from decimal import Decimal
from rest_framework import serializers

from .models import (
    Supplier,
    InboundInvoice,
    InboundInvoiceItem,
    InboundObservation,
    InboundAuditLog,
)


# ─── Supplier ─────────────────────────────────────────────────────────────────

class SupplierSerializer(serializers.ModelSerializer):
    receiving_company_name = serializers.CharField(source='receiving_company.name', read_only=True)

    class Meta:
        model  = Supplier
        fields = [
            'id', 'name', 'trn', 'email', 'phone', 'address',
            'receiving_company', 'receiving_company_name',
            'api_key_prefix', 'whitelisted_email',
            'notes', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'api_key_prefix', 'created_at']


class SupplierCreateSerializer(serializers.Serializer):
    name              = serializers.CharField(max_length=255)
    trn               = serializers.CharField(max_length=15)
    email             = serializers.EmailField()
    phone             = serializers.CharField(max_length=30, required=False, default='')
    address           = serializers.CharField(required=False, default='')
    receiving_company = serializers.UUIDField()
    whitelisted_email = serializers.EmailField(required=False, allow_blank=True, default='')
    notes             = serializers.CharField(required=False, default='')

    def validate_trn(self, value):
        if not value.isdigit() or len(value) != 15:
            raise serializers.ValidationError('TRN must be exactly 15 numeric digits.')
        return value


class SupplierActivateSerializer(serializers.Serializer):
    supplier_id = serializers.UUIDField()
    token       = serializers.UUIDField()
    password    = serializers.CharField(min_length=8, write_only=True)


# ─── Inbound Item ─────────────────────────────────────────────────────────────

class InboundItemSubmitSerializer(serializers.Serializer):
    """Used during supplier submission — validates line item payload."""
    line_number  = serializers.IntegerField(min_value=1, default=1)
    description  = serializers.CharField(max_length=500)
    quantity     = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal('0.0001'))
    unit         = serializers.CharField(max_length=20, default='', allow_blank=True)
    unit_price   = serializers.DecimalField(max_digits=15, decimal_places=4, min_value=Decimal('0'))
    vat_rate     = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal('5.00'))


class InboundItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InboundInvoiceItem
        fields = [
            'id', 'line_number', 'description', 'quantity', 'unit',
            'unit_price', 'vat_rate', 'vat_amount', 'subtotal', 'total_amount',
        ]


# ─── Observation ─────────────────────────────────────────────────────────────

class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InboundObservation
        fields = [
            'id', 'rule_code', 'severity', 'field_name',
            'message', 'suggestion', 'line_number', 'included_in_email',
        ]


# ─── Audit Log ───────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model  = InboundAuditLog
        fields = [
            'id', 'timestamp', 'actor_name',
            'from_status', 'to_status', 'event', 'detail',
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.email
        return 'System'


# ─── Inbound Invoice (supplier submit) ───────────────────────────────────────

class InboundInvoiceSubmitSerializer(serializers.Serializer):
    """
    Payload expected from a supplier submitting an invoice via POST /api/v1/inbound/submit/.
    """
    supplier_invoice_number = serializers.CharField(max_length=100)
    invoice_type            = serializers.ChoiceField(choices=[
        'tax_invoice', 'credit_note', 'commercial_invoice',
        'continuous_supply', 'simplified',
    ], default='tax_invoice')
    transaction_type        = serializers.ChoiceField(
        choices=['b2b', 'b2g', 'b2c'], default='b2b'
    )
    issue_date              = serializers.DateField()
    due_date                = serializers.DateField(required=False, allow_null=True)
    supply_date             = serializers.DateField(required=False, allow_null=True)
    currency                = serializers.ChoiceField(
        choices=['AED', 'USD', 'EUR'], default='AED'
    )
    subtotal                = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_vat               = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_amount            = serializers.DecimalField(max_digits=15, decimal_places=2)
    purchase_order_ref      = serializers.CharField(max_length=100, default='', allow_blank=True)
    contract_ref            = serializers.CharField(max_length=200, default='', allow_blank=True)
    notes                   = serializers.CharField(default='', allow_blank=True)
    items                   = InboundItemSubmitSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('At least one line item is required.')
        return value


# ─── Inbound Invoice (list / detail for internal team) ───────────────────────

class InboundInvoiceListSerializer(serializers.ModelSerializer):
    supplier_name     = serializers.CharField(source='supplier.name', read_only=True)
    supplier_trn      = serializers.CharField(source='supplier.trn', read_only=True)
    company_name      = serializers.CharField(source='receiving_company.name', read_only=True)
    observation_count = serializers.IntegerField(read_only=True)

    class Meta:
        model  = InboundInvoice
        fields = [
            'id', 'supplier_name', 'supplier_trn', 'company_name',
            'supplier_invoice_number', 'invoice_type', 'transaction_type',
            'issue_date', 'currency', 'total_amount', 'total_vat',
            'status', 'channel', 'received_at',
            'validation_score', 'has_critical_errors', 'observation_count',
        ]


class InboundInvoiceDetailSerializer(serializers.ModelSerializer):
    supplier          = SupplierSerializer(read_only=True)
    company_name      = serializers.CharField(source='receiving_company.name', read_only=True)
    items             = InboundItemSerializer(many=True, read_only=True)
    observations      = ObservationSerializer(many=True, read_only=True)
    audit_log         = AuditLogSerializer(many=True, read_only=True)
    reviewed_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = InboundInvoice
        fields = [
            'id', 'supplier', 'company_name', 'channel', 'received_at',
            'status', 'supplier_invoice_number', 'invoice_type',
            'transaction_type', 'issue_date', 'due_date', 'supply_date',
            'currency', 'subtotal', 'total_vat', 'total_amount',
            'purchase_order_ref', 'contract_ref', 'notes',
            'validation_score', 'has_critical_errors', 'observation_count',
            'observation_sent_at',
            'reviewed_by_name', 'reviewed_at', 'reviewer_notes',
            'fta_submission_id', 'fta_submitted_at', 'fta_response',
            'items', 'observations', 'audit_log',
        ]

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.email
        return None


# ─── Review action serializers ────────────────────────────────────────────────

class ReviewApproveSerializer(serializers.Serializer):
    reviewer_notes = serializers.CharField(default='', allow_blank=True)


class ReviewRejectSerializer(serializers.Serializer):
    reviewer_notes = serializers.CharField(required=True, min_length=1)


class ResendObservationSerializer(serializers.Serializer):
    """Trigger re-sending the observation email to the supplier."""
    custom_message = serializers.CharField(default='', allow_blank=True)
