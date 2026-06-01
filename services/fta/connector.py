"""
FTA Sandbox Connector.

Implements the UAE Federal Tax Authority (FTA) e-invoicing relay endpoint
integration — the "Corner 5" reporting flow. This connector handles:

  - Signed XML payload construction (signed per XAdES-BES)
  - HTTP submission to the FTA data platform (or sandbox)
  - Response parsing: accepted / pending / rejected
  - Polling for async outcomes when FTA returns HTTP 202
  - Structured rejection reason extraction
  - Full audit trail via FTASubmissionLog

UAE E-Invoicing Architecture (Corner 5):
  Supplier (Corner 1)
    → ASP / PEPPOL AP (Corner 2)
    → Buyer ASP (Corner 3)
    → Buyer (Corner 4)
    → FTA Data Platform (Corner 5) ← this connector

The FTA data platform endpoint requires:
  - mTLS: FTA-issued client certificate
  - Signed XML payload (XAdES-BES)
  - JSON wrapper with invoice metadata
  - Authorization header: Bearer {FTA_API_TOKEN}

Settings required:
  FTA_API_BASE_URL        — sandbox: https://sandbox.fta.gov.ae/einvoicing/api/v1
  FTA_API_TOKEN           — Bearer token issued by FTA portal
  FTA_CLIENT_CERT_PATH    — Path to FTA-issued client cert (PEM)
  FTA_CLIENT_KEY_PATH     — Path to private key for client cert
  FTA_CA_BUNDLE_PATH      — FTA CA bundle for server cert verification
  FTA_POLLING_MAX_ATTEMPTS— Max polling iterations for async responses (default 10)
  FTA_POLLING_INTERVAL_S  — Seconds between polling requests (default 30)
  PEPPOL_SIGNING_ENABLED  — If False, skip signing (dev only)
"""
import hashlib
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ─── Response status codes from FTA ──────────────────────────────────────────

FTA_STATUS_ACCEPTED  = 'accepted'
FTA_STATUS_PENDING   = 'pending'
FTA_STATUS_REJECTED  = 'rejected'
FTA_STATUS_ERROR     = 'error'

# HTTP timeouts (seconds)
_CONNECT_TIMEOUT = 10
_READ_TIMEOUT    = 30


# ─── Result dataclasses ───────────────────────────────────────────────────────

@dataclass
class FTARejectionDetail:
    """A single rejection reason returned by the FTA."""
    code:        str = ''
    description: str = ''
    field:       str = ''


@dataclass
class FTASubmissionResult:
    """
    Outcome of a single FTA submission attempt.

    status:          One of: accepted, pending, rejected, error
    fta_reference:   FTA-assigned reference (populated on acceptance)
    submission_id:   Our internal UUID for this attempt
    rejection_details: List of FTARejectionDetail on rejection
    raw_response:    Full JSON response dict (for audit log)
    http_status:     HTTP response code
    error_message:   Human-readable error (network / parse failures)
    duration_ms:     Round-trip time in milliseconds
    """
    status:            str   = FTA_STATUS_ERROR
    fta_reference:     str   = ''
    submission_id:     str   = field(default_factory=lambda: str(uuid.uuid4()))
    rejection_details: list  = field(default_factory=list)
    raw_response:      dict  = field(default_factory=dict)
    http_status:       int   = 0
    error_message:     str   = ''
    duration_ms:       int   = 0

    @property
    def is_accepted(self) -> bool:
        return self.status == FTA_STATUS_ACCEPTED

    @property
    def is_rejected(self) -> bool:
        return self.status == FTA_STATUS_REJECTED

    @property
    def is_pending(self) -> bool:
        return self.status == FTA_STATUS_PENDING


# ─── FTA Sandbox Connector ───────────────────────────────────────────────────

