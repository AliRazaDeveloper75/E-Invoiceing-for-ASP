"""Django admin for Invoice and InvoiceItem models."""
from django.contrib import admin
from .models import Invoice, InvoiceItem


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    fields = ('description', 'quantity', 'unit', 'unit_price', 'vat_rate_type',
              'vat_rate', 'subtotal', 'vat_amount', 'total_amount', 'is_active')
    readonly_fields = ('vat_rate', 'subtotal', 'vat_amount', 'total_amount')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'invoice_number', 'company', 'customer', 'invoice_type',
        'status', 'issue_date', 'total_amount', 'currency', 'created_at'
    )
    list_filter  = ('status', 'invoice_type', 'transaction_type', 'currency')
    search_fields = ('invoice_number', 'customer__name', 'company__name', 'reference_number')
    readonly_fields = (
        'id', 'invoice_number', 'invoice_sequence',
        'subtotal', 'taxable_amount', 'total_vat', 'total_amount',
        'xml_generated_at', 'asp_submission_id', 'asp_submitted_at',
        'created_at', 'updated_at',
    )
    list_select_related = ('company', 'customer')
    inlines = [InvoiceItemInline]

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'invoice_number', 'invoice_sequence', 'invoice_type',
                       'transaction_type', 'status')
        }),
        ('Parties', {
            'fields': ('company', 'customer', 'created_by')
        }),
        ('Dates', {
            'fields': ('issue_date', 'due_date', 'supply_date')
        }),
        ('Financial', {
            'fields': ('currency', 'exchange_rate', 'subtotal', 'discount_amount',
                       'taxable_amount', 'total_vat', 'total_amount')
        }),
        ('References', {
            'fields': ('reference_number', 'purchase_order_number')
        }),
        ('XML / ASP', {
            'fields': ('xml_file', 'xml_generated_at', 'asp_submission_id',
                       'asp_submitted_at', 'asp_response')
        }),
        ('Meta', {
            'fields': ('notes', 'is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'description', 'quantity', 'unit_price',
                    'vat_rate_type', 'vat_amount', 'total_amount', 'is_active')
    list_filter  = ('vat_rate_type', 'is_active')
    search_fields = ('description', 'invoice__invoice_number')
    readonly_fields = ('id', 'vat_rate', 'subtotal', 'vat_amount', 'total_amount',
                       'created_at', 'updated_at')
