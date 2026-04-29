"""
Payment API views — accessible by buyers and suppliers.

  POST /api/v1/buyer/invoices/{id}/pay/       — record a payment (buyer)
  GET  /api/v1/buyer/invoices/{id}/payments/  — payment history (buyer)
  GET  /api/v1/invoices/{id}/payments/        — payment history (supplier)
"""
import logging
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response
from apps.common.constants import ROLE_BUYER
from apps.invoices.models import Invoice
from apps.buyers.models import BuyerProfile

from .models import Payment
from .serializers import PaymentCreateSerializer, PaymentSerializer

logger = logging.getLogger(__name__)


def _get_buyer_invoice(request, invoice_id):
    """Resolve invoice for buyer role. Returns (invoice, None) or (None, error)."""
    if request.user.role != ROLE_BUYER:
        return None, error_response('Buyer access required.', status_code=403)
    try:
        profile = BuyerProfile.objects.get(user=request.user, is_active=True)
    except BuyerProfile.DoesNotExist:
        return None, error_response('Buyer profile not found.', status_code=404)
    try:
        invoice = Invoice.objects.get(
            id=invoice_id, customer=profile.customer, is_active=True
        )
        return invoice, None
    except Invoice.DoesNotExist:
        return None, error_response('Invoice not found.', status_code=404)


def _update_invoice_payment_status(invoice):
    """Recalculate and update invoice status based on total payments."""
    total_paid = invoice.payments.filter(is_active=True).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')

    if total_paid >= invoice.total_amount:
        new_status = 'paid'
    elif total_paid > Decimal('0.00'):
        new_status = 'partially_paid'
    else:
        return  # No change needed

    invoice.status = new_status
    invoice.save(update_fields=['status', 'updated_at'])
    logger.info(
        'Invoice %s status updated to %s (paid: %s / total: %s)',
        invoice.invoice_number, new_status, total_paid, invoice.total_amount
    )


class BuyerPaymentCreateView(APIView):
    """POST /api/v1/buyer/invoices/{id}/pay/ — buyer records a payment."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        if invoice.status not in ('pending', 'validated', 'submitted', 'partially_paid'):
            return error_response(
                f'Cannot record payment for invoice in "{invoice.status}" status.',
                status_code=400,
            )

        serializer = PaymentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid payment data.', status_code=400,
                                  details=serializer.errors)

        d = serializer.validated_data

        # Validate amount doesn't exceed remaining balance
        already_paid = invoice.payments.filter(is_active=True).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        remaining = invoice.total_amount - already_paid

        if d['amount'] > remaining:
            return error_response(
                f'Payment amount ({d["amount"]}) exceeds remaining balance ({remaining}).',
                status_code=400,
            )

        payment = Payment.objects.create(
            invoice=invoice,
            amount=d['amount'],
            method=d['method'],
            payment_date=d['payment_date'],
            reference=d.get('reference', ''),
            notes=d.get('notes', ''),
            recorded_by=request.user,
        )

        _update_invoice_payment_status(invoice)
        invoice.refresh_from_db()

        total_paid = (already_paid + d['amount'])
        return success_response(
            data={
                'payment': PaymentSerializer(payment).data,
                'invoice_status': invoice.status,
                'total_paid': str(total_paid),
                'amount_due': str(max(invoice.total_amount - total_paid, Decimal('0.00'))),
            },
            message='Payment recorded successfully.',
        )


class BuyerPaymentListView(APIView):
    """GET /api/v1/buyer/invoices/{id}/payments/ — payment history for buyer."""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        payments = invoice.payments.filter(is_active=True).order_by('-payment_date')
        total_paid = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return success_response(data={
            'payments': PaymentSerializer(payments, many=True).data,
            'total_paid': str(total_paid),
            'amount_due': str(max(invoice.total_amount - total_paid, Decimal('0.00'))),
            'invoice_status': invoice.status,
        })


class BuyerStripeSessionView(APIView):
    """POST /api/v1/buyer/invoices/{id}/create-stripe-session/ — initiate Stripe Checkout."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from django.conf import settings
        import stripe

        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if not stripe_key:
            return error_response(
                'Card payments are not configured. Please use Bank Transfer instead.',
                status_code=501,
            )

        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        if invoice.status not in ('pending', 'validated', 'submitted', 'partially_paid'):
            return error_response('Invoice is not payable in its current status.', status_code=400)

        already_paid = invoice.payments.filter(is_active=True).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        amount_due = max(invoice.total_amount - already_paid, Decimal('0.00'))

        if amount_due <= Decimal('0.00'):
            return error_response('Invoice is already fully paid.', status_code=400)

        stripe.api_key = stripe_key
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': invoice.currency.lower(),
                        'product_data': {'name': f'Invoice {invoice.invoice_number}'},
                        'unit_amount': int(amount_due * 100),
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=(
                    f'{frontend_url}/buyer/invoices/{invoice_id}'
                    '?payment=stripe_success&session_id={CHECKOUT_SESSION_ID}'
                ),
                cancel_url=f'{frontend_url}/buyer/invoices/{invoice_id}?payment=cancelled',
                metadata={
                    'invoice_id': str(invoice_id),
                    'buyer_user_id': str(request.user.id),
                },
            )
        except stripe.error.StripeError as exc:
            logger.exception('Stripe session creation failed')
            return error_response(f'Payment session could not be created: {exc}', status_code=500)

        return success_response(data={'url': session.url, 'session_id': session.id})


