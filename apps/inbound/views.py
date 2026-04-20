"""
Inbound invoice API views.

Endpoints:
  POST /api/v1/inbound/submit/                        Supplier submits invoice (API key auth)
  GET  /api/v1/inbound/                               List inbound invoices (internal team)
  GET  /api/v1/inbound/{id}/                          Retrieve detail (internal team)
  POST /api/v1/inbound/{id}/approve/                  Approve invoice
  POST /api/v1/inbound/{id}/reject/                   Reject invoice
  POST /api/v1/inbound/{id}/resend-observation/       Re-send observation email to supplier
  GET  /api/v1/inbound/stats/?company_id=<uuid>       Dashboard stats
"""
import logging
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.common.utils import success_response, error_response, StandardResultsPagination
from .models import (
    Supplier, InboundInvoice,
    INBOUND_STATUS_RECEIVED,
    INBOUND_STATUS_PENDING_REVIEW,
    INBOUND_STATUS_VALIDATION_FAILED,
    INBOUND_STATUS_APPROVED,
    INBOUND_STATUS_REJECTED,
)
from .serializers import (
    InboundInvoiceSubmitSerializer,
    InboundInvoiceListSerializer,
    InboundInvoiceDetailSerializer,
    ReviewApproveSerializer,
    ReviewRejectSerializer,
    ResendObservationSerializer,
    SupplierSerializer,
    SupplierCreateSerializer,
    SupplierActivateSerializer,
)

User = get_user_model()
from .services import InboundInvoiceService

logger = logging.getLogger(__name__)


# ─── Supplier Auth Mixin ──────────────────────────────────────────────────────

