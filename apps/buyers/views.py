"""
Buyer Portal API views.

Two groups:
  1. Public (invite flow) — no auth required:
       POST /api/v1/buyers/invite/          — supplier sends invite
       POST /api/v1/buyers/accept-invite/   — buyer accepts, creates account

  2. Buyer-authenticated:
       GET  /api/v1/buyer/me/               — profile
       GET  /api/v1/buyer/dashboard/        — stats
       GET  /api/v1/buyer/invoices/         — invoice list
       GET  /api/v1/buyer/invoices/{id}/    — invoice detail
       GET  /api/v1/buyer/invoices/{id}/download-pdf/
       GET  /api/v1/buyer/invoices/{id}/download-xml/
"""
import io
import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.utils import timezone
from django.template.loader import render_to_string
from django.http import HttpResponse
from decimal import Decimal

from apps.common.utils import success_response, error_response, StandardResultsPagination
from apps.common.constants import ROLE_BUYER
from apps.customers.models import Customer
from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceSerializer, InvoiceListSerializer

from .models import BuyerProfile
from .serializers import BuyerInviteSerializer, AcceptInviteSerializer, BuyerProfileSerializer
from .services import BuyerService

logger = logging.getLogger(__name__)


def _require_buyer(request):
    """Return (BuyerProfile, None) or (None, error_response)."""
    if request.user.role != ROLE_BUYER:
        return None, error_response('Buyer access required.', status_code=403)
    try:
        profile = BuyerProfile.objects.select_related('customer', 'customer__company').get(
            user=request.user, is_active=True
        )
        return profile, None
    except BuyerProfile.DoesNotExist:
        return None, error_response('Buyer profile not found.', status_code=404)


# ─── Invite Flow (supplier-side, IsAuthenticated) ─────────────────────────────

class BuyerInviteView(APIView):
    """POST /api/v1/buyers/invite/ — supplier invites a buyer by customer + email."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ('admin', 'supplier', 'accountant'):
            return error_response('Only suppliers can send buyer invitations.', status_code=403)

        serializer = BuyerInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', status_code=400,
                                  details=serializer.errors)

        customer_id = serializer.validated_data['customer_id']
        email = serializer.validated_data['email']

        try:
            customer = Customer.objects.select_related('company').get(
                id=customer_id, is_active=True
            )
        except Customer.DoesNotExist:
            return error_response('Customer not found.', status_code=404)

        try:
            BuyerService.send_invite(customer, email, request.user)
        except Exception as exc:
            logger.exception('Failed to send buyer invite')
            return error_response(f'Failed to send invitation: {exc}', status_code=500)

        return success_response(message=f'Invitation sent to {email}.')


class AcceptInviteView(APIView):
    """POST /api/v1/buyers/accept-invite/ — buyer registers via invite token."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', status_code=400,
                                  details=serializer.errors)

        try:
            user, access, refresh = BuyerService.accept_invite(
                token=str(serializer.validated_data['token']),
                full_name=serializer.validated_data['full_name'],
                password=serializer.validated_data['password'],
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=400)
        except Exception:
            logger.exception('Accept invite failed')
            return error_response('Registration failed. Please try again.', status_code=500)

        return success_response(data={
            'tokens': {'access': access, 'refresh': refresh},
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role,
            },
        }, message='Account created. Welcome to the Buyer Portal.')


# ─── Buyer Portal Views (role=buyer required) ─────────────────────────────────

class BuyerMeView(APIView):
    """GET /api/v1/buyer/me/ — buyer profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, err = _require_buyer(request)
        if err:
            return err
        return success_response(data=BuyerProfileSerializer(profile).data)


class BuyerDashboardView(APIView):
    """GET /api/v1/buyer/dashboard/ — summary stats for buyer."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, err = _require_buyer(request)
        if err:
            return err

        invoices = Invoice.objects.filter(
            customer=profile.customer, is_active=True
        )

        from django.db.models import Sum, Count, Q
        today = timezone.localdate()

        stats = invoices.aggregate(
            total=Count('id'),
            sum_total=Sum('total_amount'),
            paid_count=Count('id', filter=Q(status='paid')),
            sum_paid=Sum('total_amount', filter=Q(status='paid')),
            unpaid_count=Count('id', filter=Q(status__in=['validated', 'submitted', 'partially_paid'])),
            sum_unpaid=Sum('total_amount', filter=Q(status__in=['validated', 'submitted', 'partially_paid'])),
            overdue_count=Count('id', filter=Q(
                status__in=['validated', 'submitted', 'partially_paid'],
                due_date__lt=today,
            )),
        )

        recent = invoices.select_related('customer').order_by('-issue_date')[:5]

        return success_response(data={
            'total_invoices':   stats['total'] or 0,
            'total_amount':     str(stats['sum_total'] or Decimal('0.00')),
            'paid_count':       stats['paid_count'] or 0,
            'paid_amount':      str(stats['sum_paid'] or Decimal('0.00')),
            'unpaid_count':     stats['unpaid_count'] or 0,
            'unpaid_amount':    str(stats['sum_unpaid'] or Decimal('0.00')),
            'overdue_count':    stats['overdue_count'] or 0,
            'company_name':     profile.customer.company.name,
            'customer_name':    profile.customer.name,
            'recent_invoices':  InvoiceListSerializer(recent, many=True).data,
        })


