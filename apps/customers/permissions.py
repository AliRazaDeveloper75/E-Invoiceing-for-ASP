"""
Customer-level permission helpers.

Customers reuse the company-scoped membership model.
These helpers are thin wrappers that resolve membership for customer views.
"""
from apps.companies.models import Company, CompanyMember


def get_company_and_membership(user, company_id: str):
    """
    Resolve company by id and return (Company, CompanyMember) for the user.
    Returns (None, None) if company doesn't exist or user is not a member.
    """
    try:
        company = Company.objects.get(id=company_id, is_active=True)
        membership = CompanyMember.objects.get(
            company=company,
            user=user,
            is_active=True,
        )
        return company, membership
    except (Company.DoesNotExist, CompanyMember.DoesNotExist):
        return None, None
