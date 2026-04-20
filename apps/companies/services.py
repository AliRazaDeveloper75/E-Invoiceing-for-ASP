"""
Companies service layer.

All business logic lives here. Views call services; services own the rules.
"""
import logging
from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from .models import Company, CompanyMember

User = get_user_model()
logger = logging.getLogger(__name__)


class CompanyService:
    """Handles company creation, updates, member management."""

    # ── Company CRUD ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def create_company(requesting_user: User, data: dict) -> Company:
        """
        Create a new company and automatically add the creator as an admin member.

        Uses atomic transaction: company + membership are created together,
        or neither is created (prevents orphaned companies with no admin).
        """
        trn = data.get('trn', '').strip()

        if Company.objects.filter(trn=trn).exists():
            raise ValidationError({'trn': 'A company with this TRN already exists.'})

        company = Company.objects.create(
            name=data['name'].strip(),
            legal_name=data.get('legal_name', data['name']).strip(),
            trn=trn,
            is_vat_group=data.get('is_vat_group', False),
            street_address=data.get('street_address', '').strip(),
            city=data.get('city', '').strip(),
            emirate=data.get('emirate', 'dubai'),
            po_box=data.get('po_box', '').strip(),
            country=data.get('country', 'AE').strip().upper(),
            phone=data.get('phone', '').strip(),
            email=data.get('email', '').strip(),
            website=data.get('website', '').strip(),
        )

        # Creator automatically becomes company admin
        CompanyMember.objects.create(
            company=company,
            user=requesting_user,
            role='admin',
        )

        logger.info(
            'Company created: %s (TRN: %s) by user: %s',
            company.name, company.trn, requesting_user.email
        )
        return company

    @staticmethod
    def update_company(company: Company, data: dict) -> Company:
        """
        Update allowed company fields.
        TRN cannot be changed after creation (immutable business identifier).
        """
        # TRN is immutable
        if 'trn' in data and data['trn'] != company.trn:
            raise ValidationError({'trn': 'TRN cannot be changed after company creation.'})

        updatable_fields = [
            'name', 'legal_name', 'street_address', 'city', 'emirate',
            'po_box', 'country', 'phone', 'email', 'website',
            'peppol_endpoint', 'is_vat_group',
        ]

        changed_fields = []
        for field in updatable_fields:
            if field in data:
                value = data[field]
                if isinstance(value, str):
                    value = value.strip()
                setattr(company, field, value)
                changed_fields.append(field)

        if changed_fields:
            company.save(update_fields=changed_fields + ['updated_at'])

        logger.info('Company updated: %s — fields: %s', company.name, changed_fields)
        return company

    @staticmethod
    def deactivate_company(company: Company) -> Company:
        """Soft-delete a company (is_active=False)."""
        company.is_active = False
        company.save(update_fields=['is_active', 'updated_at'])
        logger.warning('Company deactivated: %s (TRN: %s)', company.name, company.trn)
        return company

    # ── Membership Management ─────────────────────────────────────────────────

    @staticmethod
    def get_user_companies(user: User):
        """Return all active companies the user is a member of."""
        return Company.objects.filter(
            members__user=user,
            members__is_active=True,
            is_active=True,
        ).distinct()

    @staticmethod
    def get_membership(company: Company, user: User) -> CompanyMember:
        """
        Retrieve a user's active membership in a company.
        Raises NotFound if the user is not a member.
        """
        try:
            return CompanyMember.objects.get(
                company=company,
                user=user,
                is_active=True,
            )
        except CompanyMember.DoesNotExist:
            raise NotFound('User is not a member of this company.')

    @staticmethod
    def add_member(
        company: Company,
        requesting_member: CompanyMember,
        target_user: User,
        role: str = 'viewer',
    ) -> CompanyMember:
        """
        Add a user to a company with a given role.
        Only company admins can add members.
        """
        if not requesting_member.is_admin:
            raise PermissionDenied('Only company admins can add members.')

        if CompanyMember.objects.filter(company=company, user=target_user).exists():
            raise ValidationError({'user': 'This user is already a member of the company.'})

        membership = CompanyMember.objects.create(
            company=company,
            user=target_user,
            role=role,
        )
        logger.info(
            'Member added: %s to company %s with role %s (by %s)',
            target_user.email, company.name, role, requesting_member.user.email
        )
        return membership

    @staticmethod
    def remove_member(
        company: Company,
        requesting_member: CompanyMember,
        target_membership: CompanyMember,
    ) -> None:
        """
        Remove a user from a company.
        Only company admins can remove members.
        Cannot remove yourself if you are the only admin.
        """
        if not requesting_member.is_admin:
            raise PermissionDenied('Only company admins can remove members.')

        # Guard: cannot remove the last admin
        is_self = requesting_member.id == target_membership.id
        if is_self or target_membership.role == 'admin':
            admin_count = CompanyMember.objects.filter(
                company=company, role='admin', is_active=True
            ).count()
            if admin_count <= 1:
                raise ValidationError(
                    {'detail': 'Cannot remove the only admin. Assign another admin first.'}
                )

        target_membership.is_active = False
        target_membership.save(update_fields=['is_active', 'updated_at'])
        logger.info(
            'Member removed: %s from company %s (by %s)',
            target_membership.user.email, company.name, requesting_member.user.email
        )

    @staticmethod
    def change_member_role(
        requesting_member: CompanyMember,
        target_membership: CompanyMember,
        new_role: str,
    ) -> CompanyMember:
        """
        Change a member's role within the company.
        Only admins can change roles.
        Cannot demote yourself if you're the only admin.
        """
        if not requesting_member.is_admin:
            raise PermissionDenied('Only company admins can change member roles.')

        is_self_demotion = (
            requesting_member.id == target_membership.id
            and new_role != 'admin'
        )
        if is_self_demotion:
            admin_count = CompanyMember.objects.filter(
                company=requesting_member.company,
                role='admin',
                is_active=True,
            ).count()
            if admin_count <= 1:
                raise ValidationError(
                    {'detail': 'Cannot demote yourself — you are the only admin.'}
                )

        target_membership.role = new_role
        target_membership.save(update_fields=['role', 'updated_at'])
        logger.info(
            'Role changed for %s in %s: → %s (by %s)',
            target_membership.user.email,
            requesting_member.company.name,
            new_role,
            requesting_member.user.email,
        )
        return target_membership
