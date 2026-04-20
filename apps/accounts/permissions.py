"""
Role-based DRF permission classes.

Usage in views:
    permission_classes = [IsAuthenticated, IsAdmin]

Hierarchy:
    Admin > Supplier / Accountant > Viewer

Roles:
    admin      — full platform access: users, inbound, ASP/FTA, management
    supplier   — create & submit own outbound invoices only
    accountant — legacy alias for supplier (same permissions)
    viewer     — read-only

Per-company permissions (checking CompanyMember) will extend these in companies app.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated  # noqa: F401

# Roles that can create/edit invoices (outbound)
_INVOICE_WRITE_ROLES = ('admin', 'supplier', 'accountant')


class IsAdmin(BasePermission):
    """Allow access only to users with the 'admin' role."""
    message = 'Admin role required.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsSupplier(BasePermission):
    """
    Allow access to 'admin', 'supplier', or 'accountant' roles.
    Use for: creating/editing invoices, managing customers.
    """
    message = 'Supplier, Accountant, or Admin role required.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in _INVOICE_WRITE_ROLES
        )


# Keep IsAccountant as an alias so existing views don't break
class IsAccountant(IsSupplier):
    """Alias for IsSupplier — kept for backwards compatibility."""
    pass


class IsViewer(BasePermission):
    """
    Allow any authenticated user (all roles).
    Use for: read-only dashboard, reports.
    """
    message = 'Authentication required.'

    def has_permission(self, request, view):
        return request.user.is_authenticated


class IsAdminOrReadOnly(BasePermission):
    """
    Admin can write; others can only read.
    Use for: resources that authenticated users can view but only admins can modify.
    """
    message = 'Admin role required for write operations.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role == 'admin'


class IsAccountantOrReadOnly(BasePermission):
    """
    Admin/Supplier/Accountant can write; Viewers can only read.
    Use for: invoices (viewers can see but not create).
    """
    message = 'Supplier, Accountant, or Admin role required for write operations.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role in _INVOICE_WRITE_ROLES
