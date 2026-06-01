"""
PEPPOL AS4 HTTP Transport.

Sends SOAP/MTOM AS4 messages to a receiving Access Point over HTTPS.

PEPPOL AS4 Profile requirements:
  - HTTPS (TLS 1.2+) mandatory
  - MTOM (Multipart MIME) packaging of SOAP + payload
  - SOAPAction: "" (empty)
  - Content-Type: multipart/related; type="application/soap+xml"; ...
  - Retry on transient 5xx / connection errors
  - TLS client certificate authentication (for production AP-to-AP)

Transport flow:
  1. Build AS4EnvelopeBuilder → SOAP envelope
  2. Sign with AS4MessageSigner → signed envelope
  3. Package as MTOM multipart body
  4. POST to receiving AP endpoint URL
  5. Parse response (synchronous receipt or empty 2xx for async)
  6. Return AS4TransmissionResult
"""
import email.mime.multipart
import email.mime.base
import hashlib
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

import requests
from lxml import etree

from .constants import (
    NS_EBMS3, NS_SOAP12,
    PAYLOAD_CID_TEMPLATE,
    AS4_SOAP_ACTION,
    PEPPOL_DOCTYPE_PINT_AE_INVOICE,
    PEPPOL_PROCESS_BIS30,
)
from .envelope import AS4EnvelopeBuilder, envelope_to_bytes
from .signing import AS4MessageSigner

logger = logging.getLogger(__name__)


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class AS4TransmissionResult:
    """
    Result of an AS4 message transmission attempt.

    success:      True if the receiving AP returned 2xx and (optionally) a Receipt
    message_id:   The ebMS MessageId we sent
    receipt_id:   The MessageId in the synchronous Receipt response (if any)
    http_status:  HTTP response status code
    response_body: Raw response body (for debugging/audit)
    error_message: Description of any error
    duration_ms:  Round-trip time in milliseconds
    """
    success:       bool = False
    message_id:    str  = ''
    receipt_id:    str  = ''
    http_status:   int  = 0
    response_body: bytes = field(default_factory=bytes)
    error_message: str  = ''
    duration_ms:   int  = 0
    payload_hash:  str  = ''


# ─── AS4 Transport ────────────────────────────────────────────────────────────