class SupplierAPIKeyAuthentication:
    """
    Resolves the supplier from the X-Supplier-Key header.
    Returns (supplier, error_response | None).
    """
    @staticmethod
    def resolve(request):
        api_key = request.headers.get('X-Supplier-Key', '').strip()
        if not api_key:
            return None, error_response(
                'Missing X-Supplier-Key header.', code='auth_required',
                status_code=status.HTTP_401_UNAUTHORIZED
            )

        prefix = api_key[:8]
        try:
            supplier = Supplier.objects.get(api_key_prefix=prefix, is_active=True)
        except Supplier.DoesNotExist:
            return None, error_response(
                'Invalid or unrecognised API key.',
                code='auth_failed',
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not supplier.verify_api_key(api_key):
            return None, error_response(
                'Invalid API key.',
                code='auth_failed',
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        return supplier, None


# ─── Supplier: Submit Invoice ─────────────────────────────────────────────────

class InboundSubmitView(APIView):
    """
    POST /api/v1/inbound/submit/
    Supplier-facing endpoint. Authenticated via X-Supplier-Key header.
    JWT authentication is NOT required here (suppliers don't have accounts).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        supplier, auth_error = SupplierAPIKeyAuthentication.resolve(request)
        if auth_error:
            return auth_error

        serializer = InboundInvoiceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Invalid submission payload.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            invoice = InboundInvoiceService.create_from_payload(
                supplier          = supplier,
                receiving_company = supplier.receiving_company,
                validated_data    = serializer.validated_data.copy(),
                channel           = 'api',
            )
        except Exception as exc:
            logger.exception('Error creating inbound invoice')
            return error_response(
                f'Could not store invoice: {exc}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Trigger async validation via Celery
        try:
            from .tasks import validate_inbound_invoice
            validate_inbound_invoice.delay(str(invoice.id))
        except Exception:
            # Celery not available — run synchronously (dev mode)
            logger.warning('Celery unavailable — running validation synchronously.')
            InboundInvoiceService.run_validation(invoice)

        return success_response(
            {
                'inbound_invoice_id': str(invoice.id),
                'status': invoice.status,
                'message': (
                    'Invoice received and queued for validation. '
                    'You will be notified by email if any observations are found.'
                ),
            },
            status_code=status.HTTP_202_ACCEPTED,
        )


# ─── Internal: List ───────────────────────────────────────────────────────────

class InboundInvoiceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = InboundInvoice.objects.select_related('supplier', 'receiving_company').all()

        # Inbound suppliers only see their own invoices
        if request.user.role == 'inbound_supplier':
            try:
                supplier = Supplier.objects.get(user=request.user)
                qs = qs.filter(supplier=supplier)
            except Supplier.DoesNotExist:
                return success_response([])

        # Filter by company (admin/internal use)
        company_id = request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(receiving_company_id=company_id)

        # Filter by status
        inv_status = request.query_params.get('status')
        if inv_status:
            qs = qs.filter(status=inv_status)

        # Filter by supplier
        supplier_id = request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        # Search by invoice number
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(supplier_invoice_number__icontains=search)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = InboundInvoiceListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ─── Internal: Detail ─────────────────────────────────────────────────────────

class InboundInvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_invoice(self, pk: str):
        try:
            return InboundInvoice.objects.select_related(
                'supplier', 'receiving_company', 'reviewed_by'
            ).prefetch_related(
                'items', 'observations', 'audit_log__actor'
            ).get(pk=pk)
        except InboundInvoice.DoesNotExist:
            return None

    def get(self, request, pk: str):
        invoice = self._get_invoice(pk)
        if not invoice:
            return error_response('Invoice not found.', status_code=404)
        serializer = InboundInvoiceDetailSerializer(invoice)
        return success_response(serializer.data)


# ─── Internal: Approve ────────────────────────────────────────────────────────

class InboundApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: str):
        try:
            invoice = InboundInvoice.objects.get(pk=pk)
        except InboundInvoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        serializer = ReviewApproveSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Bad request.', details=serializer.errors, status_code=400)

        try:
            InboundInvoiceService.approve(
                invoice  = invoice,
                reviewer = request.user,
                notes    = serializer.validated_data.get('reviewer_notes', ''),
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=400)

        return success_response({'status': invoice.status, 'message': 'Invoice approved.'})


# ─── Internal: Reject ─────────────────────────────────────────────────────────

class InboundRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: str):
        try:
            invoice = InboundInvoice.objects.get(pk=pk)
        except InboundInvoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        serializer = ReviewRejectSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Bad request.', details=serializer.errors, status_code=400)

        try:
            InboundInvoiceService.reject(
                invoice  = invoice,
                reviewer = request.user,
                notes    = serializer.validated_data['reviewer_notes'],
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=400)

        return success_response({'status': invoice.status, 'message': 'Invoice rejected.'})


# ─── Internal: Resend Observation ─────────────────────────────────────────────

class InboundResendObservationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: str):
        try:
            invoice = InboundInvoice.objects.get(pk=pk)
        except InboundInvoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        serializer = ResendObservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        InboundInvoiceService.send_observation_email(
            invoice        = invoice,
            custom_message = serializer.validated_data.get('custom_message', ''),
        )
        return success_response({
            'message': f'Observation email sent to {invoice.supplier.email}.',
            'sent_at': invoice.observation_sent_at,
        })


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

class InboundStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = InboundInvoice.objects.all()

        company_id = request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(receiving_company_id=company_id)

        from django.db.models import Count, Sum, Q

        stats = qs.aggregate(
            total             = Count('id'),
            received          = Count('id', filter=Q(status='received')),
            validating        = Count('id', filter=Q(status='validating')),
            validation_failed = Count('id', filter=Q(status='validation_failed')),
            pending_review    = Count('id', filter=Q(status='pending_review')),
            approved          = Count('id', filter=Q(status='approved')),
            rejected          = Count('id', filter=Q(status='rejected')),
            fta_accepted      = Count('id', filter=Q(status='fta_accepted')),
            total_value       = Sum('total_amount'),
        )

        return success_response(stats)


# ─── Supplier Management ──────────────────────────────────────────────────────

def _send_supplier_activation_email(supplier, activation_token: str):
    """Send activation email with a link for the supplier to set their password."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    activation_link = f'{frontend_url}/activate?token={activation_token}&supplier={supplier.id}'
    subject = f'Activate your UAE E-Invoicing Supplier Portal account'
    body = f"""Hello {supplier.name},

You have been registered as an inbound supplier on the UAE E-Invoicing Platform.

To activate your account and set your password, please click the link below:

  {activation_link}

This link is valid for 7 days.

Once activated, you can:
  - Log in to your Supplier Portal dashboard
  - Track the status of invoices you have submitted
  - View validation observations and feedback

Your API Key for programmatic invoice submission will be provided separately.

If you did not expect this invitation, please ignore this email.

UAE E-Invoicing Platform
"""
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@uae-einvoicing.ae'),
            recipient_list=[supplier.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.warning('Failed to send activation email to %s: %s', supplier.email, exc)


class SupplierListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Supplier.objects.select_related('receiving_company').filter(is_active=True)
        company_id = request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(receiving_company_id=company_id)
        return success_response(SupplierSerializer(qs, many=True).data)

    def post(self, request):
        serializer = SupplierCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.companies.models import Company
        try:
            company = Company.objects.get(pk=d['receiving_company'], is_active=True)
        except Company.DoesNotExist:
            return error_response('Company not found.', status_code=404)

        if Supplier.objects.filter(trn=d['trn']).exists():
            return error_response('A supplier with this TRN already exists.', status_code=400)
        if Supplier.objects.filter(email=d['email']).exists():
            return error_response('A supplier with this email already exists.', status_code=400)

        plaintext, key_hash = Supplier.generate_api_key()
        activation_token = uuid.uuid4()

        # If a self-registered inbound_supplier user already exists with this email,
        # link to that account instead of creating a duplicate user.
        existing_user = User.objects.filter(email=d['email']).first()
        if existing_user:
            if existing_user.role != 'inbound_supplier':
                return error_response(
                    'A user with this email already exists with a different role.',
                    status_code=400,
                )
            if Supplier.objects.filter(user=existing_user).exists():
                return error_response(
                    'This user already has a supplier profile linked.',
                    status_code=400,
                )
            user = existing_user
        else:
            # Create a new platform user account (inactive until they set a password)
            user = User.objects.create_user(
                email      = d['email'],
                password   = None,
                first_name = d['name'].split()[0],
                last_name  = ' '.join(d['name'].split()[1:]) or '-',
                role       = 'inbound_supplier',
                is_active  = False,
            )
            user.set_unusable_password()
            user.save()

        supplier = Supplier.objects.create(
            name              = d['name'],
            trn               = d['trn'],
            email             = d['email'],
            phone             = d.get('phone', ''),
            address           = d.get('address', ''),
            receiving_company = company,
            whitelisted_email = d.get('whitelisted_email', ''),
            notes             = d.get('notes', ''),
            api_key_hash      = key_hash,
            api_key_prefix    = plaintext[:8],
            user              = user,
            activation_token  = activation_token,
        )

        # Only send activation email to users who haven't set a password yet
        if not user.is_active or not user.has_usable_password():
            _send_supplier_activation_email(supplier, str(activation_token))

        return success_response({
            **SupplierSerializer(supplier).data,
            'api_key': plaintext,
        }, status_code=201)


# ─── Supplier Activation ──────────────────────────────────────────────────────

class SupplierActivateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SupplierActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            supplier = Supplier.objects.select_related('user').get(
                id               = d['supplier_id'],
                activation_token = d['token'],
            )
        except Supplier.DoesNotExist:
            return error_response('Invalid or expired activation link.', status_code=400)

        if supplier.user is None:
            return error_response('No user account linked to this supplier.', status_code=400)

        user = supplier.user
        user.set_password(d['password'])
        user.is_active = True
        user.email_verified = True
        user.save(update_fields=['password', 'is_active', 'email_verified'])

        supplier.activation_token = None
        supplier.save(update_fields=['activation_token'])

        return success_response({'message': 'Account activated. You can now log in.'})


# ─── Portal Invoice Submit (JWT auth) ────────────────────────────────────────

class InboundPortalSubmitView(APIView):
    """
    POST /api/v1/inbound/portal/submit/
    Logged-in inbound_supplier submits an invoice via the web portal.
    Uses JWT auth instead of API key — supplier identity comes from request.user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'inbound_supplier':
            return error_response('Only inbound suppliers can use this endpoint.', status_code=403)

        try:
            supplier = Supplier.objects.select_related('receiving_company').get(user=request.user)
        except Supplier.DoesNotExist:
            return error_response('Supplier profile not found.', status_code=404)

        serializer = InboundInvoiceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Invalid submission payload.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            invoice = InboundInvoiceService.create_from_payload(
                supplier          = supplier,
                receiving_company = supplier.receiving_company,
                validated_data    = serializer.validated_data.copy(),
                channel           = 'api',
            )
        except Exception as exc:
            logger.exception('Error creating inbound invoice from portal')
            return error_response(f'Could not store invoice: {exc}', status_code=500)

        try:
            from .tasks import validate_inbound_invoice
            validate_inbound_invoice.delay(str(invoice.id))
        except Exception:
            logger.warning('Celery unavailable — running validation synchronously.')
            InboundInvoiceService.run_validation(invoice)

        return success_response(
            {
                'inbound_invoice_id': str(invoice.id),
                'status': invoice.status,
                'supplier_invoice_number': invoice.supplier_invoice_number,
            },
            message='Invoice submitted successfully. It will be validated shortly.',
            status_code=status.HTTP_202_ACCEPTED,
        )


# ─── Inbound Supplier Portal ──────────────────────────────────────────────────

class InboundSupplierPortalView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'inbound_supplier':
            return error_response('Access denied.', status_code=403)

        try:
            supplier = Supplier.objects.get(user=request.user)
        except Supplier.DoesNotExist:
            return error_response('Supplier profile not found.', status_code=404)

        from django.db.models import Count, Sum, Q
        qs = InboundInvoice.objects.filter(supplier=supplier)

        stats = qs.aggregate(
            total             = Count('id'),
            pending_review    = Count('id', filter=Q(status='pending_review')),
            validation_failed = Count('id', filter=Q(status='validation_failed')),
            approved          = Count('id', filter=Q(status='approved')),
            rejected          = Count('id', filter=Q(status='rejected')),
            fta_accepted      = Count('id', filter=Q(status='fta_accepted')),
            total_value       = Sum('total_amount'),
        )

        recent = qs.order_by('-created_at')[:10]
        return success_response({
            'supplier': SupplierSerializer(supplier).data,
            'stats': stats,
            'recent_invoices': InboundInvoiceListSerializer(recent, many=True).data,
        })