class BuyerStripeConfirmView(APIView):
    """POST /api/v1/buyer/invoices/{id}/confirm-stripe-payment/ — verify session and record payment."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from django.conf import settings
        import stripe

        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if not stripe_key:
            return error_response('Stripe not configured.', status_code=501)

        session_id = request.data.get('session_id', '').strip()
        if not session_id:
            return error_response('session_id is required.', status_code=400)

        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        # Idempotency — prevent double-recording
        if Payment.objects.filter(reference=session_id, invoice=invoice).exists():
            invoice.refresh_from_db()
            return success_response(
                message='Payment already recorded.',
                data={'invoice_status': invoice.status},
            )

        stripe.api_key = stripe_key
        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except stripe.error.StripeError as exc:
            return error_response(f'Could not verify payment: {exc}', status_code=500)

        if session.payment_status != 'paid':
            return error_response('Payment has not been completed.', status_code=400)

        amount_paid = Decimal(str(session.amount_total)) / Decimal('100')

        Payment.objects.create(
            invoice=invoice,
            amount=amount_paid,
            method='card',
            payment_date=timezone.localdate(),
            reference=session_id,
            notes='Stripe card payment',
            recorded_by=request.user,
        )

        _update_invoice_payment_status(invoice)
        invoice.refresh_from_db()

        return success_response(
            message='Card payment confirmed and recorded.',
            data={'invoice_status': invoice.status},
        )


class BuyerPayPalCreateOrderView(APIView):
    """POST /api/v1/buyer/invoices/{id}/create-paypal-order/ — create a PayPal order."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from django.conf import settings
        import requests as http_req

        client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
        client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
        if not client_id:
            return error_response(
                'PayPal payments are not configured. Please use Bank Transfer instead.',
                status_code=501,
            )

        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        if invoice.status not in ('pending', 'validated', 'submitted', 'partially_paid'):
            return error_response('Invoice is not payable in its current status.', status_code=400)

        already_paid = invoice.payments.filter(is_active=True).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        amount_due = max(invoice.total_amount - already_paid, Decimal('0.00'))

        if amount_due <= Decimal('0.00'):
            return error_response('Invoice is already fully paid.', status_code=400)

        sandbox = getattr(settings, 'PAYPAL_SANDBOX', True)
        base_url = 'https://api-m.sandbox.paypal.com' if sandbox else 'https://api-m.paypal.com'

        try:
            auth_resp = http_req.post(
                f'{base_url}/v1/oauth2/token',
                auth=(client_id, client_secret),
                data={'grant_type': 'client_credentials'},
                timeout=10,
            )
            auth_resp.raise_for_status()
            access_token = auth_resp.json()['access_token']

            order_resp = http_req.post(
                f'{base_url}/v2/checkout/orders',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json',
                },
                json={
                    'intent': 'CAPTURE',
                    'purchase_units': [{
                        'reference_id': str(invoice_id),
                        'description': f'Invoice {invoice.invoice_number}',
                        'amount': {
                            'currency_code': invoice.currency,
                            'value': str(amount_due.quantize(Decimal('0.01'))),
                        },
                    }],
                },
                timeout=10,
            )
            order_resp.raise_for_status()
        except Exception as exc:
            logger.exception('PayPal order creation failed')
            return error_response(f'PayPal order could not be created: {exc}', status_code=500)

        order = order_resp.json()
        return success_response(data={'order_id': order['id']})


