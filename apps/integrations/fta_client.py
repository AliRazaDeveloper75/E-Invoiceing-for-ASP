"""
FTA (Federal Tax Authority) Reporting Client — Corner 5 in PEPPOL 5-corner model.

Only UAE-accredited ASPs can report invoice extracts to the FTA data platform
(Ministry of Finance). In production this client will call the ASP's FTA
reporting endpoint; in development it uses a mock that simulates the round-trip.

Architecture mirrors the ASP client pattern:
  MockFTAClient  — development / testing
  RealFTAClient  — production (calls ASP FTA-relay endpoint)
  get_fta_client() — factory function
"""
import logging
import time
from dataclasses import dataclass, field
from django.conf import settings

logger = logging.getLogger(__name__)


# ─── Response Data Class ──────────────────────────────────────────────────────

@dataclass
class FTAResponse:
    """
    Normalised response from the FTA reporting endpoint.

    status:        'reported' | 'error'
    fta_reference: FTA-assigned reference number (store on invoice)
    message:       Human-readable status message
    raw:           Complete raw response payload for audit log
    """
    status:        str
    fta_reference: str  = ''
    message:       str  = ''
    raw:           dict = field(default_factory=dict)

    @property
    def is_reported(self) -> bool:
        return self.status == 'reported'

    @property
    def is_error(self) -> bool:
        return self.status == 'error'


# ─── Mock FTA Client ──────────────────────────────────────────────────────────

class MockFTAClient:
    """
    Simulates FTA data platform reporting for development/testing.

    The real flow:
      ASP receives validated invoice → extracts required fields →
      submits to FTA central data platform → receives FTA reference number.

    This mock always succeeds unless invoice_number contains 'FTA_ERROR'.
    """

    def report_invoice(
        self,
        invoice_number: str,
        company_trn: str,
        xml_bytes: bytes,
        asp_submission_id: str,
    ) -> FTAResponse:
        logger.info(
            '[MOCK FTA] Reporting invoice: %s (TRN: %s, ASP ID: %s)',
            invoice_number, company_trn, asp_submission_id
        )

        # Simulate network latency
        time.sleep(0.05)

        # Simulate FTA error for test invoices
        if 'FTA_ERROR' in invoice_number.upper():
            return FTAResponse(
                status='error',
                message='FTA data platform rejected the extract: missing required field.',
                raw={
                    'status': 'ERROR',
                    'invoiceNumber': invoice_number,
                    'errorCode': 'FTA-004',
                    'errorMessage': 'Required field TaxTotal.TaxAmount missing.',
                    'timestamp': _timestamp(),
                }
            )

        fta_reference = f'FTA-AE-{company_trn[:6]}-{invoice_number}-{_timestamp()}'

        return FTAResponse(
            status='reported',
            fta_reference=fta_reference,
            message='Invoice extract received and stored by FTA data platform.',
            raw={
                'status': 'RECEIVED',
                'ftaReference': fta_reference,
                'invoiceNumber': invoice_number,
                'companyTrn': company_trn,
                'aspSubmissionId': asp_submission_id,
                'timestamp': _timestamp(),
                'platform': 'UAE_MoF_Central_Data_Platform',
            }
        )


# ─── Real FTA Client ──────────────────────────────────────────────────────────

class RealFTAClient:
    """
    Production FTA reporting client.

    In the UAE PEPPOL model, the ASP (not the taxpayer) directly connects to
    the FTA data platform. This client calls the ASP's FTA relay endpoint
    which then forwards the invoice extract to the Ministry of Finance.

    Configure via environment:
      ASP_FTA_RELAY_URL — ASP endpoint for FTA reporting (e.g. {asp_base}/fta/report)
      ASP_API_KEY       — Same API key used for invoice submission
    """

    def __init__(self):
        import requests
        self._session = requests.Session()
        self._session.headers.update({
            'Authorization': f'Bearer {settings.ASP_API_KEY}',
            'Content-Type':  'application/xml',
            'Accept':        'application/json',
        })
        self._relay_url  = settings.ASP_FTA_RELAY_URL.rstrip('/')
        self._timeout    = getattr(settings, 'ASP_TIMEOUT_SECONDS', 30)

    def report_invoice(
        self,
        invoice_number: str,
        company_trn: str,
        xml_bytes: bytes,
        asp_submission_id: str,
    ) -> FTAResponse:
        url = f'{self._relay_url}/fta/report'

        try:
            response = self._session.post(
                url,
                data=xml_bytes,
                headers={
                    'X-Invoice-Number':    invoice_number,
                    'X-Company-TRN':       company_trn,
                    'X-ASP-Submission-ID': asp_submission_id,
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            data = response.json()

            asp_status = data.get('status', '').upper()
            if asp_status in ('RECEIVED', 'ACCEPTED', 'REPORTED'):
                return FTAResponse(
                    status='reported',
                    fta_reference=data.get('ftaReference', ''),
                    message=data.get('message', 'Reported to FTA.'),
                    raw=data,
                )
            else:
                return FTAResponse(
                    status='error',
                    message=data.get('errorMessage', 'FTA reporting failed.'),
                    raw=data,
                )

        except Exception as exc:
            logger.error('FTA reporting failed for %s: %s', invoice_number, exc)
            return FTAResponse(
                status='error',
                message=f'FTA relay communication error: {exc}',
                raw={'error': str(exc)},
            )


# ─── Client Factory ───────────────────────────────────────────────────────────

def get_fta_client():
    """
    Return the configured FTA client.
    Defaults to MockFTAClient in development (DEBUG=True).
    """
    client_class_path = getattr(settings, 'FTA_CLIENT_CLASS', None)

    if client_class_path:
        import importlib
        module_path, class_name = client_class_path.rsplit('.', 1)
        module = importlib.import_module(module_path)
        return getattr(module, class_name)()

    return MockFTAClient() if getattr(settings, 'DEBUG', True) else RealFTAClient()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _timestamp() -> str:
    from django.utils import timezone
    return timezone.now().strftime('%Y%m%d%H%M%S%f')
