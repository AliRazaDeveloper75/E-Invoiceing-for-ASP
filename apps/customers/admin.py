"""
Django admin for Customer model.
"""
from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'company', 'customer_type', 'trn', 'tin',
        'country', 'is_peppol_connected', 'is_active', 'created_at'
    )
    list_filter = ('customer_type', 'country', 'is_active')
    search_fields = ('name', 'legal_name', 'trn', 'tin', 'email')
    readonly_fields = ('id', 'tin', 'created_at', 'updated_at')
    list_select_related = ('company',)

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'company', 'name', 'legal_name', 'customer_type')
        }),
        ('Tax Identification', {
            'fields': ('trn', 'tin', 'vat_number')
        }),
        ('PEPPOL', {
            'fields': ('peppol_endpoint',)
        }),
        ('Address', {
            'fields': ('street_address', 'city', 'state_province', 'postal_code', 'country')
        }),
        ('Contact', {
            'fields': ('email', 'phone')
        }),
        ('Notes & Status', {
            'fields': ('notes', 'is_active', 'created_at', 'updated_at')
        }),
    )
