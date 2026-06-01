"""
Integrations API views.

Endpoints:
  GET  /api/v1/integrations/invoices/{invoice_id}/logs/
       — list all ASP submission attempts for a given invoice

  GET  /api/v1/integrations/invoices/{invoice_id}/timeline/
       — full 5-corner flow status + chronological event log

  POST /api/v1/integrations/asp/webhook/
       — receive status-change callbacks from the ASP (Corner 2 → our system)
"""
import hashlib
import hmac
import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response
from apps.invoices.models import Invoice, InvoiceAuditLog
from apps.companies.permissions import IsCompanyMember
from apps.companies.models import CompanyMember
from .models import ASPSubmissionLog
from .serializers import ASPSubmissionLogSerializer, ASPWebhookSerializer
from apps.common.constants import (
    INVOICE_STATUS_VALIDATED,
    INVOICE_STATUS_REJECTED,
)

logger = logging.getLogger(__name__)


def _verify_asp_webhook_signature(request) -> bool:
    """
    Verify HMAC-SHA256 signature sent by the ASP in X-ASP-Signature header.

    The ASP computes:  HMAC-SHA256(secret_key, request_body_bytes)
    We re-compute the same and compare in constant time to prevent timing attacks.

    Returns True if signature is valid or if webhook secret is not configured
    (dev/test mode — logs a WARNING so it's visible in production logs).
    """
    secret = getattr(settings, 'ASP_WEBHOOK_SECRET', '')
    if not secret:
        logger.warning(
            'ASP_WEBHOOK_SECRET not configured — skipping HMAC verification. '
            'This is a SECURITY RISK in production.'
        )
        return True  # Allow in dev; in prod, enforce via REQUIRE_ASP_WEBHOOK_SECRET setting

    # Enforce strict mode in production
    if not getattr(settings, 'DEBUG', True) and not secret:
        logger.error('ASP_WEBHOOK_SECRET must be set in production.')
        return False

    provided_sig = request.headers.get('X-ASP-Signature', '')
    if not provided_sig:
        logger.warning('ASP webhook received without X-ASP-Signature header.')
        return False

    expected_sig = hmac.new(
        secret.encode('utf-8'),
        request.body,
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison prevents timing-based signature oracle attacks
    return hmac.compare_digest(provided_sig.lower(), expected_sig.lower())


class InvoiceSubmissionLogsView(APIView):
    """
    GET /api/v1/integrations/invoices/{invoice_id}/logs/

    Returns the ordered audit trail of all ASP submission attempts for
    a specific invoice. Only accessible to members of the owning company.
    """
    permission_classes = [IsCompanyMember]

    def get(self, request, invoice_id):
        try:
            invoice = Invoice.objects.select_related('company').get(
                id=invoice_id,
                company=request.company_membership.company,
                is_active=True,
            )
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        logs = (
            ASPSubmissionLog.objects
            .filter(invoice=invoice)
            .order_by('submitted_at')
        )
        serializer = ASPSubmissionLogSerializer(logs, many=True)
        return success_response(serializer.data)


class ASPWebhookView(APIView):
    """
    POST /api/v1/integrations/asp/webhook/

    Receives status-change callbacks pushed by the ASP.

    Security note:
      In production this endpoint MUST be protected by a shared-secret
      HMAC signature check (X-ASP-Signature header). The signature
      verification hook is intentionally left as a stub here — configure
      it via settings.ASP_WEBHOOK_SECRET once issued by your ASP.

    Flow:
      1. Validate payload
      2. Locate invoice by submission_id or invoice_number
      3. Transition invoice to validated / rejected
      4. Return 200 to acknowledge receipt (ASP will retry on non-2xx)
    """
    permission_classes = [AllowAny]   # signature-verified, not JWT-authenticated

    def post(self, request):
        # ── Step 0: Verify HMAC signature ─────────────────────────────────────
        if not _verify_asp_webhook_signature(request):
            logger.warning(
                'ASP webhook rejected: invalid HMAC signature. IP=%s',
                request.META.get('REMOTE_ADDR', 'unknown'),
            )
            return error_response('Invalid webhook signature.', status_code=403)

        # ── Step 1: Validate payload ───────────────────────────────────────────
        serializer = ASPWebhookSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning('ASP webhook received invalid payload: %s', serializer.errors)
            return error_response(
                'Invalid webhook payload.',
                details=serializer.errors,
                status_code=400,
            )

        payload = serializer.validated_data
        submission_id = payload['submission_id']
        asp_status = payload['status']

        logger.info(
            'ASP webhook received: submission_id=%s status=%s',
            submission_id, asp_status
        )

        # ── Step 2: Locate invoice ─────────────────────────────────────────────
        try:
            invoice = Invoice.objects.get(asp_submission_id=submission_id)
        except Invoice.DoesNotExist:
            # Could be a duplicate webhook for an already-processed invoice
            logger.warning('ASP webhook: no invoice found for submission_id=%s', submission_id)
            # Return 200 anyway — the ASP should not retry an unknown submission
            return success_response({'acknowledged': True, 'matched': False})

        # ── Step 3: Apply status transition ───────────────────────────────────
        new_status = None
        if asp_status == 'validated':
            new_status = INVOICE_STATUS_VALIDATED
        elif asp_status == 'rejected':
            new_status = INVOICE_STATUS_REJECTED

        if new_status and invoice.status not in (INVOICE_STATUS_VALIDATED, INVOICE_STATUS_REJECTED):
            Invoice.objects.filter(pk=invoice.pk).update(
                status=new_status,
                asp_response=payload.get('raw_payload') or request.data,
                updated_at=timezone.now(),
            )
            logger.info(
                'Invoice %s transitioned to %s via ASP webhook.',
                invoice.invoice_number, new_status
            )

            # Audit log the webhook-driven status change
            invoice.refresh_from_db(fields=['status'])
            InvoiceAuditLog.log(
                invoice=invoice,
                action=(
                    InvoiceAuditLog.ACTION_VALIDATED
                    if new_status == INVOICE_STATUS_VALIDATED
                    else InvoiceAuditLog.ACTION_REJECTED
                ),
                description=f'Status set to {new_status} via ASP webhook callback.',
                metadata={'submission_id': submission_id, 'asp_status': asp_status},
            )

            # Corner 5: Trigger FTA reporting asynchronously for validated invoices
            if new_status == INVOICE_STATUS_VALIDATED:
                try:
                    from tasks.fta_tasks import report_invoice_to_fta
                    report_invoice_to_fta.apply_async(
                        args=[str(invoice.id)],
                        queue='celery',
                        countdown=5,  # brief delay to let DB settle
                    )
                except Exception as exc:
                    logger.error(
                        'Could not enqueue FTA task for invoice %s: %s',
                        invoice.invoice_number, exc
                    )

        # ── Step 4: Acknowledge ────────────────────────────────────────────────
        return success_response(
            {'acknowledged': True, 'invoice_number': invoice.invoice_number},
            status_code=200,
        )


# ─── Invoice Timeline / 5-Corner Flow ────────────────────────────────────────

class InvoiceTimelineView(APIView):
    """
    GET /api/v1/integrations/invoices/{invoice_id}/timeline/

    Returns the complete 5-corner PEPPOL flow state and a chronological
    event log for a specific invoice. Used by the frontend FlowTracker.

    Response shape:
    {
      "invoice_id": "...",
      "invoice_number": "...",
      "current_status": "validated",
      "flow": [
        { "corner": 1, "label": "Invoice Created", "status": "complete", ... },
        ...
      ],
      "events": [
        { "type": "created", "corner": 1, "title": "...", "timestamp": "...", ... },
        ...
      ]
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        # Resolve invoice + verify caller is a company member
        try:
            invoice = Invoice.objects.select_related(
                'company', 'customer', 'created_by'
            ).get(id=invoice_id, is_active=True)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', status_code=404)

        # Membership check
        is_member = CompanyMember.objects.filter(
            user=request.user,
            company=invoice.company,
            is_active=True,
        ).exists()
        if not is_member:
            return error_response('Invoice not found.', status_code=404)

        events = _build_events(invoice)
        flow   = _build_flow(invoice)

        return success_response(data={
            'invoice_id':     str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'current_status': invoice.status,
            'flow':           flow,
            'events':         sorted(events, key=lambda e: e['timestamp']),
        })


# ─── Timeline Helpers ─────────────────────────────────────────────────────────

def _iso(dt) -> str:
    """Return ISO 8601 string or empty string if None."""
    return dt.isoformat() if dt else ''


def _build_events(invoice) -> list:
    """Aggregate all events from invoice + ASP logs + FTA logs into a flat list."""
    events = []

    # C1 — Invoice created
    events.append({
        'type':        'created',
        'corner':      1,
        'timestamp':   _iso(invoice.created_at),
        'title':       'Invoice Created',
        'description': (
            f'Invoice {invoice.invoice_number} created'
            + (f' by {invoice.created_by.full_name}' if invoice.created_by else '')
        ),
        'status':      'complete',
        'data':        {'invoice_number': invoice.invoice_number},
    })

    # C1 — XML generated
    if invoice.xml_generated_at:
        events.append({
            'type':        'xml_generated',
            'corner':      1,
            'timestamp':   _iso(invoice.xml_generated_at),
            'title':       'UBL XML Generated',
            'description': 'PEPPOL BIS 3.0 UBL 2.1 XML document created.',
            'status':      'complete',
            'data':        {},
        })

    # C1→C2 — Submitted for processing (status left DRAFT)
    if invoice.status not in ('draft', 'cancelled'):
        events.append({
            'type':        'submitted_for_processing',
            'corner':      1,
            'timestamp':   _iso(invoice.updated_at),
            'title':       'Submitted for ASP Processing',
            'description': 'Invoice queued via Celery for validation and ASP transmission.',
            'status':      'complete',
            'data':        {},
        })

    # C2 — Each ASP transmission attempt
    for log in invoice.submission_logs.order_by('submitted_at'):
        status_map = {
            'accepted': 'complete',
            'rejected': 'error',
            'pending':  'processing',
            'error':    'error',
        }
        events.append({
            'type':        f'asp_{log.status}',
            'corner':      2,
            'timestamp':   _iso(log.submitted_at),
            'title':       f'ASP Transmission — Attempt #{log.attempt_number}',
            'description': (
                log.error_message
                or f'Submission ID: {log.submission_id}'
                or 'Sent to Accredited Service Provider.'
            ),
            'status':      status_map.get(log.status, 'processing'),
            'data': {
                'submission_id':    log.submission_id,
                'attempt':          log.attempt_number,
                'xml_size_bytes':   log.request_size_bytes,
                'asp_status':       log.status,
            },
        })

    # C3/C4 — Invoice validated / delivered to buyer
    if invoice.asp_submitted_at and invoice.status in (
        'submitted', 'validated', 'paid'
    ):
        events.append({
            'type':        'peppol_delivered',
            'corner':      3,
            'timestamp':   _iso(invoice.asp_submitted_at),
            'title':       'Transmitted via OpenPEPPOL Network',
            'description': (
                f'Sending ASP confirmed transmission to receiving ASP. '
                f'Submission ID: {invoice.asp_submission_id}'
            ),
            'status':      'complete',
            'data':        {'asp_submission_id': invoice.asp_submission_id},
        })

    if invoice.status in ('validated', 'paid'):
        events.append({
            'type':        'buyer_received',
            'corner':      4,
            'timestamp':   _iso(invoice.asp_submitted_at),
            'title':       'Delivered to Buyer',
            'description': (
                f'Invoice data delivered to {invoice.customer.name}\'s '
                f'business software via receiving ASP.'
            ),
            'status':      'complete',
            'data':        {'customer_name': invoice.customer.name},
        })

    # C5 — FTA reporting attempts
    for log in invoice.fta_logs.order_by('reported_at'):
        status_map = {
            'reported': 'complete',
            'error':    'error',
            'pending':  'processing',
        }
        events.append({
            'type':        f'fta_{log.status}',
            'corner':      5,
            'timestamp':   _iso(log.reported_at),
            'title':       'FTA Data Platform Reporting',
            'description': (
                log.error_message
                or f'FTA Reference: {log.fta_reference}'
                or 'Invoice extract submitted to UAE Ministry of Finance.'
            ),
            'status':      status_map.get(log.status, 'processing'),
            'data':        {'fta_reference': log.fta_reference},
        })

    return events


def _build_flow(invoice) -> list:
    """
    Map invoice status to per-corner states for the FlowTracker UI.

    Returns 5 objects, one per PEPPOL corner:
      corner 1 — Supplier (our system)
      corner 2 — Sending ASP (validate + transmit)
      corner 3 — Receiving ASP (deliver via PEPPOL)
      corner 4 — Buyer ERP
      corner 5 — FTA data platform
    """
    inv_status = invoice.status
    c1_ts = _iso(invoice.created_at)
    c2_ts = _iso(invoice.asp_submitted_at)
    c5_ts = _iso(invoice.fta_reported_at)

    def corner(num, label, sublabel, description, st, timestamp=''):
        return {
            'corner':      num,
            'label':       label,
            'sublabel':    sublabel,
            'description': description,
            'status':      st,       # idle | processing | complete | error
            'timestamp':   timestamp,
        }

    idle    = 'idle'
    proc    = 'processing'
    done    = 'complete'
    err     = 'error'

    if inv_status == 'draft':
        return [
            corner(1, 'Invoice Created',       'Corner 1 — Supplier',         'Invoice saved as draft — submit to ASP to continue',      done, c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'Awaiting submission — click "Submit to ASP" to proceed',  idle),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Receiving ASP delivers to buyer software',                 idle),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            'Buyer business software populated with invoice',           idle),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'ASP reports invoice extract to FTA data platform',      idle),
        ]
    elif inv_status == 'pending':
        return [
            corner(1, 'Invoice Created',       'Corner 1 — Supplier',         'Invoice submitted for ASP processing',                     done, c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'Validating standards & preparing transmission',            proc),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Receiving ASP delivers to buyer software',                 idle),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            'Buyer business software populated with invoice',           idle),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'ASP reports invoice extract to FTA data platform',      idle),
        ]
    elif inv_status == 'submitted':
        return [
            corner(1, 'Invoice Created',       'Corner 1 — Supplier',         'Invoice submitted for ASP processing',                     done, c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'XML transmitted — awaiting ASP validation result',         proc, c2_ts),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Waiting for transmission confirmation',                    idle),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            'Buyer business software populated with invoice',           idle),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'ASP reports invoice extract to FTA data platform',      idle),
        ]
    elif inv_status in ('validated', 'paid'):
        fta_state = (
            done if invoice.fta_status == 'reported'
            else err  if invoice.fta_status == 'error'
            else proc
        )
        return [
            corner(1, 'Invoice Created',       'Corner 1 — Supplier',         'Invoice created and submitted for processing',              done, c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'Invoice validated by Accredited Service Provider',         done, c2_ts),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Invoice transmitted via OpenPEPPOL network',               done, c2_ts),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            f'Invoice data delivered to {invoice.customer.name}',       done, c2_ts),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'Invoice extract reported to UAE FTA data platform',     fta_state, c5_ts),
        ]
    elif inv_status == 'rejected':
        return [
            corner(1, 'Invoice Created',       'Corner 1 — Supplier',         'Invoice submitted for ASP processing',                     done, c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'Invoice rejected by ASP — review errors and resubmit',     err,  c2_ts),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Not transmitted — invoice must be corrected',              idle),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            'Invoice not delivered',                                    idle),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'Not applicable for rejected invoices',                  idle),
        ]
    elif inv_status == 'cancelled':
        return [
            corner(1, 'Invoice Cancelled',     'Corner 1 — Supplier',         'Invoice was cancelled before ASP submission',              err,  c1_ts),
            corner(2, 'ASP Validation',        'Corner 2 — Sending ASP',      'Invoice was not submitted to ASP',                         idle),
            corner(3, 'PEPPOL Delivery',       'Corner 3 — Receiving ASP',    'Not applicable',                                           idle),
            corner(4, 'Buyer Receives',        'Corner 4 — Buyer',            'Not applicable',                                           idle),
            corner(5, 'FTA Reporting',         'Corner 5 — Ministry of Finance', 'Not applicable',                                        idle),
        ]
    else:
        return []


# ─── PEPPOL Participant Lookup ────────────────────────────────────────────────

class PEPPOLParticipantLookupView(APIView):
    """
    GET /api/v1/integrations/peppol/lookup/?participant_id=0235:123456789

    Checks whether a PEPPOL participant is registered on the network and,
    if so, returns their AS4 endpoint information via SMP lookup.

    Used by the frontend to verify buyer PEPPOL registration before
    sending an invoice via the OpenPEPPOL network.

    Query params:
      participant_id  Full PEPPOL participant ID (e.g. '0235:123456789012345')
                      or bare UAE TRN/TIN (will be prefixed with '0235:')

    Response:
      {
        "registered": true,
        "participant_id": "0235:123456789012345",
        "transport_url": "https://...",
        "transport_profile": "peppol-transport-as4-v2_0",
        "from_cache": false
      }
    """
    permission_classes = [IsAuthenticated]

    # UA PEPPOL scheme identifier
    UAE_SCHEME = '0235'

    def get(self, request):
        raw_id = request.query_params.get('participant_id', '').strip()
        if not raw_id:
            return error_response(
                'participant_id query parameter is required. '
                'Example: ?participant_id=0235:123456789012345',
                status_code=400,
            )

        # Normalise: if caller passed a bare TRN/TIN without a scheme prefix, add UAE scheme
        participant_id = raw_id if ':' in raw_id else f'{self.UAE_SCHEME}:{raw_id}'

        # Basic format check: scheme:identifier, at least 3 chars each side
        parts = participant_id.split(':', 1)
        if len(parts) != 2 or len(parts[0]) < 2 or len(parts[1]) < 3:
            return error_response(
                f'Invalid participant_id format: "{participant_id}". '
                'Expected format: scheme:identifier (e.g. 0235:123456789012345).',
                status_code=400,
            )

        logger.info(
            'PEPPOL lookup requested by user=%s for participant=%s',
            request.user.email, participant_id,
        )

        try:
            from services.smp_client import SMPClient, PEPPOL_INVOICE_DOCTYPE
            client   = SMPClient()
            endpoint = client.lookup(participant_id, PEPPOL_INVOICE_DOCTYPE)
        except Exception as exc:
            logger.error(
                'PEPPOL SMP lookup error for participant=%s: %s',
                participant_id, exc, exc_info=True,
            )
            return error_response(
                'SMP lookup failed due to an internal error. Please try again later.',
                status_code=503,
            )

        if endpoint is None:
            return success_response({
                'registered':       False,
                'participant_id':   participant_id,
                'transport_url':    None,
                'transport_profile': None,
                'from_cache':       False,
                'message': (
                    f'Participant {participant_id} is not registered on the '
                    'PEPPOL network for PEPPOL BIS Billing 3.0 invoices. '
                    'Invoices must be sent via email or another channel.'
                ),
            })

        return success_response({
            'registered':        True,
            'participant_id':    participant_id,
            'transport_url':     endpoint.transport_url,
            'transport_profile': endpoint.transport_profile,
            'from_cache':        endpoint.from_cache,
            'message': (
                f'Participant {participant_id} is registered. '
                'Invoices can be delivered via the PEPPOL AS4 network.'
            ),
        })
