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


# ─── PEPPOL AS4 Inbound (Corner 3) ────────────────────────────────────────────

class AS4ReceiveView(APIView):
    """
    POST /api/v1/inbound/as4/   — PEPPOL AS4/ebMS3 receiving endpoint (Corner 3).

    Public, machine-to-machine endpoint. Other Access Points POST signed AS4
    (MTOM/SOAP) messages here. We:
      1. Parse the MTOM body → SOAP + payload
      2. Verify the WS-Security signature
      3. Extract & persist the inbound UBL invoice
      4. Return a signed AS4 Receipt (synchronous ack)

    Authentication is via the message signature / mutual-TLS at the proxy — NOT JWT.
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = []   # do not parse — we need the raw multipart body

    def post(self, request):
        from django.http import HttpResponse
        from services.as4.receiver import AS4Receiver

        content_type = request.META.get('CONTENT_TYPE', '')
        raw_body = request.body or b''

        # Debug capture: when PEPPOL_AS4_DEBUG_CAPTURE=True, dump the raw inbound
        # message so we can analyse exactly what a sending AP (e.g. the PEPPOL
        # Testbed) transmits, and build spec-exact signature verification.
        from django.conf import settings as _settings
        if getattr(_settings, 'PEPPOL_AS4_DEBUG_CAPTURE', False):
            try:
                import os
                from datetime import datetime, timezone as _tz
                dbg_dir = os.path.join(_settings.MEDIA_ROOT, 'as4_debug')
                os.makedirs(dbg_dir, exist_ok=True)
                ts = datetime.now(tz=_tz.utc).strftime('%Y%m%dT%H%M%S_%f')
                with open(os.path.join(dbg_dir, f'{ts}.bin'), 'wb') as fh:
                    fh.write(f'Content-Type: {content_type}\r\n\r\n'.encode())
                    fh.write(raw_body)
                logger.info('AS4 debug capture saved: %s.bin (%d bytes)', ts, len(raw_body))
            except Exception as _exc:
                logger.warning('AS4 debug capture failed: %s', _exc)

        result = AS4Receiver().receive(content_type, raw_body)

        if not result.success:
            logger.warning('AS4 inbound rejected: %s (code=%s)', result.errors, result.error_code)
            # ebMS error — respond 400 with a short diagnostic
            return HttpResponse(
                f'<error code="{result.error_code}">{"; ".join(result.errors)}</error>',
                status=status.HTTP_400_BAD_REQUEST,
                content_type='application/xml',
            )

        # Persist the received invoice (best-effort — never block the AS4 ack)
        try:
            InboundInvoiceService.ingest_as4_message(
                message_id=result.message_id,
                sender_id=result.sender_id,
                receiver_id=result.receiver_id,
                payload_xml=result.payload_xml,
                signature_valid=result.signature_valid,
            )
        except Exception as exc:
            logger.exception('AS4 inbound: persistence failed for %s: %s', result.message_id, exc)

        # PINT-AE: answer received Invoices/Credit Notes with a Message Level
        # Status (MLS). Skip ApplicationResponses (received MLS) to avoid loops.
        self._maybe_send_mls(result.payload_xml, result.conversation_id, result.message_id)

        # UAE 5-corner (AE TDD): after receiving a PINT-AE invoice, generate a Tax
        # Data Document and submit it to the Tax Authority (C5). Skipped for
        # ApplicationResponse/TaxData payloads.
        self._maybe_submit_tdd(result.payload_xml)

        logger.info('AS4 inbound accepted: msg=%s sender=%s', result.message_id, result.sender_id)
        return HttpResponse(
            result.receipt_xml or b'<ack/>',
            status=status.HTTP_200_OK,
            content_type='application/soap+xml',
        )

    @staticmethod
    def _maybe_send_mls(payload_xml, conversation_id: str = '', ref_to_message_id: str = '') -> None:
        """
        Dispatch a Message Level Status for a received PINT-AE business document.

        Runs asynchronously (Celery) so the AS4 receipt response is not delayed;
        falls back to a synchronous send if Celery is unavailable. Received MLS
        (ApplicationResponse) documents are ignored to prevent reply loops.
        """
        if not payload_xml:
            return
        try:
            from lxml import etree as _et
            root = _et.fromstring(payload_xml)
            local_names = {_et.QName(el).localname for el in root.iter()}
            # Only invoices and credit notes get an MLS reply.
            if not ({'Invoice', 'CreditNote'} & local_names):
                return
            if 'ApplicationResponse' in local_names:
                return
        except Exception as exc:
            logger.debug('AS4 inbound: could not inspect payload for MLS: %s', exc)
            return

        import base64
        sbd_b64 = base64.b64encode(payload_xml).decode('ascii')
        try:
            from tasks.as4_tasks import send_mls_for_received as _mls_task
            _mls_task.delay(sbd_b64, conversation_id, ref_to_message_id)
            logger.info('AS4 inbound: MLS dispatched (async).')
        except Exception:
            # Celery unavailable. Do NOT send the MLS inline — that would block the
            # AS4 receipt and, critically, deliver the MLS to the sender BEFORE it
            # has received our receipt for the business document. The testbed only
            # arms its "awaiting MLS" state after our receipt is processed, so an
            # MLS that arrives first is discarded → "MLS not received". Defer the
            # send to a background thread with a short delay so the receipt goes
            # out (and is processed by C2) first.
            import threading, time
            from django.conf import settings as _settings
            delay = getattr(_settings, 'MLS_SEND_DELAY_SECONDS', 10)

            def _deferred_send():
                time.sleep(delay)
                try:
                    from services.peppol.mls import send_mls_for_received as _send
                    r = _send(payload_xml, conversation_id=conversation_id,
                              ref_to_message_id=ref_to_message_id)
                    logger.info('AS4 inbound: MLS %s sent=%s (%s)', r.response_code, r.sent, r.errors)
                except Exception as exc:
                    logger.error('AS4 inbound: deferred MLS send failed: %s', exc)

            logger.warning('AS4 inbound: Celery unavailable — sending MLS via background thread '
                           '(delay=%ss, after receipt).', delay)
            threading.Thread(target=_deferred_send, daemon=True).start()

    @staticmethod
    def _maybe_submit_tdd(payload_xml) -> None:
        """
        Generate an AE Tax Data Document for a received PINT-AE invoice and submit
        it to the Tax Authority (C5). Runs in a background thread so the AS4 receipt
        is not delayed. Only invoices/credit notes trigger a TDD; ApplicationResponse
        (MLS) and TaxData payloads are ignored.
        """
        if not payload_xml:
            return
        from django.conf import settings as _settings
        if not getattr(_settings, 'PEPPOL_TDD_ENABLED', True):
            return
        try:
            from lxml import etree as _et
            root = _et.fromstring(payload_xml)
            local_names = {_et.QName(el).localname for el in root.iter()}
            if not ({'Invoice', 'CreditNote'} & local_names):
                return
            if {'ApplicationResponse', 'TaxData'} & local_names:
                return
        except Exception as exc:
            logger.debug('AS4 inbound: could not inspect payload for TDD: %s', exc)
            return

        import threading

        def _deferred_tdd():
            try:
                from services.peppol.tdd import submit_tdd_for_received
                r = submit_tdd_for_received(payload_xml)
                logger.info('AS4 inbound: TDD built=%s valid=%s sent=%s receipt=%s (%s)',
                            r.built, r.valid, r.sent, r.receipt, r.errors)
            except Exception as exc:
                logger.error('AS4 inbound: TDD submission failed: %s', exc)

        logger.info('AS4 inbound: submitting AE TDD to C5 via background thread.')
        threading.Thread(target=_deferred_tdd, daemon=True).start()


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
        qs = (InboundInvoice.objects
              .select_related('supplier', 'receiving_company')
              .prefetch_related('observations')
              .all())

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
    body_html = """
      <p style="margin:0;">You have been registered as an inbound supplier on the E-Numerak
      e-invoicing platform. Activate your account to set your password and access your Supplier Portal.</p>
      <p style="margin:16px 0 6px;font-weight:600;color:#0f172a;">Once activated, you can:</p>
      <ul style="margin:0;padding-left:18px;color:#334155;">
        <li>Log in to your Supplier Portal dashboard</li>
        <li>Track the status of invoices you have submitted</li>
        <li>View validation observations and feedback</li>
      </ul>
      <p style="margin:16px 0 0;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;
                padding:10px 14px;font-size:13px;color:#92400e;">
        This activation link is valid for <strong>7 days</strong>.
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
        Your API key for programmatic submission will be provided separately. If you did not expect this
        invitation, please ignore this email.</p>"""
    from services.emails import send_branded_email
    if not send_branded_email(
        subject='Activate your E-Numerak Supplier Portal account',
        to=supplier.email,
        heading='Activate your Supplier Portal account',
        intro=f'Hello {supplier.name},',
        body_html=body_html,
        cta_label='Activate Account',
        cta_url=activation_link,
        preheader='Activate your E-Numerak Supplier Portal account.',
    ):
        logger.warning('Failed to send activation email to %s', supplier.email)


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
