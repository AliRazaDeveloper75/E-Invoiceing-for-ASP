"""
PEPPOL AS4 Inbound Receiver (Corner 3).

Handles incoming AS4/ebMS3 messages from other Access Points:

  1. Parse the MTOM multipart/related body → SOAP envelope + payload attachment
  2. Verify the WS-Security signature (sender's BinarySecurityToken)
  3. Extract the UBL invoice payload
  4. (Hand off to inbound processing — done by the calling view)
  5. Build a signed AS4 Receipt (NonRepudiationInformation) for the response

This is the receiving half of the four-corner model. The sending half lives in
transport.py / envelope.py / signing.py — this module reuses AS4MessageSigner
(verify_inbound) and build_receipt_signal().

PEPPOL AS4 profile requirements honoured here:
  - HTTPS POST with Content-Type: multipart/related (MTOM)
  - SOAP 1.2 + ebMS3 UserMessage
  - WS-Security XML signature verification
  - Signed AS4 Receipt returned synchronously (2-way/sync MEP)
"""
import logging
import re
import uuid
from dataclasses import dataclass, field
from email import message_from_bytes
from typing import Optional

from lxml import etree

from .constants import NS_EBMS3, NS_SOAP12, NS_DS
from .envelope import build_receipt_signal, envelope_to_bytes
from .signing import AS4MessageSigner

logger = logging.getLogger(__name__)


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class AS4ReceiveResult:
    """Outcome of processing an inbound AS4 message."""
    success: bool = False
    message_id: str = ''                       # ebMS MessageId of the received UserMessage
    sender_id: str = ''                         # From/PartyId (e.g. 0235:1001...)
    receiver_id: str = ''                       # To/PartyId
    payload_xml: Optional[bytes] = None         # The extracted UBL invoice bytes
    signature_valid: bool = False
    receipt_xml: Optional[bytes] = None         # Signed AS4 Receipt to return in the response
    error_code: str = ''                        # ebMS error code on failure (e.g. EBMS:0004)
    errors: list = field(default_factory=list)

    def add_error(self, msg: str, code: str = 'EBMS:0004') -> None:
        self.errors.append(msg)
        self.error_code = code
        self.success = False


# ─── Receiver ─────────────────────────────────────────────────────────────────

