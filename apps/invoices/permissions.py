"""
Invoice permission helpers.
Reuses company membership resolution from the customers app pattern.
"""
from apps.companies.models import Company, CompanyMember


def get_company_and_membership(user, company_id: str):
    """Resolve Company + CompanyMember for a user. Returns (None, None) on failure."""
    try:
        company = Company.objects.get(id=company_id, is_active=True)
    except Company.DoesNotExist:
        return None, None
    if getattr(user, 'role', None) == 'admin' or getattr(user, 'is_staff', False):
        return company, None
    try:
        membership = CompanyMember.objects.get(
            company=company, user=user, is_active=True
        )
        return company, membership
    except CompanyMember.DoesNotExist:
        return None, None
