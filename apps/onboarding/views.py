"""
Onboarding API views.

Public (no auth):
  GET  /api/v1/onboarding/invite/validate/?token=xxx  — check token, prefill form
  POST /api/v1/onboarding/invite/accept/              — submit full registration

Admin (IsAuthenticated + role=admin):
  GET  /api/v1/onboarding/invitations/                — list all invitations
  POST /api/v1/onboarding/invitations/                — create & send invitation
  DELETE /api/v1/onboarding/invitations/:id/          — revoke invitation
  GET  /api/v1/onboarding/review/                     — list companies pending review
  POST /api/v1/onboarding/review/:company_id/         — approve / reject / request-changes
  GET  /api/v1/onboarding/review/:company_id/docs/    — list company documents
"""
import logging
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.common.utils import success_response, error_response
from apps.companies.models import Company
from .models import CompanyInvitation, OnboardingDocument
from .serializers import (
    CompanyInvitationSerializer,
    CreateInvitationSerializer,
    AcceptInvitationSerializer,
    OnboardingDocumentSerializer,
    ReviewCompanySerializer,
    OnboardingCompanySerializer,
)
from .services import InvitationService, OnboardingService

logger = logging.getLogger(__name__)


def _require_admin(request):
    if not request.user or request.user.role != 'admin':
        return error_response('Admin access required.', status_code=status.HTTP_403_FORBIDDEN)
    return None


# ─── Public: validate token ───────────────────────────────────────────────────

class ValidateInviteTokenView(APIView):
    """GET /api/v1/onboarding/invite/validate/?token=<uuid>"""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '').strip()
        if not token:
            return error_response('token is required.', status_code=400)
        try:
            invite = InvitationService.validate_token(token)
        except ValueError as exc:
            return error_response(str(exc), status_code=400)

        return success_response(data={
            'valid': True,
            'email': invite.email,
            'first_name': invite.first_name,
            'last_name': invite.last_name,
            'company_name_hint': invite.company_name_hint,
            'role': invite.role,
            'message': invite.message,
            'invited_by': invite.invited_by.full_name if invite.invited_by else None,
            'expires_at': invite.expires_at.isoformat(),
        })


# ─── Public: accept invitation ────────────────────────────────────────────────

class AcceptInviteView(APIView):
    """
    POST /api/v1/onboarding/invite/accept/

    Multipart form — accepts both JSON fields and file uploads.
    Files keyed as:
      logo             (optional image)
      doc_0_file, doc_0_type, doc_0_notes
      doc_1_file, doc_1_type, ...
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Registration failed.',
                details=serializer.errors,
                status_code=400,
            )

        d = serializer.validated_data

        account_data = {
            'first_name': d['first_name'],
            'last_name':  d['last_name'],
            'password':   d['password'],
        }

        company_data = {
            'name':                  d['company_name'],
            'legal_name':            d.get('company_legal_name') or d['company_name'],
            'trn':                   d['trn'],
            'trade_license_number':  d.get('trade_license_number', ''),
            'business_type':         d.get('business_type', ''),
            'industry_type':         d.get('industry_type', ''),
            'street_address':        d.get('street_address', ''),
            'city':                  d.get('city', ''),
            'emirate':               d.get('emirate', 'dubai'),
            'po_box':                d.get('po_box', ''),
            'country':               d.get('country', 'AE'),
            'phone':                 d.get('company_phone', ''),
            'company_email':         d.get('company_email', ''),
            'website':               d.get('website', ''),
            'contact_person_name':   d.get('contact_person_name', ''),
            'contact_person_email':  d.get('contact_person_email', ''),
            'contact_person_phone':  d.get('contact_person_phone', ''),
            'logo':                  request.FILES.get('logo'),
        }

        # Collect uploaded documents (doc_0_file, doc_1_file, …)
        documents = []
        i = 0
        while f'doc_{i}_file' in request.FILES:
            documents.append({
                'file':          request.FILES[f'doc_{i}_file'],
                'document_type': request.data.get(f'doc_{i}_type', 'other'),
                'notes':         request.data.get(f'doc_{i}_notes', ''),
            })
            i += 1

        # At least one verification document is mandatory — a profile must not be
        # created without supporting documents (Trade License, TRN certificate, …).
        if not documents:
            return error_response(
                message='Registration failed.',
                details={'documents': ['At least one verification document is required to create your profile.']},
                status_code=400,
            )

        try:
            user, company, access, refresh = OnboardingService.accept_invitation(
                token=str(d['token']),
                account_data=account_data,
                company_data=company_data,
                documents=documents,
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=400)
        except Exception as exc:
            logger.exception('Onboarding failed: %s', exc)
            return error_response('Registration failed. Please try again.', status_code=500)

        from apps.accounts.serializers import UserSerializer
        from apps.companies.serializers import CompanySerializer
        return success_response(
            data={
                'user':    UserSerializer(user).data,
                'company': CompanySerializer(company, context={'request': request}).data,
                'tokens':  {'access': access, 'refresh': refresh},
            },
            message='Registration successful! Your company is under review.',
            status_code=201,
        )


# ─── Admin: invitation management ─────────────────────────────────────────────

class InvitationListCreateView(APIView):
    """
    GET  /api/v1/onboarding/invitations/  — list all invitations
    POST /api/v1/onboarding/invitations/  — create & email a new invitation
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        qs = CompanyInvitation.objects.select_related('invited_by').order_by('-created_at')
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return success_response(data=CompanyInvitationSerializer(qs, many=True).data)

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        serializer = CreateInvitationSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid data.', details=serializer.errors, status_code=400)
        d = serializer.validated_data
        invitation = InvitationService.create(
            email=d['email'],
            invited_by=request.user,
            first_name=d.get('first_name', ''),
            last_name=d.get('last_name', ''),
            company_name_hint=d.get('company_name_hint', ''),
            role=d.get('role', 'supplier'),
            message=d.get('message', ''),
        )
        return success_response(
            data=CompanyInvitationSerializer(invitation).data,
            message='Invitation sent successfully.',
            status_code=201,
        )


