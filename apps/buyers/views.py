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
import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.utils import timezone
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from decimal import Decimal

from apps.common.utils import success_response, error_response, StandardResultsPagination
from apps.common.constants import ROLE_ADMIN, ROLE_ACCOUNTANT, ROLE_BUYER
from apps.customers.models import Customer
from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceSerializer, InvoiceListSerializer

from .models import BuyerProfile, BuyerInvite

User = get_user_model()
from .serializers import (
    BuyerInviteSerializer, AcceptInviteSerializer, BuyerProfileSerializer,
    BuyerInvoiceCreateSerializer,
)
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
        email = serializer.validated_data['email'].strip().lower()

        try:
            customer = Customer.objects.select_related('company').get(
                id=customer_id, is_active=True
            )
        except Customer.DoesNotExist:
            return error_response('Customer not found.', status_code=404)

        # One email = one role. A single email address can only ever be used for
        # one platform account, so it cannot be invited with a different role.
        existing = User.objects.filter(email=email).first()
        if existing:
            if existing.role != ROLE_BUYER:
                return error_response(
                    f'This email is already registered as a {existing.get_role_display()} account. '
                    'A single email can only have one role, so it cannot be invited as a buyer.',
                    status_code=400,
                )
            return error_response(
                'A buyer account already exists for this email. '
                'Ask the buyer to sign in to the buyer portal.',
                status_code=400,
            )

        # Block duplicate active invitations to the same email.
        if BuyerInvite.objects.filter(
            email=email, is_used=False, expires_at__gt=timezone.now()
        ).exists():
            return error_response(
                'An active invitation has already been sent to this email. '
                'Wait for it to be used or to expire before sending a new one.',
                status_code=400,
            )

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
    """GET/POST /api/v1/buyer/invoices/ — paginated list + self-billed creation."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, err = _require_buyer(request)
        if err:
            return err

        qs = Invoice.objects.filter(
            customer=profile.customer, is_active=True
        ).select_related('customer', 'company').order_by('-issue_date')

        # Filter by status (supports comma-separated values)
        status_filter = request.query_params.get('status')
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(',') if s.strip()]
            if len(statuses) == 1:
                qs = qs.filter(status=statuses[0])
            elif statuses:
                qs = qs.filter(status__in=statuses)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = InvoiceListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """POST /api/v1/buyer/invoices/ — buyer creates a self-billed invoice.

        The supplier company the buyer is linked to is the issuer (seller); the
        buyer's own customer record is the recipient. The invoice is saved as a
        DRAFT for the supplier to review and verify. The supplier then sends it
        to the buyer for approval, and only after the buyer approves/e-signs is
        it submitted to the ASP/FTA pipeline.
        """
        from apps.common.constants import INVOICE_STATUS_DRAFT
        from apps.invoices.models import InvoiceItem
        from apps.invoices.services import InvoiceNumberService, VATCalculationService

        profile, err = _require_buyer(request)
        if err:
            return err

        serializer = BuyerInvoiceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invoice creation failed.', details=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        company = profile.customer.company

        if not company.is_active:
            return error_response(
                f'The supplier company "{company.name}" is inactive. You cannot create invoices.',
                status_code=403,
            )

        if not profile.customer.is_complete:
            return error_response(
                'Your account profile is missing required details: '
                f"{', '.join(profile.customer.missing_fields)}. "
                'Update your profile before creating invoices.',
                details={'missing_fields': profile.customer.missing_fields},
                status_code=400,
            )

        # Generate a sequential invoice number for the issuing company.
        invoice_number, sequence = InvoiceNumberService.generate(company)

        invoice = Invoice.objects.create(
            company=company,
            customer=profile.customer,
            created_by=request.user,
            invoice_number=invoice_number,
            invoice_sequence=sequence,
            invoice_type=data.get('invoice_type', 'tax_invoice'),
            transaction_type=data.get('transaction_type', 'b2b'),
            payment_means_code=data.get('payment_means_code', '30'),
            supplier_location=data.get('supplier_location', ''),
            accounts_type=data.get('accounts_type', ''),
            issue_date=data.get('issue_date', timezone.localdate()),
            due_date=data.get('due_date'),
            supply_date=data.get('supply_date'),
            currency=data.get('currency', 'AED'),
            exchange_rate=data.get('exchange_rate'),
            discount_amount=data.get('discount_amount'),
            reference_number=data.get('reference_number', ''),
            credit_note_reason_code=data.get('credit_note_reason_code', ''),
            purchase_order_number=data.get('purchase_order_number', ''),
            notes=data.get('notes', ''),
            status=INVOICE_STATUS_DRAFT,
        )

        # Create line items and recalculate totals.
        for index, item_data in enumerate(data.get('items', [])):
            InvoiceItem.objects.create(
                invoice=invoice,
                item_name=(item_data.get('item_name') or '').strip(),
                description=item_data['description'].strip(),
                quantity=Decimal(str(item_data['quantity'])),
                unit=(item_data.get('unit') or '').strip(),
                unit_price=Decimal(str(item_data['unit_price'])),
                vat_rate_type=item_data.get('vat_rate_type', 'standard'),
                sort_order=index,
            )
        VATCalculationService.recalculate_invoice_totals(invoice)

        # Notify the supplier's admin/accountant members to review the draft.
        try:
            from apps.notifications.models import Notification
            from apps.notifications.services import NotificationService
            NotificationService.notify_company_roles(
                invoice.company,
                roles=[ROLE_ADMIN, ROLE_ACCOUNTANT],
                category=Notification.CAT_INVOICE,
                event='buyer_created_invoice',
                title=f'Buyer submitted a draft for review — {invoice.invoice_number}',
                message=f'{request.user.full_name} created a self-billed invoice. Review it, then send it to the buyer for approval.',
                link=f'/invoices/{invoice.id}',
            )
        except Exception:
            pass

        return success_response(
            data=InvoiceSerializer(invoice).data,
            message='Invoice saved as draft. The supplier will review it and send it to you for approval.',
            status_code=status.HTTP_201_CREATED
        )


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
            # Notify the supplier who created the invoice that the buyer opened it.
            # For self-billed invoices (created_by is the buyer) no one needs
            # to be told — the buyer already knows they opened it.
            if getattr(invoice.created_by, 'role', None) != ROLE_BUYER:
                from apps.notifications.services import NotificationService
                NotificationService.invoice_event(
                    invoice, event='buyer_viewed',
                    title=f'Buyer viewed — {invoice.invoice_number}',
                    message='The buyer has opened this invoice.',
                )

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
        profile, err = _require_buyer(request)
        if err:
            return err

        try:
            invoice = Invoice.objects.select_related('company', 'customer').get(
                id=invoice_id, customer=profile.customer, is_active=True
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        try:
            from apps.invoices.pdf_generator import generate_invoice_pdf_fallback
            pdf_bytes = generate_invoice_pdf_fallback(invoice)
        except Exception as exc:
            return error_response(f'PDF generation error: {exc}', status_code=500)

        if not pdf_bytes:
            return error_response('PDF could not be generated.', status_code=500)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
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


def _client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _run_pipeline_safe(invoice_id: str) -> None:
    """Run process_invoice in background thread; revert to awaiting_approval on crash."""
    import logging
    _logger = logging.getLogger(__name__)
    from apps.common.constants import INVOICE_STATUS_AWAITING_APPROVAL
    from apps.invoices.models import Invoice
    from tasks.invoice_tasks import process_invoice

    try:
        process_invoice.apply(args=[invoice_id])
    except Exception as exc:
        _logger.exception('Pipeline crashed for invoice %s; reverting.', invoice_id)
        try:
            inv = Invoice.objects.get(id=invoice_id, is_active=True)
            inv.status = INVOICE_STATUS_AWAITING_APPROVAL
            inv.buyer_approval_note = f'Submission failed: {exc}'
            inv.save(update_fields=['status', 'buyer_approval_note', 'updated_at'])
        except Invoice.DoesNotExist:
            pass


class BuyerInvoiceApproveView(APIView):
    """
    POST /api/v1/buyer/invoices/{id}/approve/

    Buyer reviews, e-signs (profile full name + confirmation), and confirms the order.
    AWAITING_APPROVAL → PENDING, then the ASP submission pipeline is triggered.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from apps.common.constants import (
            INVOICE_STATUS_AWAITING_APPROVAL, INVOICE_STATUS_PENDING,
        )
        profile, err = _require_buyer(request)
        if err:
            return err

        try:
            invoice = Invoice.objects.get(
                id=invoice_id, customer=profile.customer, is_active=True,
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        if invoice.status != INVOICE_STATUS_AWAITING_APPROVAL:
            return error_response(
                f'This invoice is not awaiting your approval (status: "{invoice.status}").',
                status_code=400,
            )

        # Capture the e-signature — typed name and/or drawn image.
        signed_name = request.data.get('signed_name', '').strip()
        signature_image = request.data.get('signature_image', '')

        if signed_name:
            invoice.buyer_signed_name = signed_name
        elif not invoice.buyer_signed_name:
            # Fallback: use the buyer's profile full name when neither is given.
            invoice.buyer_signed_name = request.user.full_name

        if signature_image:
            invoice.buyer_signature_image = signature_image

        invoice.buyer_signed_at = timezone.now()
        invoice.buyer_signature_ip = _client_ip(request)
        invoice.status = INVOICE_STATUS_PENDING
        invoice.save(update_fields=[
            'buyer_signed_name', 'buyer_signature_image',
            'buyer_signed_at', 'buyer_signature_ip',
            'status', 'updated_at',
        ])

        # Trigger the ASP submission pipeline (async, background-thread fallback).
        try:
            from tasks.invoice_tasks import process_invoice
            try:
                process_invoice.apply_async(args=[str(invoice.id)], queue='invoice_processing')
            except Exception:
                import threading
                t = threading.Thread(
                    target=_run_pipeline_safe,
                    args=[str(invoice.id)],
                    daemon=True,
                )
                t.start()
        except Exception:
            logger.warning('Buyer approve: pipeline trigger failed for %s', invoice.invoice_number)

        # Notify the supplier who created the invoice.
        try:
            from apps.notifications.services import NotificationService
            display_name = signed_name or request.user.full_name
            NotificationService.invoice_event(
                invoice, event='buyer_approved',
                title=f'Buyer approved — {invoice.invoice_number}',
                message=f'{display_name} approved & e-signed the order. Submitting to the ASP.',
            )
        except Exception:
            pass

        return success_response(
            message='Order confirmed and e-signed. The invoice is now being submitted.',
            data={'invoice_status': invoice.status},
        )


class BuyerInvoiceRejectView(APIView):
    """
    POST /api/v1/buyer/invoices/{id}/reject/  { note }

    Buyer rejects the invoice; it returns to the supplier as DRAFT.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from apps.common.constants import (
            INVOICE_STATUS_AWAITING_APPROVAL, INVOICE_STATUS_DRAFT,
        )
        profile, err = _require_buyer(request)
        if err:
            return err

        note = (request.data.get('note') or '').strip()

        try:
            invoice = Invoice.objects.get(
                id=invoice_id, customer=profile.customer, is_active=True,
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        if invoice.status != INVOICE_STATUS_AWAITING_APPROVAL:
            return error_response(
                f'This invoice is not awaiting your approval (status: "{invoice.status}").',
                status_code=400,
            )

        invoice.status = INVOICE_STATUS_DRAFT
        invoice.buyer_approval_note = note
        invoice.save(update_fields=['status', 'buyer_approval_note', 'updated_at'])

        try:
            from apps.notifications.services import NotificationService
            NotificationService.invoice_event(
                invoice, event='buyer_rejected',
                title=f'Buyer rejected — {invoice.invoice_number}',
                message=(f'The buyer rejected the invoice. Reason: {note}' if note
                         else 'The buyer rejected the invoice. It is back in Draft.'),
            )
        except Exception:
            pass

        return success_response(
            message='Invoice rejected and returned to the supplier.',
            data={'invoice_status': invoice.status},
        )


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
