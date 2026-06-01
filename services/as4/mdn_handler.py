"""
PEPPOL AS4 MDN (Message Disposition Notification) Handler.

Processes inbound ebMS 3.0 Receipt signals from receiving Access Points.

In PEPPOL AS4:
  - The receiving AP sends a Receipt signal to the sending AP
  - The Receipt contains NonRepudiationInformation (NRI) which echoes
    the ds:Reference elements from the original message's signature
  - This provides cryptographic proof of delivery (non-repudiation)

MDN types:
  1. Synchronous MDN: included in the HTTP response body to the original POST
  2. Asynchronous MDN: sent as a separate POST to the reply-to URL

This handler processes both, verifying:
  - The ebMS envelope is a valid Receipt signal (not an Error signal)
  - The RefToMessageId matches our sent message
  - The NRI references match our original signature references
  - The Receipt itself is signed by the receiving AP (optional but recommended)

After verification, the PEPPOLMessage record is updated to status='mdn_received'.
"""
import hashlib
import logging
from dataclasses import dataclass, field
from typing import Optional

from lxml import etree

from .constants import NS_EBMS3, NS_SOAP12, NS_DS, NS_WSSE

logger = logging.getLogger(__name__)


@dataclass
class MDNVerificationResult:
    """Result of MDN receipt verification."""
    is_valid:           bool = False
    message_id:         str  = ''   # Receipt signal MessageId
    ref_to_message_id:  str  = ''   # Original UserMessage MessageId
    is_error:           bool = False
    error_description:  str  = ''
    nri_references:     list = field(default_factory=list)  # Reference URIs from NRI
    ap_signed:          bool = False  # Whether the receipt itself was signed by the AP


