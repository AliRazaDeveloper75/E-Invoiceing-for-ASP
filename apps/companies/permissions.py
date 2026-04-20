"""
Company-scoped permission classes.

These permissions check membership in a specific company,
not just the platform-level role on the User model.

Usage pattern in views:
    # 1. Get the company from URL kwargs
    # 2. Check membership via get_membership() helper
    # 3. Apply permission based on membership.role
"""
from rest_framework.permissions import BasePermission

from .models import CompanyMember


def get_company_membership(user, company) -> CompanyMember | None:
    """
    Return the user's active membership in this company, or None.
    Helper used by permission classes and views.
    """
    try:
        return CompanyMember.objects.get(
            company=company,
            user=user,
            is_active=True,
        )
    except CompanyMember.DoesNotExist:
        return None


class IsCompanyMember(BasePermission):
    """
    Allow access only if the requesting user is an active member
    of the company identified by view.kwargs['company_id'].

    Attach the membership to the request for downstream use:
        request.company_membership
    """
    message = 'You are not a member of this company.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        company = getattr(view, 'company', None)
        if company is None:
            return False

        membership = get_company_membership(request.user, company)
        if membership is None:
            return False

        # Attach to request so views don't need to re-query
        request.company_membership = membership
        return True


class IsCompanyAdmin(BasePermission):
    """
    Allow access only if the user is an admin member of the company.
    Requires IsCompanyMember to run first (sets request.company_membership).
    """
    message = 'Company admin role required.'

    def has_permission(self, request, view):
        membership = getattr(request, 'company_membership', None)
        if membership is None:
            return False
        return membership.is_admin


class IsCompanyAccountant(BasePermission):
    """
    Allow access to company admin or accountant members.
    Requires IsCompanyMember to run first.
    """
    message = 'Company accountant or admin role required.'

    def has_permission(self, request, view):
        membership = getattr(request, 'company_membership', None)
        if membership is None:
            return False
        return membership.role in ('admin', 'accountant')


class IsCompanyAdminOrReadOnly(BasePermission):
    """
    Members can read; only admins can write.
    Requires IsCompanyMember to run first.
    """
    message = 'Company admin role required for write operations.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        membership = getattr(request, 'company_membership', None)
        if membership is None:
            return False
        return membership.is_admin