class BuyerPayPalCaptureOrderView(APIView):
    """POST /api/v1/buyer/invoices/{id}/capture-paypal-order/ — capture order + record payment."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from django.conf import settings
        import requests as http_req

        client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
        client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
        if not client_id:
            return error_response('PayPal not configured.', status_code=501)

        order_id = request.data.get('order_id', '').strip()
        if not order_id:
            return error_response('order_id is required.', status_code=400)

        invoice, err = _get_buyer_invoice(request, invoice_id)
        if err:
            return err

        ref_key = f'paypal:{order_id}'
        if Payment.objects.filter(reference=ref_key, invoice=invoice).exists():
            invoice.refresh_from_db()
            return success_response(
                message='Payment already recorded.',
                data={'invoice_status': invoice.status},
            )

        sandbox = getattr(settings, 'PAYPAL_SANDBOX', True)
        base_url = 'https://api-m.sandbox.paypal.com' if sandbox else 'https://api-m.paypal.com'

        try:
            auth_resp = http_req.post(
                f'{base_url}/v1/oauth2/token',
                auth=(client_id, client_secret),
                data={'grant_type': 'client_credentials'},
                timeout=10,
            )
            auth_resp.raise_for_status()
            access_token = auth_resp.json()['access_token']

            capture_resp = http_req.post(
                f'{base_url}/v2/checkout/orders/{order_id}/capture',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json',
                },
                timeout=10,
            )
            capture_resp.raise_for_status()
        except Exception as exc:
            logger.exception('PayPal capture failed')
            return error_response(f'PayPal payment capture failed: {exc}', status_code=500)

        capture = capture_resp.json()
        if capture.get('status') != 'COMPLETED':
            return error_response('PayPal payment was not completed.', status_code=400)

        capture_unit = capture['purchase_units'][0]['payments']['captures'][0]
        amount_captured = Decimal(capture_unit['amount']['value'])

        Payment.objects.create(
            invoice=invoice,
            amount=amount_captured,
            method='online',
            payment_date=timezone.localdate(),
            reference=ref_key,
            notes='PayPal payment',
            recorded_by=request.user,
        )

        _update_invoice_payment_status(invoice)
        invoice.refresh_from_db()

        return success_response(
            message='PayPal payment captured and recorded.',
            data={'invoice_status': invoice.status},
        )


class SupplierPaymentListView(APIView):
    """GET /api/v1/invoices/{id}/payments/ — supplier views payment history."""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        if request.user.role not in ('admin', 'supplier', 'accountant', 'viewer'):
            return error_response('Access denied.', status_code=403)

        try:
            invoice = Invoice.objects.get(id=invoice_id, is_active=True)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        payments = invoice.payments.filter(is_active=True).order_by('-payment_date')
        total_paid = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return success_response(data={
            'payments': PaymentSerializer(payments, many=True).data,
            'total_paid': str(total_paid),
            'amount_due': str(max(invoice.total_amount - total_paid, Decimal('0.00'))),
            'invoice_status': invoice.status,
        })