class AS4Transport:
    """
    Sends a UBL invoice to a PEPPOL receiving Access Point via AS4.

    Usage:
        transport = AS4Transport(
            sender_participant_id='0235:123456789012345',
            endpoint_url='https://ap.receiver.example.com/as4/inbound',
        )
        result = transport.send(
            receiver_participant_id='0235:987654321098765',
            invoice_xml=xml_bytes,
        )
    """

    DEFAULT_TIMEOUT_SECONDS = 30
    MAX_RETRIES = 3
    RETRY_BACKOFF = [5, 15, 30]   # seconds

    def __init__(
        self,
        sender_participant_id: str,
        endpoint_url: str,
        client_cert: Optional[tuple] = None,   # (cert_path, key_path) for mTLS
        ca_bundle: Optional[str] = None,        # Custom CA bundle for PEPPOL PKI trust
        timeout: int = DEFAULT_TIMEOUT_SECONDS,
    ):
        self._sender_id   = sender_participant_id
        self._endpoint    = endpoint_url
        self._client_cert = client_cert
        self._ca_bundle   = ca_bundle
        self._timeout     = timeout
        self._signer      = AS4MessageSigner()

    # ── Public API ────────────────────────────────────────────────────────────

    def send(
        self,
        receiver_participant_id: str,
        invoice_xml: bytes,
        document_type_id: str = PEPPOL_DOCTYPE_PINT_AE_INVOICE,
        process_id: str       = PEPPOL_PROCESS_BIS30,
    ) -> AS4TransmissionResult:
        """
        Package and transmit an invoice XML document via PEPPOL AS4.

        Args:
            receiver_participant_id: PEPPOL ID of the receiving party (e.g. '0235:...')
            invoice_xml:  Signed UBL Invoice XML bytes
            document_type_id: PEPPOL document type identifier
            process_id:   PEPPOL process identifier

        Returns:
            AS4TransmissionResult — success/failure with details
        """
        payload_hash = hashlib.sha256(invoice_xml).hexdigest()

        builder = AS4EnvelopeBuilder(
            sender_participant_id=self._sender_id,
            receiver_participant_id=receiver_participant_id,
            document_type_id=document_type_id,
            process_id=process_id,
        )
        envelope, message_id = builder.build(invoice_xml)

        # Sign the SOAP envelope
        try:
            envelope = self._signer.sign(envelope, invoice_xml, message_id)
        except Exception as exc:
            logger.error('AS4 signing failed for message %s: %s', message_id, exc)
            return AS4TransmissionResult(
                message_id=message_id,
                error_message=f'AS4 signing failed: {exc}',
                payload_hash=payload_hash,
            )

        # Serialize to MTOM multipart
        mtom_body, content_type = self._build_mtom(
            envelope_xml=envelope_to_bytes(envelope),
            payload_bytes=invoice_xml,
            message_id=message_id,
        )

        # Transmit with retry
        return self._transmit_with_retry(
            message_id=message_id,
            mtom_body=mtom_body,
            content_type=content_type,
            payload_hash=payload_hash,
        )

    # ── MTOM packaging ────────────────────────────────────────────────────────

    def _build_mtom(
        self,
        envelope_xml: bytes,
        payload_bytes: bytes,
        message_id: str,
    ) -> tuple[bytes, str]:
        """
        Build a MTOM (MIME Multipart) SOAP message.

        Returns (body_bytes, content_type_header).

        Structure:
          multipart/related; type="application/soap+xml"
            Part 1: SOAP envelope (application/soap+xml)
            Part 2: Invoice XML payload (application/xml, referenced by CID)
        """
        boundary = f'MIMEBoundary_{uuid.uuid4().hex}'

        payload_cid = PAYLOAD_CID_TEMPLATE.format(
            message_id=message_id.replace('@', '_').replace('.', '_')
        )

        root_part_id = f'rootpart@{uuid.uuid4()}.peppol.eu'

        lines = []

        # Part 1: SOAP envelope
        lines.append(f'--{boundary}'.encode())
        lines.append(b'Content-Type: application/soap+xml; charset=UTF-8')
        lines.append(b'Content-Transfer-Encoding: 8bit')
        lines.append(f'Content-ID: <{root_part_id}>'.encode())
        lines.append(b'')
        lines.append(envelope_xml)

        # Part 2: Payload attachment
        lines.append(f'--{boundary}'.encode())
        lines.append(b'Content-Type: application/xml; charset=UTF-8')
        lines.append(b'Content-Transfer-Encoding: binary')
        lines.append(f'Content-ID: <{payload_cid}>'.encode())
        lines.append(b'')
        lines.append(payload_bytes)

        lines.append(f'--{boundary}--'.encode())

        body = b'\r\n'.join(lines)

        content_type = (
            f'multipart/related; '
            f'type="application/soap+xml"; '
            f'boundary="{boundary}"; '
            f'start="<{root_part_id}>"; '
            f'start-info="application/soap+xml"'
        )

        return body, content_type

    # ── HTTP transmission ─────────────────────────────────────────────────────

    def _transmit_with_retry(
        self,
        message_id: str,
        mtom_body: bytes,
        content_type: str,
        payload_hash: str,
    ) -> AS4TransmissionResult:
        """Transmit with exponential backoff retry on transient failures."""
        last_result = None
        for attempt in range(self.MAX_RETRIES):
            result = self._transmit_once(
                message_id=message_id,
                mtom_body=mtom_body,
                content_type=content_type,
                payload_hash=payload_hash,
            )
            last_result = result

            if result.success:
                return result

            # Retry on 5xx or connection errors (not 4xx — those are config errors)
            if result.http_status and 400 <= result.http_status < 500:
                logger.error(
                    'AS4 4xx error for message %s (not retrying): status=%d',
                    message_id, result.http_status,
                )
                return result

            if attempt < self.MAX_RETRIES - 1:
                wait = self.RETRY_BACKOFF[attempt]
                logger.warning(
                    'AS4 attempt %d/%d failed for message %s — retrying in %ds.',
                    attempt + 1, self.MAX_RETRIES, message_id, wait,
                )
                time.sleep(wait)

        return last_result

    def _transmit_once(
        self,
        message_id: str,
        mtom_body: bytes,
        content_type: str,
        payload_hash: str,
    ) -> AS4TransmissionResult:
        """Single HTTP POST attempt to the receiving AP."""
        headers = {
            'Content-Type':  content_type,
            'SOAPAction':    AS4_SOAP_ACTION,
            'Content-Length': str(len(mtom_body)),
        }

        start_ms = int(time.monotonic() * 1000)

        try:
            response = requests.post(
                self._endpoint,
                data=mtom_body,
                headers=headers,
                timeout=self._timeout,
                cert=self._client_cert,     # mTLS client certificate
                verify=self._ca_bundle or True,  # PEPPOL PKI CA bundle or system trust
            )

            duration_ms = int(time.monotonic() * 1000) - start_ms

            receipt_id = self._extract_receipt_message_id(response.content)

            success = (
                200 <= response.status_code < 300
                and not self._is_soap_fault(response.content)
            )

            if success:
                logger.info(
                    'AS4 transmission successful: message_id=%s receipt_id=%s '
                    'status=%d duration_ms=%d',
                    message_id, receipt_id, response.status_code, duration_ms,
                )
            else:
                logger.warning(
                    'AS4 transmission failed: message_id=%s status=%d body=%r',
                    message_id, response.status_code, response.content[:500],
                )

            return AS4TransmissionResult(
                success=success,
                message_id=message_id,
                receipt_id=receipt_id,
                http_status=response.status_code,
                response_body=response.content[:4096],  # Store first 4KB
                error_message='' if success else f'HTTP {response.status_code}',
                duration_ms=duration_ms,
                payload_hash=payload_hash,
            )

        except requests.exceptions.Timeout:
            duration_ms = int(time.monotonic() * 1000) - start_ms
            logger.error('AS4 transmission timeout for message %s after %dms.', message_id, duration_ms)
            return AS4TransmissionResult(
                message_id=message_id,
                error_message=f'Connection timeout after {self._timeout}s',
                duration_ms=duration_ms,
                payload_hash=payload_hash,
            )

        except requests.exceptions.SSLError as exc:
            logger.error('AS4 TLS error for message %s: %s', message_id, exc)
            return AS4TransmissionResult(
                message_id=message_id,
                error_message=f'TLS/SSL error: {exc}',
                payload_hash=payload_hash,
            )

        except requests.exceptions.ConnectionError as exc:
            logger.error('AS4 connection error for message %s: %s', message_id, exc)
            return AS4TransmissionResult(
                message_id=message_id,
                error_message=f'Connection error: {exc}',
                payload_hash=payload_hash,
            )

        except Exception as exc:
            logger.error('AS4 unexpected error for message %s: %s', message_id, exc, exc_info=True)
            return AS4TransmissionResult(
                message_id=message_id,
                error_message=f'Unexpected error: {exc}',
                payload_hash=payload_hash,
            )

    # ── Response parsing ──────────────────────────────────────────────────────

    def _extract_receipt_message_id(self, response_body: bytes) -> str:
        """
        Parse synchronous AS4 Receipt response and extract the receipt MessageId.
        Returns empty string if the response is not a valid ebMS receipt.
        """
        if not response_body:
            return ''
        try:
            # The response may be MTOM — extract the SOAP part first
            soap_bytes = self._extract_soap_from_response(response_body)
            if not soap_bytes:
                return ''

            doc = etree.fromstring(soap_bytes)
            # Look for eb3:SignalMessage/eb3:MessageInfo/eb3:MessageId
            signal = doc.find(
                f'.//{{{NS_EBMS3}}}SignalMessage/{{{NS_EBMS3}}}MessageInfo/{{{NS_EBMS3}}}MessageId'
            )
            return signal.text.strip() if signal is not None and signal.text else ''
        except Exception:
            return ''

    def _extract_soap_from_response(self, response_body: bytes) -> bytes:
        """
        Extract the SOAP envelope bytes from a potentially MTOM response.
        For simple SOAP responses (non-MTOM), return as-is.
        """
        if response_body.startswith(b'<?xml') or response_body.startswith(b'<'):
            return response_body
        # Try to find the SOAP XML in a multipart response
        try:
            start = response_body.index(b'<?xml')
            end_markers = [b'\r\n--', b'\n--']
            end = len(response_body)
            for marker in end_markers:
                pos = response_body.find(marker, start)
                if pos != -1:
                    end = min(end, pos)
            return response_body[start:end]
        except ValueError:
            return b''

    def _is_soap_fault(self, response_body: bytes) -> bool:
        """Return True if the response contains a SOAP Fault element."""
        return b'S12:Fault' in response_body or b'soap:Fault' in response_body
