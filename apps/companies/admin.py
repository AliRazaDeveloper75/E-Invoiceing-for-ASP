"""
Django admin for Company and CompanyMember models.
"""
from django.contrib import admin
from .models import Company, CompanyMember


class CompanyMemberInline(admin.TabularInline):
    """Show members inline on the Company admin page."""
    model = CompanyMember
    extra = 0
    fields = ('user', 'role', 'is_active')
    readonly_fields = ('created_at',)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'trn', 'tin', 'emirate', 'is_vat_group', 'is_active', 'created_at')
    list_filter = ('emirate', 'is_active', 'is_vat_group')
    search_fields = ('name', 'legal_name', 'trn', 'tin')
    readonly_fields = ('id', 'tin', 'created_at', 'updated_at')
    inlines = [CompanyMemberInline]

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'name', 'legal_name', 'trn', 'tin', 'is_vat_group', 'peppol_endpoint')
        }),
        ('UAE Address', {
            'fields': ('street_address', 'city', 'emirate', 'po_box', 'country')
        }),
        ('Contact', {
            'fields': ('phone', 'email', 'website')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'company', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'company__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
