from apps.common.constants import (
    ROLE_ADMIN,
    ROLE_SUPPLIER,
    ROLE_ACCOUNTANT,
    ROLE_VIEWER,
    ROLE_INBOUND_SUPPLIER,
    ROLE_BUYER,
)

from apps.companies.models import CompanyMember
# Roles that are allowed to use the AI Assistant at all. Buyers and inbound
# suppliers have their own separate portals — the assistant is not exposed
# there yet, so they are intentionally excluded here.

AI_ASSISTANT_ALLOWED_ROLES = {
    ROLE_ADMIN,
    ROLE_SUPPLIER,
    ROLE_ACCOUNTANT,
    ROLE_VIEWER,
}


def get_user_role(user,company)->str | None :    
    """
    Resolve a user's role for a specific company by looking up their
    CompanyMember record — the same source of truth every other part of
    the platform already uses. Returns None if the user is not an active
    member of this company (which the caller must treat as "no access").
    """
    membership = (
        CompanyMember.objects
        .filter(user=user,company=company,is_active=True)
        .first())
    
    if membership is None:
        return None
    return membership.role


def user_can_use_ai_assistant(user,company)->bool:
    """
    True only if the user is an active member of `company` AND their role
    is one the AI Assistant is enabled for.
    """
    role = get_user_role(user,company)
    return role in AI_ASSISTANT_ALLOWED_ROLES


def get_assistant_view_type(role: str) -> str:
    """
    Maps a CompanyMember role onto which frontend view/tool-set the
    assistant should use. Admin and Accountant currently share the admin
    view; Supplier gets the focused supplier view; Viewer gets a read-only
    variant of the supplier view.
    """
    if role == ROLE_ADMIN:
        return 'admin'
    if role == ROLE_ACCOUNTANT:
        return 'admin'
    if role == ROLE_SUPPLIER:
        return 'supplier'
    if role == ROLE_VIEWER:
        return 'supplier_readonly'
    return 'unauthorized'