class FTASandboxConnector:
    """
    FTA e-invoicing data platform connector.

    Handles invoice submission, async polling, and rejection parsing.
    Thread-safe — instantiate once per Django app startup (or per task).

    Sandbox base URL: https://sandbox.fta.gov.ae/einvoicing/api/v1
    Production base URL: configured via FTA_API_BASE_URL setting
    """

    REPORT_ENDPOINT  = '/invoices/report'
    STATUS_ENDPOINT  = '/invoices/status/{reference}'
    HEALTH_ENDPOINT  = '/health'

    DEFAULT_POLLING_MAX  = 10
    DEFAULT_POLLING_SECS = 30

    def __init__(self):
        from django.conf import settings
        self._base_url   = getattr(settings, 'FTA_API_BASE_URL', '').rstrip('/')
        self._token      = getattr(settings, 'FTA_API_TOKEN', '')
        self._cert_path  = getattr(settings, 'FTA_CLIENT_CERT_PATH', '')
        self._key_path   = getattr(settings, 'FTA_CLIENT_KEY_PATH', '')
        self._ca_bundle  = getattr(settings, 'FTA_CA_BUNDLE_PATH', True)
        self._polling_max = int(getattr(settings, 'FTA_POLLING_MAX_ATTEMPTS', self.DEFAULT_POLLING_MAX))
        self._polling_secs = int(getattr(settings, 'FTA_POLLING_INTERVAL_S', self.DEFAULT_POLLING_SECS))
        self._signing_enabled = getattr(settings, 'PEPPOL_SIGNING_ENABLED', True)

    # ── Public API ─────────────────────────────────────────────────────────────

    def report(self, invoice, invoice_xml: bytes) -> FTASubmissionResult:
        """
        Submit an invoice to the FTA data platform and persist the result.

        Steps:
          1. Sign the XML payload (XAdES-BES) if signing is enabled
          2. Build the JSON wrapper expected by the FTA API
          3. POST to /invoices/report with mTLS + Bearer auth
          4. If HTTP 202 (async): poll /invoices/status/{ref} until resolved
          5. Parse acceptance / rejection response
          6. Write FTASubmissionLog record
          7. Update Invoice.fta_status field

        Args:
            invoice:      apps.invoices.models.Invoice instance
            invoice_xml:  Raw UBL XML bytes (pre-generated, pre-validated)

        Returns:
            FTASubmissionResult
        """
        if not self._base_url:
            logger.error('FTA_API_BASE_URL is not configured — cannot report invoice.')
            return FTASubmissionResult(
                status=FTA_STATUS_ERROR,
                error_message='FTA_API_BASE_URL not configured.',
            )

        signed_xml = self._sign_payload(invoice_xml)
        payload    = self._build_payload(invoice, signed_xml)

        start_ms = int(time.time() * 1000)
        result   = self._post_report(payload)
        result.duration_ms = int(time.time() * 1000) - start_ms

        # If FTA returned HTTP 202 Accepted → poll until resolved
        if result.is_pending and result.fta_reference:
            result = self._poll_until_resolved(result)

        self._persist_result(invoice, result, signed_xml)
        return result

    def check_health(self) -> bool:
        """Ping the FTA health endpoint. Returns True if reachable and healthy."""
        try:
            resp = self._session().get(
                self._base_url + self.HEALTH_ENDPOINT,
                timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
            )
            return resp.status_code == 200
        except Exception as exc:
            logger.warning('FTA health check failed: %s', exc)
            return False

    # ── Signing ────────────────────────────────────────────────────────────────

    def _sign_payload(self, invoice_xml: bytes) -> bytes:
        """Sign the invoice XML with XAdES-BES if signing is enabled."""
        if not self._signing_enabled:
            logger.debug('Signing disabled — submitting unsigned XML to FTA.')
            return invoice_xml

        try:
            from services.xml_signer import XAdESBESSigner
            signer = XAdESBESSigner()
            return signer.sign(invoice_xml)
        except Exception as exc:
            logger.error('XAdES-BES signing failed for FTA submission: %s', exc)
            raise

    # ── Payload construction ───────────────────────────────────────────────────

    def _build_payload(self, invoice, signed_xml: bytes) -> dict:
        """
        Build the JSON envelope required by the FTA API.

        The FTA spec requires a JSON wrapper containing invoice metadata
        alongside the base64-encoded signed XML document.
        """
        import base64
        company  = getattr(invoice, 'company',  None)
        customer = getattr(invoice, 'customer', None)

        payload_hash = hashlib.sha256(signed_xml).hexdigest()

        return {
            'submissionId':     str(uuid.uuid4()),
            'invoiceNumber':    getattr(invoice, 'invoice_number', ''),
            'invoiceType':      getattr(invoice, 'invoice_type', 'tax_invoice'),
            'issueDate':        str(getattr(invoice, 'issue_date', '')),
            'currency':         getattr(invoice, 'currency', 'AED'),
            'totalAmount':      str(getattr(invoice, 'total_amount', '0')),
            'vatAmount':        str(getattr(invoice, 'vat_amount', '0')),
            'sellerTrn':        getattr(company,  'trn', '') if company  else '',
            'buyerTrn':         getattr(customer, 'trn', '') or getattr(customer, 'vat_number', '') if customer else '',
            'buyerName':        getattr(customer, 'name', '') if customer else '',
            'xmlDocument':      base64.b64encode(signed_xml).decode('ascii'),
            'xmlDocumentHash':  payload_hash,
            'submittedAt':      datetime.now(timezone.utc).isoformat(),
        }

    # ── HTTP transport ─────────────────────────────────────────────────────────

    def _post_report(self, payload: dict) -> FTASubmissionResult:
        """POST the invoice report to the FTA endpoint."""
        url = self._base_url + self.REPORT_ENDPOINT
        try:
            resp = self._session().post(
                url,
                json=payload,
                timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
            )
        except requests.exceptions.SSLError as exc:
            logger.error('FTA mTLS error: %s', exc)
            return FTASubmissionResult(status=FTA_STATUS_ERROR, error_message=f'TLS error: {exc}')
        except requests.exceptions.ConnectionError as exc:
            logger.error('FTA connection error: %s', exc)
            return FTASubmissionResult(status=FTA_STATUS_ERROR, error_message=f'Connection error: {exc}')
        except requests.exceptions.Timeout:
            logger.error('FTA request timed out: %s', url)
            return FTASubmissionResult(status=FTA_STATUS_ERROR, error_message='Request timed out.')

        return self._parse_response(resp)

    def _poll_until_resolved(self, initial_result: FTASubmissionResult) -> FTASubmissionResult:
        """
        Poll FTA status endpoint until the async submission resolves.

        FTA returns HTTP 202 with a reference number for async processing.
        We poll GET /invoices/status/{reference} until status != 'pending'
        or max polling attempts are exhausted.
        """
        ref = initial_result.fta_reference
        logger.info('FTA submission pending — polling reference %s', ref)

        url = self._base_url + self.STATUS_ENDPOINT.format(reference=ref)

        for attempt in range(1, self._polling_max + 1):
            time.sleep(self._polling_secs)
            try:
                resp = self._session().get(url, timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT))
                result = self._parse_response(resp)
                if not result.is_pending:
                    logger.info(
                        'FTA polling resolved on attempt %d: status=%s ref=%s',
                        attempt, result.status, ref,
                    )
                    return result
                logger.debug('FTA still pending (attempt %d/%d)', attempt, self._polling_max)
            except Exception as exc:
                logger.warning('FTA polling error on attempt %d: %s', attempt, exc)

        logger.warning('FTA polling exhausted after %d attempts for ref %s', self._polling_max, ref)
        initial_result.error_message = f'Polling exhausted after {self._polling_max} attempts.'
        return initial_result

    # ── Response parsing ───────────────────────────────────────────────────────

    def _parse_response(self, resp: requests.Response) -> FTASubmissionResult:
        """
        Parse HTTP response from the FTA API.

        FTA API response schema:
          {
            "status":        "accepted" | "pending" | "rejected",
            "reference":     "FTA-2024-XXXX",         // on acceptance
            "submissionId":  "...",
            "errors": [
              {"code": "VAT-001", "description": "...", "field": "sellerTrn"}
            ]
          }
        """
        result = FTASubmissionResult(http_status=resp.status_code)

        try:
            body = resp.json()
        except Exception:
            body = {}
        result.raw_response = body

        if resp.status_code in (200, 201):
            result.status        = body.get('status', FTA_STATUS_ACCEPTED)
            result.fta_reference = body.get('reference', '')
            if result.status == FTA_STATUS_REJECTED:
                result.rejection_details = self._parse_rejections(body.get('errors', []))
                logger.warning(
                    'FTA rejected invoice: %d rejection(s)',
                    len(result.rejection_details),
                )
            else:
                logger.info('FTA accepted invoice: ref=%s', result.fta_reference)

        elif resp.status_code == 202:
            # Async processing — poll for result
            result.status        = FTA_STATUS_PENDING
            result.fta_reference = body.get('reference', body.get('submissionId', ''))
            logger.info('FTA accepted for async processing: ref=%s', result.fta_reference)

        elif resp.status_code == 400:
            result.status            = FTA_STATUS_REJECTED
            result.rejection_details = self._parse_rejections(body.get('errors', []))
            logger.warning('FTA rejected invoice (400): %s', body)

        elif resp.status_code == 401:
            result.status        = FTA_STATUS_ERROR
            result.error_message = 'FTA authentication failed — check FTA_API_TOKEN.'
            logger.error('FTA 401 Unauthorized')

        elif resp.status_code == 429:
            result.status        = FTA_STATUS_ERROR
            result.error_message = 'FTA rate limit exceeded — will retry.'
            logger.warning('FTA 429 rate limit')

        else:
            result.status        = FTA_STATUS_ERROR
            result.error_message = f'Unexpected FTA response: HTTP {resp.status_code}'
            logger.error('FTA unexpected response: %d — %s', resp.status_code, body)

        return result

    @staticmethod
    def _parse_rejections(errors: list) -> list:
        """Convert raw FTA error list to FTARejectionDetail instances."""
        details = []
        for err in errors:
            if isinstance(err, dict):
                details.append(FTARejectionDetail(
                    code=err.get('code', ''),
                    description=err.get('description', err.get('message', '')),
                    field=err.get('field', ''),
                ))
        return details

    # ── Persistence ────────────────────────────────────────────────────────────

    def _persist_result(
        self,
        invoice,
        result: FTASubmissionResult,
        signed_xml: bytes,
    ) -> None:
        """Write FTASubmissionLog and update invoice.fta_status."""
        from django.utils import timezone as dj_tz
        from apps.integrations.models import FTASubmissionLog

        try:
            rejection_text = '; '.join(
                f'{d.code}: {d.description}' for d in result.rejection_details
            ) if result.rejection_details else ''

            FTASubmissionLog.objects.create(
                invoice=invoice,
                status=result.status,
                fta_reference=result.fta_reference,
                response_payload=result.raw_response,
                error_message=rejection_text or result.error_message,
                reported_at=dj_tz.now(),
            )
        except Exception as exc:
            logger.error('Failed to write FTASubmissionLog: %s', exc)

        try:
            invoice.fta_status = result.status
            invoice.fta_reference = result.fta_reference
            invoice.save(update_fields=['fta_status', 'fta_reference', 'updated_at'])
        except Exception as exc:
            logger.error('Failed to update invoice.fta_status: %s', exc)

    # ── Session ────────────────────────────────────────────────────────────────

    def _session(self) -> requests.Session:
        """
        Build an authenticated requests.Session with mTLS and Bearer token.

        The session is created fresh per call so that cert rotation takes
        effect without restarting workers.
        """
        session = requests.Session()
        session.headers.update({
            'Authorization': f'Bearer {self._token}',
            'Content-Type':  'application/json',
            'Accept':        'application/json',
            'X-FTA-Client':  'UAE-EInvoicing-Platform/1.0',
        })
        # mTLS client certificate
        if self._cert_path and self._key_path:
            session.cert = (self._cert_path, self._key_path)

        # Server certificate verification
        session.verify = self._ca_bundle
        return session
