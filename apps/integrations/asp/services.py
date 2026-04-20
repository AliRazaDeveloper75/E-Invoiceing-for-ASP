"""
ASP Integration Service — orchestrates invoice transmission to Corner 2.

This service sits between the async task and the HTTP client:
  Task → ASPIntegrationService → ASPClient (HTTP) → ASP API

Responsibilities:
  1. Call the ASP client
  2. Create an audit log entry for every attempt
  3. Return a normalised result for the task to act on
"""
import logging
from django.utils import timezone

from .client import get_asp_client, ASPResponse

logger = logging.getLogger(__name__)


class ASPIntegrationService:
    """
    Transmits invoice XML to the configured ASP (Mock or Real).
    Logs every attempt to ASPSubmissionLog for full audit trail.
    """

    @staticmethod
    def transmit(invoice, xml_bytes: bytes) -> ASPResponse:
        """
        Submit the invoice XML to the ASP.

        Steps:
          1. Get configured ASP client
          2. Submit XML
          3. Log the attempt (success or failure)
          4. Return ASPResponse for the task to handle

        Args:
            invoice:   Invoice model instance (must be in PENDING status)
            xml_bytes: Raw UBL 2.1 XML bytes from XMLGenerator

        Returns:
            ASPResponse — normalised response
        """
        from apps.integrations.models import ASPSubmissionLog

        client = get_asp_client()

        # Count previous attempts for this invoice
        attempt_number = (
            ASPSubmissionLog.objects
            .filter(invoice=invoice)
            .count() + 1
        )

        logger.info(
            'Transmitting invoice %s to ASP (attempt #%d)',
            invoice.invoice_number, attempt_number
        )

        # Call the ASP
        response = client.submit_invoice(
            xml_bytes=xml_bytes,
            invoice_number=invoice.invoice_number,
            company_trn=invoice.company.trn,
        )

        # Log every attempt regardless of outcome
        ASPSubmissionLog.objects.create(
            invoice=invoice,
            attempt_number=attempt_number,
            status=response.status,
            submission_id=response.submission_id,
            request_size_bytes=len(xml_bytes),
            response_payload=response.raw,
            error_message=response.message if not response.is_accepted else '',
            submitted_at=timezone.now(),
        )

        logger.info(
            'ASP response for %s: status=%s, id=%s',
            invoice.invoice_number, response.status, response.submission_id
        )

        return response

    @staticmethod
    def check_submission_status(invoice) -> ASPResponse:
        """
        Poll the ASP for the current status of a previously submitted invoice.
        Called by the retry/polling task for invoices in SUBMITTED status.
        """
        if not invoice.asp_submission_id:
            logger.warning(
                'Cannot check status for invoice %s — no submission ID.',
                invoice.invoice_number
            )
            return ASPResponse(
                status='error',
                message='No submission ID on record. Invoice may not have been submitted.'
            )

        client = get_asp_client()
        response = client.check_status(invoice.asp_submission_id)

        logger.info(
            'ASP status poll for %s: %s',
            invoice.invoice_number, response.status
        )
        return response
