"""
FTA Reporting Service — Corner 5 orchestration layer.

Called by the Celery task after an invoice is validated by the ASP.
Submits an extract of the invoice to the UAE FTA central data platform
via the ASP's FTA relay endpoint.

Only UAE-accredited ASPs can report to the FTA platform directly.
Taxpayers trigger reporting indirectly through the submission pipeline.
"""
import logging
from django.utils import timezone

from .fta_client import get_fta_client, FTAResponse

logger = logging.getLogger(__name__)


class FTAReportingService:
    """
    Orchestrates FTA data platform reporting (Corner 5).

    Steps:
      1. Set invoice.fta_status = 'pending'
      2. Call FTA client (mock or real)
      3. Log the attempt to FTASubmissionLog (immutable audit trail)
      4. Update invoice fta_status / fta_reference / fta_reported_at
    """

    @staticmethod
    def report(invoice, xml_bytes: bytes) -> FTAResponse:
        """
        Report an invoice extract to the FTA data platform.

        Args:
            invoice:   Validated Invoice instance
            xml_bytes: The UBL 2.1 XML bytes already generated and saved

        Returns:
            FTAResponse — normalised result (check .is_reported)
        """
        from apps.integrations.models import FTASubmissionLog

        # Mark as pending before calling FTA
        invoice.fta_status = 'pending'
        invoice.save(update_fields=['fta_status', 'updated_at'])

        logger.info(
            'Reporting invoice %s to FTA (ASP submission ID: %s)',
            invoice.invoice_number, invoice.asp_submission_id
        )

        client = get_fta_client()
        response = client.report_invoice(
            invoice_number=invoice.invoice_number,
            company_trn=invoice.company.trn,
            xml_bytes=xml_bytes,
            asp_submission_id=invoice.asp_submission_id,
        )

        now = timezone.now()

        # Log every attempt — immutable audit trail
        FTASubmissionLog.objects.create(
            invoice=invoice,
            status=response.status,
            fta_reference=response.fta_reference,
            response_payload=response.raw,
            error_message=response.message if response.is_error else '',
            reported_at=now,
        )

        # Update invoice with result
        if response.is_reported:
            invoice.fta_status      = 'reported'
            invoice.fta_reference   = response.fta_reference
            invoice.fta_reported_at = now
            invoice.save(update_fields=[
                'fta_status', 'fta_reference', 'fta_reported_at', 'updated_at'
            ])
            logger.info(
                'Invoice %s reported to FTA. Reference: %s',
                invoice.invoice_number, response.fta_reference
            )
        else:
            invoice.fta_status = 'error'
            invoice.save(update_fields=['fta_status', 'updated_at'])
            logger.error(
                'FTA reporting failed for invoice %s: %s',
                invoice.invoice_number, response.message
            )

        return response
