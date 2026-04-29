"""
ASP HTTP Client — Corner 2 in PEPPOL 5-corner model.

This client handles the actual HTTP communication with the
Accredited Service Provider (ASP) API.

Architecture:
  The ASP is the only entity that can connect directly to the UAE
  e-invoicing infrastructure (FTA / Corner 5). Taxpayers connect
  to the ASP, which validates, transmits, and reports invoices.

Current implementation:
  MockASPClient — simulates ASP responses for development/testing.
  RealASPClient — production client (swap in via settings).

To use the real ASP, set in .env:
  ASP_CLIENT_CLASS=apps.integrations.asp.client.RealASPClient
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Optional
from django.conf import settings

logger = logging.getLogger(__name__)


# ─── Response Data Class ──────────────────────────────────────────────────────

@dataclass
class ASPResponse:
    """
    Normalised response from the ASP after invoice submission.

    status:        'accepted' | 'rejected' | 'pending' | 'error'
    submission_id: ASP-assigned transaction ID (store on invoice)
    message:       Human-readable status message
    errors:        List of validation errors returned by ASP
    raw:           Complete raw response payload for audit log
    """
    status:        str
    submission_id: str             = ''
    message:       str             = ''
    errors:        list[str]       = field(default_factory=list)
    raw:           dict            = field(default_factory=dict)

    @property
    def is_accepted(self) -> bool:
        return self.status == 'accepted'

    @property
    def is_rejected(self) -> bool:
        return self.status == 'rejected'

    @property
    def is_pending(self) -> bool:
        """ASP accepted for processing but result not yet available."""
        return self.status == 'pending'


# ─── Mock ASP Client ──────────────────────────────────────────────────────────

class MockASPClient:
    """
    Simulates ASP API responses for development and testing.

    Behaviour:
      - Invoices with total_amount > 0          → accepted
      - Invoices with reference_number='REJECT' → rejected (for testing)
      - Default: accepted with a mock submission_id

    Replace with RealASPClient in production by updating ASP_CLIENT_CLASS setting.
    """

    def submit_invoice(
        self,
        xml_bytes: bytes,
        invoice_number: str,
        company_trn: str,
    ) -> ASPResponse:
        """
        Simulate submitting an invoice XML to the ASP.

        Args:
            xml_bytes:      Raw UBL 2.1 XML payload
            invoice_number: Invoice number (for logging/tracking)
            company_trn:    Supplier TRN (used as sender identifier)

        Returns:
            ASPResponse with status and submission_id
        """
        logger.info(
            '[MOCK ASP] Submitting invoice: %s (TRN: %s, %d bytes)',
            invoice_number, company_trn, len(xml_bytes)
        )

        # Simulate network latency (remove in production)
        time.sleep(0.1)

        # Simulate rejection for test invoices
        if 'REJECT' in invoice_number.upper():
            return ASPResponse(
                status='rejected',
                submission_id='',
                message='Invoice rejected: VAT amount mismatch detected.',
                errors=[
                    'VAT-001: TaxTotal amount does not match sum of TaxSubtotal amounts.',
                ],
                raw={
                    'status': 'REJECTED',
                    'invoiceNumber': invoice_number,
                    'errors': ['VAT-001: TaxTotal amount mismatch'],
                    'timestamp': _timestamp(),
                }
            )

        # Invoice queued at ASP — awaiting async validation (not immediately accepted)
        submission_id = f'ASP-{invoice_number}-{_timestamp()}'
        return ASPResponse(
            status='pending',
            submission_id=submission_id,
            message='Invoice received and queued for ASP validation.',
            errors=[],
            raw={
                'status': 'PENDING',
                'submissionId': submission_id,
                'invoiceNumber': invoice_number,
                'timestamp': _timestamp(),
                'ftaReportingStatus': 'QUEUED',
            }
        )

    def check_status(self, submission_id: str) -> ASPResponse:
        """
        Poll ASP for the current status of a previously submitted invoice.
        In production: call GET /api/v1/submissions/{submission_id}

        Mock returns 'pending' — validation must be done manually by admin.
        """
        logger.info('[MOCK ASP] Checking status for submission: %s', submission_id)

        return ASPResponse(
            status='pending',
            submission_id=submission_id,
            message='Invoice is awaiting ASP validation.',
            raw={
                'status': 'PENDING',
                'submissionId': submission_id,
                'ftaReportingStatus': 'QUEUED',
                'timestamp': _timestamp(),
            }
        )


# ─── Real ASP Client ──────────────────────────────────────────────────────────

class RealASPClient:
    """
    Production HTTP client for the UAE ASP API.

    Configure via environment:
      ASP_API_BASE_URL  — base URL of the ASP REST API
      ASP_API_KEY       — API key / Bearer token
      ASP_TIMEOUT_SECONDS — request timeout (default 30s)

    Endpoints (example — adjust per your ASP's specification):
      POST {base_url}/invoices/submit  — submit invoice XML
      GET  {base_url}/invoices/{id}    — check submission status
    """

    def __init__(self):
        import requests
        self._session = requests.Session()
        self._session.headers.update({
            'Authorization': f'Bearer {settings.ASP_API_KEY}',
            'Content-Type':  'application/xml',
            'Accept':        'application/json',
        })
        self._base_url = settings.ASP_API_BASE_URL.rstrip('/')
        self._timeout  = settings.ASP_TIMEOUT_SECONDS

    def submit_invoice(
        self,
        xml_bytes: bytes,
        invoice_number: str,
        company_trn: str,
    ) -> ASPResponse:
        """Submit invoice XML to the real ASP endpoint."""
        url = f'{self._base_url}/invoices/submit'

        try:
            response = self._session.post(
                url,
                data=xml_bytes,
                headers={
                    'X-Invoice-Number': invoice_number,
                    'X-Company-TRN':    company_trn,
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            data = response.json()
            return self._parse_submit_response(data)

        except Exception as exc:
            logger.error('ASP submission failed for %s: %s', invoice_number, exc)
            return ASPResponse(
                status='error',
                message=f'ASP communication error: {exc}',
                raw={'error': str(exc)},
            )

    def check_status(self, submission_id: str) -> ASPResponse:
        """Poll the ASP for the current status of a submission."""
        url = f'{self._base_url}/invoices/{submission_id}'

        try:
            response = self._session.get(url, timeout=self._timeout)
            response.raise_for_status()
            data = response.json()
            return self._parse_status_response(data)

        except Exception as exc:
            logger.error('ASP status check failed for %s: %s', submission_id, exc)
            return ASPResponse(
                status='error',
                message=f'ASP status check error: {exc}',
                raw={'error': str(exc)},
            )

    def _parse_submit_response(self, data: dict) -> ASPResponse:
        """Normalise ASP submit response to ASPResponse."""
        asp_status = data.get('status', '').upper()
        status_map = {
            'ACCEPTED': 'accepted',
            'REJECTED': 'rejected',
            'PENDING':  'pending',
        }
        return ASPResponse(
            status=status_map.get(asp_status, 'error'),
            submission_id=data.get('submissionId', ''),
            message=data.get('message', ''),
            errors=data.get('errors', []),
            raw=data,
        )

    def _parse_status_response(self, data: dict) -> ASPResponse:
        """Normalise ASP status poll response to ASPResponse."""
        asp_status = data.get('status', '').upper()
        status_map = {
            'VALIDATED': 'accepted',
            'ACCEPTED':  'accepted',
            'REJECTED':  'rejected',
            'PENDING':   'pending',
        }
        return ASPResponse(
            status=status_map.get(asp_status, 'pending'),
            submission_id=data.get('submissionId', ''),
            message=data.get('message', ''),
            errors=data.get('errors', []),
            raw=data,
        )


# ─── Client Factory ───────────────────────────────────────────────────────────

def get_asp_client():
    """
    Return the configured ASP client.
    Defaults to MockASPClient in development.

    To switch to the real client, add to .env:
      ASP_CLIENT_CLASS=apps.integrations.asp.client.RealASPClient
    """
    from django.conf import settings
    import importlib

    client_class_path = getattr(settings, 'ASP_CLIENT_CLASS', None)

    if not client_class_path:
        # Use Mock in development, Real in production
        if getattr(settings, 'DEBUG', True):
            return MockASPClient()
        else:
            return RealASPClient()

    module_path, class_name = client_class_path.rsplit('.', 1)
    module = importlib.import_module(module_path)
    client_class = getattr(module, class_name)
    return client_class()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _timestamp() -> str:
    from django.utils import timezone
    return timezone.now().strftime('%Y%m%d%H%M%S%f')