class BuyerInvoiceListView(APIView):
    """GET /api/v1/buyer/invoices/ — paginated list of invoices for this buyer."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, err = _require_buyer(request)
        if err:
            return err

        qs = Invoice.objects.filter(
            customer=profile.customer, is_active=True
        ).select_related('customer', 'company').order_by('-issue_date')

        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = InvoiceListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class BuyerInvoiceDetailView(APIView):
    """GET /api/v1/buyer/invoices/{id}/ — full invoice detail."""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        profile, err = _require_buyer(request)
        if err:
            return err

        try:
            invoice = Invoice.objects.select_related(
                'company', 'customer', 'created_by'
            ).get(id=invoice_id, customer=profile.customer, is_active=True)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        # Record first buyer view (non-blocking — use update to avoid race conditions)
        if not invoice.buyer_viewed_at:
            Invoice.objects.filter(pk=invoice.pk, buyer_viewed_at__isnull=True).update(
                buyer_viewed_at=timezone.now()
            )
            invoice.buyer_viewed_at = timezone.now()

        serializer = InvoiceSerializer(invoice)
        data = serializer.data

        # Attach payment summary
        from apps.payments.models import Payment
        from django.db.models import Sum
        paid = invoice.payments.filter(is_active=True).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        data['amount_paid'] = str(paid)
        data['amount_due'] = str(max(invoice.total_amount - paid, Decimal('0.00')))

        return success_response(data=data)


class BuyerInvoicePDFView(APIView):
    """GET /api/v1/buyer/invoices/{id}/download-pdf/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        try:
            from xhtml2pdf import pisa
        except ImportError:
            return error_response('PDF generation not available.', status_code=501)

        profile, err = _require_buyer(request)
        if err:
            return err

        try:
            invoice = Invoice.objects.select_related('company', 'customer').get(
                id=invoice_id, customer=profile.customer, is_active=True
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        items = invoice.items.filter(is_active=True).order_by('sort_order', 'created_at')
        try:
            html = render_to_string('invoices/invoice_pdf.html', {'invoice': invoice, 'items': items})
        except Exception as exc:
            return error_response(f'PDF template error: {exc}', status_code=500)

        buffer = io.BytesIO()
        result = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')
        if result.err:
            return error_response('PDF could not be generated.', status_code=500)

        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
        return response


class BuyerInvoiceXMLView(APIView):
    """GET /api/v1/buyer/invoices/{id}/download-xml/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        profile, err = _require_buyer(request)
        if err:
            return err

        try:
            invoice = Invoice.objects.get(
                id=invoice_id, customer=profile.customer, is_active=True
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        if not invoice.xml_file:
            return error_response('XML not yet generated for this invoice.', status_code=404)

        invoice.xml_file.open('rb')
        xml_bytes = invoice.xml_file.read()
        invoice.xml_file.close()

        response = HttpResponse(xml_bytes, content_type='application/xml')
        response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.xml"'
        return response


class BuyerPaymentConfigView(APIView):
    """GET /api/v1/buyer/payment-config/ — returns enabled payment gateways and public keys."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.conf import settings
        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        paypal_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
        paypal_sandbox = getattr(settings, 'PAYPAL_SANDBOX', True)

        return success_response(data={
            'stripe_enabled': bool(stripe_key),
            'stripe_publishable_key': getattr(settings, 'STRIPE_PUBLISHABLE_KEY', ''),
            'paypal_enabled': bool(paypal_id),
            'paypal_client_id': paypal_id,
            'paypal_sandbox': paypal_sandbox,
        })
