"""
Admin Panel API views.

All endpoints require role='admin' (IsAdmin permission).
Mounted at: /api/v1/admin/

Endpoints:
  GET  /api/v1/admin/stats/                          — platform-wide stats
  GET  /api/v1/admin/users/                          — list all users
  POST /api/v1/admin/users/                          — create user
  GET  /api/v1/admin/users/<uuid>/                   — user detail
  PUT  /api/v1/admin/users/<uuid>/                   — update user role/name
  POST /api/v1/admin/users/<uuid>/activate/          — reactivate user
  POST /api/v1/admin/users/<uuid>/deactivate/        — deactivate user
  GET  /api/v1/admin/invoices/                       — all invoices (all companies)
  POST /api/v1/admin/invoices/<uuid>/submit/         — admin triggers ASP submission
  POST /api/v1/admin/invoices/<uuid>/report-fta/     — admin triggers FTA reporting
"""
import logging
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response, StandardResultsPagination
from apps.accounts.permissions import IsAdmin
from apps.accounts.serializers import UserSerializer
from apps.accounts.services import AuthService
from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceListSerializer
from apps.companies.models import Company
from apps.payments.models import Payment
from apps.common.constants import (
    INVOICE_STATUS_DRAFT, INVOICE_STATUS_PENDING, INVOICE_STATUS_SUBMITTED,
    INVOICE_STATUS_VALIDATED, INVOICE_STATUS_REJECTED, INVOICE_STATUS_CANCELLED,
    USER_ROLE_CHOICES,
)
from django.utils import timezone  # noqa: E402  (used in views below)
from decimal import Decimal

User = get_user_model()
logger = logging.getLogger(__name__)


# ─── Stats ────────────────────────────────────────────────────────────────────

