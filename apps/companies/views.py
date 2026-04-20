"""
Companies API views.

Thin controllers — validate input, resolve objects, call services, return responses.

URL structure:
  /api/v1/companies/                          list + create
  /api/v1/companies/{id}/                     retrieve + update + deactivate
  /api/v1/companies/{id}/members/             list + add member
  /api/v1/companies/{id}/members/{member_id}/ update role + remove
"""
import logging
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response
from .models import Company, CompanyMember
from .serializers import (
    CompanySerializer,
    CompanyCreateSerializer,
    CompanyUpdateSerializer,
    CompanyMemberSerializer,
    AddMemberSerializer,
    ChangeMemberRoleSerializer,
)
from .services import CompanyService
from .permissions import IsCompanyMember, IsCompanyAdmin, IsCompanyAdminOrReadOnly

logger = logging.getLogger(__name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _get_company_and_membership(request, company_id: str):
    """
    Resolve company by id and verify requesting user is an active member.
    Returns (company, membership) tuple.
    Sets request.company_membership for permission classes.
    """
    company = get_object_or_404(Company, id=company_id, is_active=True)
    membership = get_object_or_404(
        CompanyMember,
        company=company,
        user=request.user,
        is_active=True,
    )
    request.company = company
    request.company_membership = membership
    return company, membership


# ─── Company List / Create ────────────────────────────────────────────────────

class CompanyListCreateView(APIView):
    """
    GET  /api/v1/companies/  — List all companies the user is a member of
    POST /api/v1/companies/  — Create a new company (user becomes admin automatically)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Admins see ALL active companies on the platform
        if request.user.role == 'admin':
            from apps.companies.models import Company as _Company
            companies = _Company.objects.filter(is_active=True).order_by('name')
        else:
            companies = CompanyService.get_user_companies(request.user)
        serializer = CompanySerializer(companies, many=True)
        return success_response(data=serializer.data)

    def post(self, request):
        serializer = CompanyCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Company creation failed.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        company = CompanyService.create_company(
            requesting_user=request.user,
            data=serializer.validated_data,
        )
        return success_response(
            data=CompanySerializer(company).data,
            message='Company created successfully.',
            status_code=status.HTTP_201_CREATED
        )


# ─── Company Detail / Update / Deactivate ────────────────────────────────────

class CompanyDetailView(APIView):
    """
    GET    /api/v1/companies/{id}/  — Get company details (any member)
    PUT    /api/v1/companies/{id}/  — Update company (admin only)
    DELETE /api/v1/companies/{id}/  — Soft-delete company (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        company, _ = _get_company_and_membership(request, company_id)
        return success_response(data=CompanySerializer(company).data)

    def put(self, request, company_id):
        company, membership = _get_company_and_membership(request, company_id)

        if not membership.is_admin:
            return error_response(
                message='Only company admins can update company details.',
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = CompanyUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Company update failed.',
                details=serializer.errors
            )

        company = CompanyService.update_company(company, serializer.validated_data)
        return success_response(
            data=CompanySerializer(company).data,
            message='Company updated successfully.'
        )

    def delete(self, request, company_id):
        company, membership = _get_company_and_membership(request, company_id)

        if not membership.is_admin:
            return error_response(
                message='Only company admins can deactivate a company.',
                status_code=status.HTTP_403_FORBIDDEN
            )

        CompanyService.deactivate_company(company)
        return success_response(message='Company deactivated successfully.')


# ─── Member List / Add ────────────────────────────────────────────────────────

class CompanyMemberListView(APIView):
    """
    GET  /api/v1/companies/{id}/members/  — List all active members (any member)
    POST /api/v1/companies/{id}/members/  — Add a member (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        company, _ = _get_company_and_membership(request, company_id)
        members = company.members.filter(is_active=True).select_related('user')
        serializer = CompanyMemberSerializer(members, many=True)
        return success_response(data=serializer.data)

    def post(self, request, company_id):
        company, membership = _get_company_and_membership(request, company_id)

        serializer = AddMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Add member failed.',
                details=serializer.errors
            )

        # Note: validate_user_email already resolved email → User instance
        target_user = serializer.validated_data['user_email']
        role = serializer.validated_data['role']

        new_membership = CompanyService.add_member(
            company=company,
            requesting_member=membership,
            target_user=target_user,
            role=role,
        )
        return success_response(
            data=CompanyMemberSerializer(new_membership).data,
            message='Member added successfully.',
            status_code=status.HTTP_201_CREATED
        )


# ─── Member Detail / Role Change / Remove ────────────────────────────────────

class CompanyMemberDetailView(APIView):
    """
    PUT    /api/v1/companies/{id}/members/{member_id}/  — Change member role
    DELETE /api/v1/companies/{id}/members/{member_id}/  — Remove member
    """
    permission_classes = [IsAuthenticated]

    def _get_target_membership(self, company, member_id: str) -> CompanyMember:
        return get_object_or_404(
            CompanyMember,
            id=member_id,
            company=company,
            is_active=True,
        )

    def put(self, request, company_id, member_id):
        company, membership = _get_company_and_membership(request, company_id)
        target = self._get_target_membership(company, member_id)

        serializer = ChangeMemberRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Role change failed.',
                details=serializer.errors
            )

        updated = CompanyService.change_member_role(
            requesting_member=membership,
            target_membership=target,
            new_role=serializer.validated_data['role'],
        )
        return success_response(
            data=CompanyMemberSerializer(updated).data,
            message='Member role updated.'
        )

    def delete(self, request, company_id, member_id):
        company, membership = _get_company_and_membership(request, company_id)
        target = self._get_target_membership(company, member_id)

        CompanyService.remove_member(
            company=company,
            requesting_member=membership,
            target_membership=target,
        )
        return success_response(message='Member removed from company.')
