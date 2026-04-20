from django.contrib import admin
from .models import (
    Supplier,
    InboundInvoice,
    InboundInvoiceItem,
    InboundObservation,
    InboundAuditLog,
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display   = ['name', 'trn', 'email', 'receiving_company', 'api_key_prefix', 'is_active']
    search_fields  = ['name', 'trn', 'email']
    list_filter    = ['is_active', 'receiving_company']
    readonly_fields = ['api_key_prefix', 'api_key_hash', 'created_at', 'updated_at']


class InboundItemInline(admin.TabularInline):
    model        = InboundInvoiceItem
    extra        = 0
    fields       = ['line_number', 'description', 'quantity', 'unit_price', 'vat_rate', 'subtotal', 'total_amount']
    readonly_fields = ['subtotal', 'vat_amount', 'total_amount']


class ObservationInline(admin.TabularInline):
    model        = InboundObservation
    extra        = 0
    fields       = ['rule_code', 'severity', 'field_name', 'message', 'included_in_email']
    readonly_fields = ['rule_code', 'severity', 'field_name', 'message']


class AuditLogInline(admin.TabularInline):
    model           = InboundAuditLog
    extra           = 0
    fields          = ['timestamp', 'actor', 'from_status', 'to_status', 'event']
    readonly_fields = fields
    can_delete      = False


@admin.register(InboundInvoice)
class InboundInvoiceAdmin(admin.ModelAdmin):
    list_display    = [
        'supplier_invoice_number', 'supplier', 'receiving_company',
        'status', 'channel', 'received_at', 'validation_score', 'has_critical_errors',
    ]
    list_filter     = ['status', 'channel', 'invoice_type', 'has_critical_errors']
    search_fields   = ['supplier_invoice_number', 'supplier__name', 'supplier__trn']
    readonly_fields = [
        'validation_score', 'has_critical_errors', 'observation_count',
        'observation_sent_at', 'received_at', 'created_at', 'updated_at',
    ]
    inlines  = [InboundItemInline, ObservationInline, AuditLogInline]
    ordering = ['-received_at']