class InvitationDetailView(APIView):
    """DELETE /api/v1/onboarding/invitations/:id/  — revoke"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, invitation_id):
        err = _require_admin(request)
        if err:
            return err
        invitation = get_object_or_404(CompanyInvitation, id=invitation_id)
        if invitation.status != 'pending':
            return error_response(
                f'Cannot revoke an invitation with status "{invitation.status}".',
                status_code=400,
            )
        InvitationService.revoke(invitation, request.user)
        return success_response(message='Invitation revoked.')


class ResendInvitationView(APIView):
    """POST /api/v1/onboarding/invitations/:id/resend/  — resend email, reset expiry to 1h"""
    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id):
        err = _require_admin(request)
        if err:
            return err
        invitation = get_object_or_404(CompanyInvitation, id=invitation_id)
        if invitation.status == 'accepted':
            return error_response('Cannot resend — invitation already accepted.', status_code=400)
        if invitation.status == 'revoked':
            return error_response('Cannot resend a revoked invitation.', status_code=400)
        try:
            invitation = InvitationService.resend(invitation)
        except Exception as exc:
            return error_response(f'Failed to send email: {exc}', status_code=500)
        return success_response(
            data=CompanyInvitationSerializer(invitation).data,
            message='Invitation resent. Link valid for 1 hour.',
        )


class TrackEmailOpenView(APIView):
    """GET /api/v1/onboarding/invite/open/?token=xxx  — 1×1 tracking pixel"""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '').strip()
        if token:
            try:
                InvitationService.track_open(token)
            except Exception:
                pass
        # Return 1×1 transparent GIF
        import base64
        gif = base64.b64decode(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        )
        from django.http import HttpResponse
        response = HttpResponse(gif, content_type='image/gif')
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        return response


# ─── Admin: onboarding review ─────────────────────────────────────────────────

class OnboardingReviewListView(APIView):
    """GET /api/v1/onboarding/review/  — companies pending review"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        status_filter = request.query_params.get('status', 'submitted')
        qs = Company.objects.filter(
            onboarding_status__in=status_filter.split(',')
        ).prefetch_related('onboarding_documents').select_related(
            'onboarding_reviewed_by'
        ).order_by('-created_at')
        return success_response(
            data=OnboardingCompanySerializer(qs, many=True, context={'request': request}).data
        )


class OnboardingReviewDetailView(APIView):
    """POST /api/v1/onboarding/review/:company_id/  — approve / reject / request_changes"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id):
        err = _require_admin(request)
        if err:
            return err
        company = get_object_or_404(Company, id=company_id, is_active=True)
        serializer = ReviewCompanySerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid data.', details=serializer.errors, status_code=400)
        try:
            company = OnboardingService.review_company(
                company=company,
                action=serializer.validated_data['action'],
                notes=serializer.validated_data.get('notes', ''),
                reviewed_by=request.user,
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=400)
        return success_response(
            data=OnboardingCompanySerializer(company, context={'request': request}).data,
            message=f'Company {serializer.validated_data["action"]}d successfully.',
        )


class OnboardingDocumentListView(APIView):
    """GET /api/v1/onboarding/review/:company_id/docs/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        err = _require_admin(request)
        if err:
            return err
        company = get_object_or_404(Company, id=company_id, is_active=True)
        docs = OnboardingDocument.objects.filter(company=company, is_active=True)
        return success_response(data=OnboardingDocumentSerializer(docs, many=True).data)
