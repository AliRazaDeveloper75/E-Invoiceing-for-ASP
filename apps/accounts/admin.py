"""
Django admin registration for the User model.
Accessible at /admin/ — only for is_staff=True users.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom User admin: uses email instead of username.
    Shows role, date_joined, and is_active in the list view.
    """

    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    readonly_fields = ('id', 'date_joined', 'last_login')

    fieldsets = (
        (None, {
            'fields': ('id', 'email', 'password')
        }),
        (_('Personal Info'), {
            'fields': ('first_name', 'last_name', 'role')
        }),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        (_('Dates'), {
            'fields': ('date_joined', 'last_login')
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )

    # Replace 'username' with 'email' for BaseUserAdmin compatibility
    filter_horizontal = ('groups', 'user_permissions')