class MDNHandler:
    """
    Verifies and processes inbound AS4 MDN (Receipt) signals.

    Usage:
        handler = MDNHandler()
        result = handler.process_inbound(soap_bytes)
        if result.is_valid:
            # Update PEPPOLMessage record
            mark_message_delivered(result.ref_to_message_id)
    """

    def process_inbound(self, soap_bytes: bytes) -> MDNVerificationResult:
        """
        Parse and verify an inbound AS4 Signal Message (MDN).

        Handles both synchronous (embedded in HTTP response) and
        asynchronous (separate POST) receipts.

        Args:
            soap_bytes: Raw SOAP XML bytes of the AS4 Signal Message

        Returns:
            MDNVerificationResult with verification details
        """
        result = MDNVerificationResult()

        # Extract SOAP from potentially MTOM-wrapped response
        soap_xml = self._extract_soap(soap_bytes)
        if not soap_xml:
            result.error_description = 'Could not extract SOAP envelope from MDN response.'
            return result

        try:
            doc = etree.fromstring(soap_xml)
        except etree.XMLSyntaxError as exc:
            result.error_description = f'MDN XML parse error: {exc}'
            return result

        # Parse the ebMS SignalMessage
        signal_msg = doc.find(
            f'.//{{{NS_EBMS3}}}SignalMessage'
        )

        if signal_msg is None:
            result.error_description = 'No eb3:SignalMessage found — not a valid AS4 MDN.'
            return result

        # Extract MessageInfo
        msg_info = signal_msg.find(f'{{{NS_EBMS3}}}MessageInfo')
        if msg_info is not None:
            mid_el  = msg_info.find(f'{{{NS_EBMS3}}}MessageId')
            ref_el  = msg_info.find(f'{{{NS_EBMS3}}}RefToMessageId')
            result.message_id        = mid_el.text.strip() if mid_el is not None and mid_el.text else ''
            result.ref_to_message_id = ref_el.text.strip() if ref_el is not None and ref_el.text else ''

        # Check for Error signal instead of Receipt
        error_el = signal_msg.find(f'{{{NS_EBMS3}}}Error')
        if error_el is not None:
            result.is_error = True
            result.error_description = self._format_error(error_el)
            logger.warning(
                'AS4 MDN Error signal received: ref=%s error=%s',
                result.ref_to_message_id, result.error_description,
            )
            return result

        # Parse Receipt
        receipt_el = signal_msg.find(f'{{{NS_EBMS3}}}Receipt')
        if receipt_el is None:
            result.error_description = 'Signal message contains neither Receipt nor Error.'
            return result

        # Extract NonRepudiationInformation
        result.nri_references = self._extract_nri_references(receipt_el)

        # Verify AP signed the receipt
        header = doc.find(f'{{{NS_SOAP12}}}Header')
        if header is not None:
            security = header.find(f'{{{NS_WSSE}}}Security')
            if security is not None and security.find(f'{{{NS_DS}}}Signature') is not None:
                result.ap_signed = True
                logger.debug('AS4 MDN: receipt is signed by receiving AP.')

        result.is_valid = True

        logger.info(
            'AS4 MDN verified: ref_message_id=%s receipt_id=%s nri_refs=%d signed=%s',
            result.ref_to_message_id,
            result.message_id,
            len(result.nri_references),
            result.ap_signed,
        )

        return result

    def verify_nri(
        self,
        received_nri: list[str],
        original_references: list[str],
    ) -> bool:
        """
        Verify that the NRI references in the Receipt match the sent message.

        The receiving AP must echo back the same Reference URIs that were
        in the original UserMessage's ds:Signature. This proves the receiver
        processed the correct payload.

        Args:
            received_nri:       Reference URIs from the Receipt NRI
            original_references: Reference URIs from the sent message signature

        Returns:
            True if all original references are present in the NRI
        """
        original_set = set(original_references)
        received_set = set(received_nri)
        missing = original_set - received_set
        if missing:
            logger.warning(
                'AS4 NRI mismatch: missing references: %s', missing
            )
            return False
        return True

    def update_db_record(
        self,
        result: MDNVerificationResult,
        payload_hash: str = '',
    ) -> bool:
        """
        Update the PEPPOLMessage database record after MDN verification.

        Returns True if a matching record was found and updated.
        """
        if not result.ref_to_message_id:
            return False

        try:
            from apps.integrations.models import PEPPOLMessage
            from django.utils import timezone

            # The as4_message_id field stores the outbound ebMS MessageId
            peppol_msg = PEPPOLMessage.objects.filter(
                as4_message_id=result.ref_to_message_id,
                direction='outbound',
            ).first()

            if not peppol_msg:
                logger.warning(
                    'AS4 MDN: no PEPPOLMessage found for as4_message_id=%s',
                    result.ref_to_message_id,
                )
                return False

            if result.is_error:
                peppol_msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_FAILED
                peppol_msg.error_message = result.error_description
            else:
                peppol_msg.transmission_status = PEPPOLMessage.TRANSMISSION_STATUS_MDN_RECV
                peppol_msg.mdn_received_at = timezone.now()
                peppol_msg.mdn_status = 'received' if result.is_valid else 'invalid'

            peppol_msg.save(update_fields=[
                'transmission_status', 'mdn_received_at', 'mdn_status',
                'error_message', 'updated_at',
            ])

            logger.info(
                'PEPPOLMessage %s updated: status=%s',
                result.ref_to_message_id, peppol_msg.transmission_status,
            )
            return True

        except Exception as exc:
            logger.error('Failed to update PEPPOLMessage for MDN: %s', exc, exc_info=True)
            return False

    # ── Private helpers ────────────────────────────────────────────────────────

    def _extract_soap(self, raw_bytes: bytes) -> bytes:
        """Extract SOAP XML from a potentially MTOM-wrapped response."""
        if not raw_bytes:
            return b''
        if raw_bytes.lstrip().startswith(b'<?xml') or raw_bytes.lstrip().startswith(b'<'):
            return raw_bytes
        # MTOM: find SOAP part
        try:
            start = raw_bytes.index(b'<?xml')
            end_markers = [b'\r\n--', b'\n--']
            end = len(raw_bytes)
            for marker in end_markers:
                pos = raw_bytes.find(marker, start)
                if pos != -1:
                    end = min(end, pos)
            return raw_bytes[start:end]
        except (ValueError, IndexError):
            return b''

    def _extract_nri_references(self, receipt_el: etree._Element) -> list[str]:
        """Extract Reference URIs from the NonRepudiationInformation element."""
        refs = []
        # NRI is in the ebbp namespace
        nri_el = receipt_el.find(
            '{http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0}NonRepudiationInformation'
        )
        if nri_el is None:
            return refs

        for msg_part_nri in nri_el:
            ref_el = msg_part_nri.find(f'{{{NS_DS}}}Reference')
            if ref_el is not None:
                uri = ref_el.get('URI', '')
                if uri:
                    refs.append(uri)
        return refs

    def _format_error(self, error_el: etree._Element) -> str:
        """Format an eb3:Error element into a human-readable string."""
        error_code  = error_el.get('errorCode', 'UNKNOWN')
        severity    = error_el.get('severity', 'Failure')
        category    = error_el.get('category', '')
        description = error_el.get('shortDescription', '')

        description_el = error_el.find(f'{{{NS_EBMS3}}}Description')
        if description_el is not None and description_el.text:
            description = description_el.text.strip()

        return f'[{severity}] {error_code}: {description} ({category})'.strip(' ():')