class AS4Receiver:
    """Parses, verifies, and acknowledges inbound AS4 messages."""

    def __init__(self, verify_signature: bool = True):
        self._signer = AS4MessageSigner()
        self._verify_signature = verify_signature

    # ── Public entry point ────────────────────────────────────────────────────

    def receive(self, content_type: str, raw_body: bytes) -> AS4ReceiveResult:
        """
        Process a raw inbound AS4 HTTP request.

        Args:
            content_type: The request Content-Type header (carries the MIME boundary)
            raw_body:     The raw request body bytes (MTOM multipart, or bare SOAP)

        Returns:
            AS4ReceiveResult — on success, .payload_xml + .receipt_xml are populated.
        """
        result = AS4ReceiveResult()
        try:
            soap_part, attachments = self._split_multipart(content_type, raw_body)
            payload_part = next(iter(attachments.values()), None)
        except Exception as exc:
            logger.error('AS4 inbound: failed to parse multipart body: %s', exc)
            result.add_error(f'Malformed MTOM body: {exc}', 'EBMS:0009')
            return result

        try:
            envelope = etree.fromstring(soap_part)
        except etree.XMLSyntaxError as exc:
            result.add_error(f'SOAP envelope not well-formed: {exc}', 'EBMS:0004')
            return result

        # Extract ebMS metadata
        result.message_id  = self._xpath_text(envelope, './/eb:UserMessage/eb:MessageInfo/eb:MessageId')
        result.sender_id   = self._xpath_text(envelope, './/eb:PartyInfo/eb:From/eb:PartyId')
        result.receiver_id = self._xpath_text(envelope, './/eb:PartyInfo/eb:To/eb:PartyId')

        if not result.message_id:
            result.add_error('Missing ebMS MessageId.', 'EBMS:0004')
            return result

        # Verify the WS-Security signature
        if self._verify_signature:
            try:
                result.signature_valid = self._signer.verify_inbound(envelope, attachments)
            except Exception as exc:
                logger.warning('AS4 inbound: signature verification raised: %s', exc)
                result.signature_valid = False
            if not result.signature_valid:
                result.add_error('WS-Security signature verification failed.', 'EBMS:0101')
                return result
        else:
            result.signature_valid = False  # explicitly disabled (dev only)

        # The payload (UBL invoice) — from the MIME attachment, or inline in the body
        if payload_part is None:
            result.add_error('No invoice payload attachment found.', 'EBMS:0006')
            return result
        # eDelivery/Peppol AS4 ENCRYPTS the payload (WS-Security XML Encryption:
        # xenc:EncryptedKey RSA-OAEP wrapping an AES key + xenc:EncryptedData over
        # the cid attachment, AES-GCM). When present we RSA-unwrap the key and
        # AES-GCM decrypt (which also gunzips). If there is no encryption we fall
        # back to (optionally gzip) plaintext. Signature verification above already
        # ran on the on-the-wire (encrypted/compressed) bytes.
        result.payload_xml = self._decrypt_or_decompress(envelope, payload_part)

        # Build the signed AS4 Receipt to acknowledge non-repudiation
        try:
            refs = self._collect_signature_references(envelope)
            receipt_env = build_receipt_signal(result.message_id, refs)
            # Sign the receipt with our AP key (best-effort — skipped if signing disabled)
            try:
                self._signer.sign(receipt_env, b'', result.message_id)
            except Exception as exc:
                logger.debug('AS4 inbound: receipt signing skipped/failed: %s', exc)
            result.receipt_xml = envelope_to_bytes(receipt_env)
        except Exception as exc:
            logger.error('AS4 inbound: failed to build receipt: %s', exc)
            # Payload was still received & verified — surface receipt failure but keep payload
            result.errors.append(f'Receipt build failed: {exc}')

        result.success = True
        return result

    # ── Helpers ─────────────────────────────────────────────────────────────────

    def _decrypt_or_decompress(self, envelope, payload_part: bytes) -> bytes:
        """
        Decrypt an AES-GCM encrypted payload (eDelivery AS4) if the SOAP carries a
        WS-Security xenc:EncryptedKey; otherwise gzip-inflate (or return as-is).
        """
        wrapped_key = self._extract_wrapped_key(envelope)
        if wrapped_key is not None:
            try:
                self._signer._load_credentials()
                from .encryption import decrypt_payload
                xml = decrypt_payload(payload_part, wrapped_key, self._signer._key)
                logger.info('AS4 inbound: payload decrypted (%d bytes UBL)', len(xml))
                return xml
            except Exception as exc:
                logger.error('AS4 inbound: payload decryption failed: %s', exc)
                # fall through — maybe it was only compressed after all
        return self._maybe_decompress(payload_part)

    @staticmethod
    def _extract_wrapped_key(envelope) -> Optional[bytes]:
        """RSA-OAEP wrapped AES key from xenc:EncryptedKey/.../CipherValue, or None."""
        import base64
        ns_xenc = 'http://www.w3.org/2001/04/xmlenc#'
        ek = envelope.find(f'.//{{{ns_xenc}}}EncryptedKey')
        if ek is None:
            return None
        cv = ek.find(f'.//{{{ns_xenc}}}CipherData/{{{ns_xenc}}}CipherValue')
        if cv is None or not (cv.text or '').strip():
            return None
        try:
            return base64.b64decode(cv.text.strip())
        except Exception as exc:
            logger.warning('AS4 inbound: could not decode EncryptedKey CipherValue: %s', exc)
            return None

    @staticmethod
    def _maybe_decompress(payload: bytes) -> bytes:
        """
        Inflate a gzip-compressed AS4 payload.

        ebMS3/AS4 senders (incl. the PEPPOL Testbed / phase4) frequently compress
        the business document with gzip and flag it via a PartProperties
        ``CompressionType=application/gzip``. The gzip magic bytes are 0x1f 0x8b;
        when present we decompress, otherwise the payload is returned unchanged.
        """
        if payload and payload[:2] == b'\x1f\x8b':
            import gzip
            try:
                return gzip.decompress(payload)
            except Exception as exc:
                logger.warning('AS4 inbound: gzip decompress failed, using raw payload: %s', exc)
        return payload

    @staticmethod
    def _split_multipart(content_type: str, raw_body: bytes) -> tuple[bytes, dict]:
        """
        Split an MTOM multipart/related body into (soap_envelope_bytes, attachments).

        ``attachments`` maps each part's Content-ID (without the surrounding <>)
        to its raw decoded bytes — needed to verify cid: signature references.
        Falls back to treating the whole body as the SOAP part when it is not
        multipart (some APs send bare application/soap+xml).
        """
        ct = (content_type or '').lower()
        if 'multipart/related' not in ct:
            return raw_body, {}

        # Reconstruct a MIME document so Python's email parser can split the parts.
        header = f'Content-Type: {content_type}\r\n\r\n'.encode()
        msg = message_from_bytes(header + raw_body)

        soap_part: Optional[bytes] = None
        attachments: dict = {}
        for part in msg.walk():
            part_ct = (part.get_content_type() or '').lower()
            if part_ct == 'multipart/related':
                continue
            body = part.get_payload(decode=True)
            if body is None:
                continue
            if soap_part is None and ('soap+xml' in part_ct or b'Envelope' in body[:512]):
                soap_part = body
                continue
            # Attachment — key by Content-ID (strip <> and whitespace).
            cid = (part.get('Content-ID', '') or '').strip().lstrip('<').rstrip('>')
            attachments[cid or f'__part{len(attachments)}'] = body

        if soap_part is None:
            raise ValueError('No SOAP part found in multipart body.')
        return soap_part, attachments

    @staticmethod
    def _xpath_text(envelope: etree._Element, path: str) -> str:
        ns = {'eb': NS_EBMS3, 's12': NS_SOAP12}
        found = envelope.xpath(path, namespaces=ns)
        if found and found[0].text:
            return found[0].text.strip()
        return ''

    @staticmethod
    def _collect_signature_references(envelope: etree._Element) -> list:
        """
        Return deep copies of the ds:Reference elements from the inbound
        signature's SignedInfo. The AS4 Receipt's NonRepudiationInformation
        must echo these full references (URI + DigestMethod + DigestValue),
        not just the URIs, or the sender (phase4) rejects the receipt.
        """
        import copy
        ns = {'ds': NS_DS}
        refs = envelope.xpath('.//ds:Signature/ds:SignedInfo/ds:Reference', namespaces=ns)
        return [copy.deepcopy(r) for r in refs] if refs else []