class AdminStatsView(APIView):
    """
    GET /api/v1/admin/stats/
    Platform-wide statistics for the admin dashboard.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # User stats
        total_users    = User.objects.count()
        active_users   = User.objects.filter(is_active=True).count()
        users_by_role  = {
            role: User.objects.filter(role=role).count()
            for role, _ in USER_ROLE_CHOICES
        }

        # Company stats
        total_companies = Company.objects.filter(is_active=True).count()

        # Invoice stats
        inv_qs = Invoice.objects.filter(is_active=True)
        invoice_counts = {
            row['status']: row['count']
            for row in inv_qs.values('status').annotate(count=Count('id'))
        }

        # ASP queue — invoices ready to be submitted (DRAFT with items)
        asp_pending = inv_qs.filter(status=INVOICE_STATUS_DRAFT).count()

        # FTA queue — validated invoices not yet reported
        fta_pending = inv_qs.filter(
            status__in=[INVOICE_STATUS_VALIDATED, 'paid'],
            fta_status__isnull=True,
        ).count()

        # Payment stats
        from django.db.models import Sum as DbSum
        pay_qs = Payment.objects.filter(is_active=True)
        payment_total = pay_qs.aggregate(total=DbSum('amount'))['total'] or Decimal('0.00')
        payment_count = pay_qs.count()
        buyer_viewed  = inv_qs.filter(buyer_viewed_at__isnull=False).count()

        return success_response(data={
            'users': {
                'total':    total_users,
                'active':   active_users,
                'inactive': total_users - active_users,
                'by_role':  users_by_role,
            },
            'companies': {
                'total': total_companies,
            },
            'invoices': {
                'total':         inv_qs.count(),
                'by_status':     invoice_counts,
                'asp_pending':   asp_pending,
                'fta_pending':   fta_pending,
                'buyer_viewed':  buyer_viewed,
            },
            'payments': {
                'total_count':  payment_count,
                'total_amount': str(payment_total),
            },
        })


# ─── User Management ──────────────────────────────────────────────────────────

class AdminUserListView(APIView):
    """
    GET  /api/v1/admin/users/  — list all users with optional filters
    POST /api/v1/admin/users/  — create a new user (admin sets role)
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = User.objects.all().order_by('-date_joined')

        # Filters
        search    = request.query_params.get('search', '').strip()
        role      = request.query_params.get('role', '').strip()
        is_active = request.query_params.get('is_active', '').strip()

        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        if is_active in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', '0'):
            qs = qs.filter(is_active=False)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AdminUserDetailSerializer(page, many=True)
        return success_response(data={
            'results':    serializer.data,
            'pagination': {
                'count':    paginator.page.paginator.count,
                'next':     paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
            },
        })

    def post(self, request):
        email      = request.data.get('email', '').strip().lower()
        password   = request.data.get('password', '').strip()
        first_name = request.data.get('first_name', '').strip()
        last_name  = request.data.get('last_name', '').strip()
        role       = request.data.get('role', 'viewer')

        if not email or not password or not first_name or not last_name:
            return error_response(
                'email, password, first_name and last_name are required.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = AuthService.register_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=role,
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        logger.info('Admin %s created user %s', request.user.email, user.email)
        return success_response(
            data=AdminUserDetailSerializer(user).data,
            message='User created successfully.',
            status_code=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(APIView):
    """
    GET  /api/v1/admin/users/<uuid>/  — user detail
    PUT  /api/v1/admin/users/<uuid>/  — update role / name
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_user(self, pk):
        return get_object_or_404(User, id=pk)

    def get(self, request, pk):
        user = self._get_user(pk)
        return success_response(data=AdminUserDetailSerializer(user).data)

    def put(self, request, pk):
        user = self._get_user(pk)

        if 'first_name' in request.data or 'last_name' in request.data:
            first_name = request.data.get('first_name', user.first_name)
            last_name  = request.data.get('last_name',  user.last_name)
            user.first_name = first_name.strip()
            user.last_name  = last_name.strip()

        if 'role' in request.data:
            role = request.data['role']
            valid_roles = [r[0] for r in USER_ROLE_CHOICES]
            if role not in valid_roles:
                return error_response(
                    f'Invalid role. Choices: {valid_roles}',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            user.role = role

        if 'is_active' in request.data:
            user.is_active = bool(request.data['is_active'])

        user.save()
        logger.info('Admin %s updated user %s', request.user.email, user.email)
        return success_response(
            data=AdminUserDetailSerializer(user).data,
            message='User updated.',
        )

    def delete(self, request, pk):
        user = self._get_user(pk)
        if user == request.user:
            return error_response('You cannot delete your own account.', status_code=400)
        email = user.email
        user.delete()
        logger.info('Admin %s permanently deleted user %s', request.user.email, email)
        return success_response(message='User deleted.')


class AdminUserActivateView(APIView):
    """POST /api/v1/admin/users/<uuid>/activate/"""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, id=pk)
        user.is_active = True
        user.save(update_fields=['is_active'])
        logger.info('Admin %s activated user %s', request.user.email, user.email)
        return success_response(message='User activated.')


class AdminUserDeactivateView(APIView):
    """POST /api/v1/admin/users/<uuid>/deactivate/"""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, id=pk)
        try:
            AuthService.deactivate_user(requesting_user=request.user, target_user=user)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return success_response(message='User deactivated.')


# ─── Invoice Management ───────────────────────────────────────────────────────

class AdminInvoiceListView(APIView):
    """
    GET /api/v1/admin/invoices/
    List ALL invoices across ALL companies — admin only.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Invoice.objects.filter(is_active=True).select_related(
            'company', 'customer', 'created_by'
        ).order_by('-created_at')

        # Filters
        status_f    = request.query_params.get('status', '').strip()
        company_id  = request.query_params.get('company_id', '').strip()
        search      = request.query_params.get('search', '').strip()
        fta_pending = request.query_params.get('fta_pending', '').strip()
        asp_queue   = request.query_params.get('asp_queue', '').strip()

        if status_f:
            qs = qs.filter(status=status_f)
        if company_id:
            qs = qs.filter(company_id=company_id)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(company__name__icontains=search)
            )
        if fta_pending in ('true', '1'):
            qs = qs.filter(
                status__in=[INVOICE_STATUS_VALIDATED, 'paid'],
                fta_status__isnull=True,
            )
        if asp_queue in ('true', '1'):
            qs = qs.filter(status=INVOICE_STATUS_DRAFT)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AdminInvoiceSerializer(page, many=True)
        return success_response(data={
            'results': serializer.data,
            'pagination': {
                'count':    paginator.page.paginator.count,
                'next':     paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
            },
        })


class AdminInvoiceDetailView(APIView):
    """
    GET /api/v1/admin/invoices/<uuid>/
    Single invoice detail — admin only, no company membership required.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        invoice = get_object_or_404(
            Invoice.objects.select_related('company', 'customer', 'created_by'),
            id=pk,
            is_active=True,
        )
        return success_response(data=AdminInvoiceSerializer(invoice).data)


class AdminInvoiceSubmitView(APIView):
    """
    POST /api/v1/admin/invoices/<uuid>/submit/
    Admin submits an invoice to ASP, bypassing company membership check.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, id=pk, is_active=True)

        if not invoice.is_submittable:
            if invoice.status != INVOICE_STATUS_DRAFT:
                return error_response(
                    f'Only DRAFT invoices can be submitted. Current status: "{invoice.status}".',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return error_response(
                'Invoice must have at least one line item before submission.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        invoice.status = INVOICE_STATUS_PENDING
        invoice.save(update_fields=['status', 'updated_at'])

        # Enqueue async task; fall back to synchronous if broker is unavailable
        from tasks.invoice_tasks import process_invoice
        try:
            process_invoice.apply_async(args=[str(invoice.id)], queue='invoice_processing')
        except Exception:
            logger.warning('Celery unavailable — running pipeline synchronously for %s', invoice.invoice_number)
            process_invoice.apply(args=[str(invoice.id)])

        logger.info('Admin %s submitted invoice %s to ASP', request.user.email, invoice.invoice_number)
        return success_response(message=f'Invoice {invoice.invoice_number} submitted to ASP.')


class AdminInvoiceApproveASPView(APIView):
    """
    POST /api/v1/admin/invoices/<uuid>/approve-asp/
    Admin manually marks a pending/submitted invoice as validated by ASP.
    Advances the 5-corner flow: Corner 2 → complete, Corner 3/4 → complete.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, id=pk, is_active=True)

        if invoice.status not in (INVOICE_STATUS_PENDING, INVOICE_STATUS_SUBMITTED):
            return error_response(
                f'Only pending or submitted invoices can be ASP-approved. '
                f'Current status: "{invoice.status}".',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        # Set submission ID placeholder if not already set (so Corner 3/4 activate)
        if not invoice.asp_submission_id:
            invoice.asp_submission_id = f'ADMIN-{str(invoice.id)[:8].upper()}'
        if not invoice.asp_submitted_at:
            invoice.asp_submitted_at = now

        invoice.status = INVOICE_STATUS_VALIDATED
        invoice.save(update_fields=['status', 'asp_submission_id', 'asp_submitted_at', 'updated_at'])

        logger.info('Admin %s approved invoice %s via ASP', request.user.email, invoice.invoice_number)
        return success_response(
            message=f'Invoice {invoice.invoice_number} approved — marked as validated.',
        )


class AdminInvoiceRejectASPView(APIView):
    """
    POST /api/v1/admin/invoices/<uuid>/reject-asp/
    Admin manually marks a pending/submitted invoice as rejected by ASP.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, id=pk, is_active=True)

        if invoice.status not in (INVOICE_STATUS_PENDING, INVOICE_STATUS_SUBMITTED):
            return error_response(
                f'Only pending or submitted invoices can be rejected. '
                f'Current status: "{invoice.status}".',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        invoice.status = INVOICE_STATUS_REJECTED
        invoice.save(update_fields=['status', 'updated_at'])

        logger.info('Admin %s rejected invoice %s via ASP', request.user.email, invoice.invoice_number)
        return success_response(
            message=f'Invoice {invoice.invoice_number} rejected.',
        )


class AdminInvoiceReportFTAView(APIView):
    """
    POST /api/v1/admin/invoices/<uuid>/report-fta/
    Admin triggers FTA reporting for a validated invoice.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, id=pk, is_active=True)

        if invoice.status not in (INVOICE_STATUS_VALIDATED, 'paid'):
            return error_response(
                'Only validated invoices can be reported to FTA.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if invoice.fta_status == 'reported':
            return error_response(
                'Invoice has already been reported to FTA.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Mark as reported (actual FTA API integration goes here)
        invoice.fta_status = 'reported'
        invoice.fta_reported_at = timezone.now()
        invoice.save(update_fields=['fta_status', 'fta_reported_at'])

        logger.info('Admin %s reported invoice %s to FTA', request.user.email, invoice.invoice_number)
        return success_response(message=f'Invoice {invoice.invoice_number} reported to FTA.')


class AdminInvoiceTimelineView(APIView):
    """
    GET /api/v1/admin/invoices/<uuid>/timeline/
    Returns the 5-corner flow + events for any invoice, bypassing company-membership check.
    Admin-only.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        invoice = get_object_or_404(
            Invoice.objects.select_related('company', 'customer', 'created_by'),
            id=pk,
            is_active=True,
        )
        # Reuse the same helpers from integrations app
        from apps.integrations.views import _build_flow, _build_events
        events = _build_events(invoice)
        flow   = _build_flow(invoice)

        return success_response(data={
            'invoice_id':     str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'current_status': invoice.status,
            'flow':           flow,
            'events':         sorted(events, key=lambda e: e['timestamp']),
        })


# ─── Inline serializers (defined here to keep admin_panel self-contained) ─────

from rest_framework import serializers
from django.contrib.auth import get_user_model as _get_user_model


class AdminUserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    company_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'is_active', 'is_staff', 'date_joined', 'last_login',
            'company_count',
        ]

    def get_full_name(self, obj) -> str:
        return obj.full_name

    def get_company_count(self, obj) -> int:
        return obj.company_memberships.filter(is_active=True).count()


class AdminInvoiceSerializer(serializers.ModelSerializer):
    customer_name  = serializers.CharField(source='customer.name',          read_only=True)
    company_name   = serializers.CharField(source='company.name',           read_only=True)
    company_trn    = serializers.CharField(source='company.trn',            read_only=True)
    status_display = serializers.CharField(source='get_status_display',     read_only=True)
    type_display   = serializers.CharField(source='get_invoice_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'type_display',
            'status', 'status_display',
            'company_name', 'company_trn', 'customer_name',
            'issue_date', 'currency',
            'subtotal', 'total_vat', 'total_amount',
            'fta_status', 'asp_submission_id',
            'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            return obj.created_by.full_name
        return ''


# ─── Payment Management ───────────────────────────────────────────────────────

class AdminPaymentListView(APIView):
    """
    GET /api/v1/admin/payments/
    List all payments across all companies — with filters and totals.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from django.db.models import Sum as DbSum

        qs = Payment.objects.select_related(
            'invoice', 'invoice__company', 'invoice__customer', 'recorded_by'
        ).filter(is_active=True).order_by('-payment_date', '-created_at')

        # Filters
        method     = request.query_params.get('method', '').strip()
        company_id = request.query_params.get('company_id', '').strip()
        search     = request.query_params.get('search', '').strip()
        date_from  = request.query_params.get('date_from', '').strip()
        date_to    = request.query_params.get('date_to', '').strip()

        if method:
            qs = qs.filter(method=method)
        if company_id:
            qs = qs.filter(invoice__company_id=company_id)
        if search:
            qs = qs.filter(
                Q(invoice__invoice_number__icontains=search) |
                Q(invoice__customer__name__icontains=search) |
                Q(invoice__company__name__icontains=search) |
                Q(reference__icontains=search)
            )
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)

        total_amount = qs.aggregate(total=DbSum('amount'))['total'] or Decimal('0.00')
        total_count  = qs.count()

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)

        data = []
        for p in page:
            data.append({
                'id':             str(p.id),
                'invoice_id':     str(p.invoice_id),
                'invoice_number': p.invoice.invoice_number,
                'invoice_status': p.invoice.status,
                'company_name':   p.invoice.company.name,
                'customer_name':  p.invoice.customer.name,
                'amount':         str(p.amount),
                'method':         p.method,
                'method_display': p.get_method_display(),
                'payment_date':   str(p.payment_date),
                'reference':      p.reference,
                'notes':          p.notes,
                'recorded_by':    p.recorded_by.full_name if p.recorded_by else '—',
                'created_at':     p.created_at.isoformat(),
            })

        return success_response(data={
            'results': data,
            'summary': {
                'total_count':  total_count,
                'total_amount': str(total_amount),
            },
            'pagination': {
                'count':    paginator.page.paginator.count,
                'next':     paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
            },
        })


class AdminPaymentVoidView(APIView):
    """
    DELETE /api/v1/admin/payments/<uuid>/
    Void (soft-delete) a payment and recalculate invoice status.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk):
        from django.db.models import Sum as DbSum

        try:
            payment = Payment.objects.select_related('invoice').get(id=pk, is_active=True)
        except Payment.DoesNotExist:
            return error_response('Payment not found.', status_code=404)

        invoice = payment.invoice
        payment.is_active = False
        payment.save(update_fields=['is_active', 'updated_at'])

        # Recalculate invoice payment status
        total_paid = invoice.payments.filter(is_active=True).aggregate(
            total=DbSum('amount')
        )['total'] or Decimal('0.00')

        if total_paid >= invoice.total_amount:
            new_status = 'paid'
        elif total_paid > Decimal('0.00'):
            new_status = 'partially_paid'
        else:
            # Revert to pre-payment status based on ASP submission history
            if invoice.status in ('paid', 'partially_paid'):
                new_status = 'validated' if invoice.asp_submitted_at else 'pending'
            else:
                new_status = invoice.status

        invoice.status = new_status
        invoice.save(update_fields=['status', 'updated_at'])

        logger.info(
            'Admin %s voided payment %s (invoice %s → %s)',
            request.user.email, pk, invoice.invoice_number, new_status
        )
        return success_response(
            message=f'Payment voided. Invoice {invoice.invoice_number} status updated to {new_status}.',
            data={'invoice_status': new_status},
        )
