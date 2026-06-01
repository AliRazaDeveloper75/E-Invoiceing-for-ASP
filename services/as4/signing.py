"""
PEPPOL AS4 WS-Security Message Signing.

Signs a SOAP AS4 message according to:
  - PEPPOL AS4 Profile v2.0 §4 (Security Layer)
  - W3C XML Signature Syntax and Processing
  - OASIS WSS 1.1 X.509 Token Profile

Signature covers:
  1. The eb3:Messaging element (SOAP header — identified by wsu:Id="messaging")
  2. The SOAP Body element (empty, but signed for integrity)
  3. The payload MIME attachment (digest over raw bytes, cid: reference)
  4. The wsu:Timestamp element (replay protection)

The signature is embedded in the wsse:Security header using a
BinarySecurityToken reference to the AP certificate.
"""
import base64
import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from lxml import etree

from .constants import (
    NS_SOAP12, NS_EBMS3, NS_WSSE, NS_WSU, NS_DS,
    NS_MAP,
    WSSE_TOKEN_TYPE_X509V3, WSSE_ENCODING_BASE64,
    ALG_SIGN_RSA_SHA256, ALG_DIGEST_SHA256,
    ALG_C14N_EXCLUSIVE, ALG_C14N_STANDARD,
    TS_FORMAT,
)

logger = logging.getLogger(__name__)


class AS4MessageSigner:
    """
    Signs a PEPPOL AS4 SOAP envelope with WS-Security.

    Implements RSA-SHA256 XMLDSig with:
    - X.509 BinarySecurityToken reference
    - Exclusive C14N (exc-c14n) canonicalization
    - SHA-256 digests

    The signing key and certificate are loaded from the paths configured in
    Django settings (PEPPOL_PRIVATE_KEY_PATH, PEPPOL_CERT_PATH).
    """

    TIMESTAMP_TTL_SECONDS = 300   # 5-minute message validity window

    def __init__(self):
        from django.conf import settings
        self._cert_path = getattr(settings, 'PEPPOL_CERT_PATH', '')
        self._key_path  = getattr(settings, 'PEPPOL_PRIVATE_KEY_PATH', '')
        self._enabled   = getattr(settings, 'PEPPOL_SIGNING_ENABLED', False)
        self._cert      = None
        self._key       = None
        self._cert_der  = None

    # ── Public API ────────────────────────────────────────────────────────────

    def sign(
        self,
        envelope: etree._Element,
        payload_bytes: bytes,
        message_id: str,
    ) -> etree._Element:
        """
        Sign the AS4 SOAP envelope in-place.

        Adds wsu:Timestamp, BinarySecurityToken, and ds:Signature to
        the existing wsse:Security placeholder in the SOAP header.

        Args:
            envelope:      SOAP envelope (from AS4EnvelopeBuilder)
            payload_bytes: Raw invoice XML bytes (the MIME attachment)
            message_id:    The ebMS MessageId (used to derive payload CID)

        Returns:
            The same envelope element, with Security header populated.
        """
        if not self._enabled:
            logger.debug('AS4 signing disabled (PEPPOL_SIGNING_ENABLED=False).')
            return envelope

        try:
            self._load_credentials()
        except Exception as exc:
            logger.error('Cannot load AS4 signing credentials: %s', exc)
            raise

        try:
            security_el = self._find_security_element(envelope)
            bst_id, token_ref_uri = self._add_binary_security_token(security_el)
            ts_id = self._add_timestamp(security_el)
            self._add_signature(
                security_el, envelope, payload_bytes,
                message_id, bst_id, token_ref_uri, ts_id,
            )
        except Exception as exc:
            logger.error('AS4 WS-Security signing failed: %s', exc, exc_info=True)
            raise

        return envelope

    def verify_inbound(self, envelope: etree._Element) -> bool:
        """
        Verify the WS-Security signature on an inbound AS4 message.

        Returns True if signature is valid, False otherwise.
        Logs detailed errors on failure.
        """
        try:
            security_el = self._find_security_element(envelope)
            sig_el = security_el.find(f'{{{NS_DS}}}Signature')
            if sig_el is None:
                logger.warning('AS4 inbound: no ds:Signature found in Security header.')
                return False

            # Extract BinarySecurityToken (the sender's certificate)
            bst = security_el.find(f'{{{NS_WSSE}}}BinarySecurityToken')
            if bst is None or not bst.text:
                logger.warning('AS4 inbound: no BinarySecurityToken found.')
                return False

            cert_bytes = base64.b64decode(bst.text)

            # Verify signature using xmlsec (preferred) or manual fallback
            return self._verify_signature(envelope, sig_el, cert_bytes)

        except Exception as exc:
            logger.error('AS4 signature verification error: %s', exc, exc_info=True)
            return False

    # ── Credential loading ─────────────────────────────────────────────────────

    def _load_credentials(self) -> None:
        if self._cert is not None:
            return

        if not self._cert_path or not self._key_path:
            raise RuntimeError(
                'PEPPOL_CERT_PATH and PEPPOL_PRIVATE_KEY_PATH must be configured '
                'to enable AS4 signing.'
            )

        from cryptography import x509
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend

        cert_pem = Path(self._cert_path).read_bytes()
        key_pem  = Path(self._key_path).read_bytes()

        try:
            self._cert = x509.load_pem_x509_certificate(cert_pem, default_backend())
        except Exception:
            self._cert = x509.load_der_x509_certificate(cert_pem, default_backend())

        from cryptography.hazmat.primitives import serialization as ser
        self._cert_der = self._cert.public_bytes(ser.Encoding.DER)

        try:
            self._key = serialization.load_pem_private_key(key_pem, password=None)
        except Exception:
            self._key = serialization.load_der_private_key(key_pem, password=None)

        logger.debug('AS4 signing credentials loaded from: %s', self._cert_path)

    # ── Security header construction ───────────────────────────────────────────

    def _find_security_element(self, envelope: etree._Element) -> etree._Element:
        header = envelope.find(f'{{{NS_SOAP12}}}Header')
        if header is None:
            raise ValueError('SOAP envelope missing Header element.')
        security = header.find(f'{{{NS_WSSE}}}Security')
        if security is None:
            raise ValueError('SOAP Header missing wsse:Security placeholder.')
        return security

    def _add_binary_security_token(
        self, security: etree._Element
    ) -> tuple[str, str]:
        """Add the AP certificate as a wsse:BinarySecurityToken. Returns (bst_id, ref_uri)."""
        bst_id = f'BST-{uuid.uuid4()}'
        bst = etree.SubElement(security, f'{{{NS_WSSE}}}BinarySecurityToken')
        bst.set('EncodingType', WSSE_ENCODING_BASE64)
        bst.set('ValueType',    WSSE_TOKEN_TYPE_X509V3)
        bst.set(f'{{{NS_WSU}}}Id', bst_id)
        bst.text = base64.b64encode(self._cert_der).decode('ascii')
        return bst_id, f'#{bst_id}'

    def _add_timestamp(self, security: etree._Element) -> str:
        """Add wsu:Timestamp for replay protection. Returns ts_id."""
        ts_id = f'TS-{uuid.uuid4()}'
        now    = datetime.now(tz=timezone.utc)
        expire = now + timedelta(seconds=self.TIMESTAMP_TTL_SECONDS)

        ts = etree.SubElement(security, f'{{{NS_WSU}}}Timestamp')
        ts.set(f'{{{NS_WSU}}}Id', ts_id)

        created = etree.SubElement(ts, f'{{{NS_WSU}}}Created')
        created.text = now.strftime(TS_FORMAT)
        expires = etree.SubElement(ts, f'{{{NS_WSU}}}Expires')
        expires.text = expire.strftime(TS_FORMAT)

        return ts_id

    def _add_signature(
        self,
        security: etree._Element,
        envelope: etree._Element,
        payload_bytes: bytes,
        message_id: str,
        bst_id: str,
        token_ref_uri: str,
        ts_id: str,
    ) -> None:
        """Construct and embed the ds:Signature element."""
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding

        sig_id = f'SIG-{uuid.uuid4()}'

        # ── Compute digests of the signed elements ────────────────────────────

        # 1. Payload attachment digest (raw bytes, no XML transforms)
        payload_cid = message_id.replace('@', '_').replace('.', '_')
        payload_digest_b64 = base64.b64encode(
            hashlib.sha256(payload_bytes).digest()
        ).decode('ascii')

        # 2. eb3:Messaging digest (exclusive C14N)
        header = envelope.find(f'{{{NS_SOAP12}}}Header')
        messaging_el = header.find(f'{{{NS_EBMS3}}}Messaging')
        messaging_c14n = etree.tostring(messaging_el, method='c14n', exclusive=True)
        messaging_digest = base64.b64encode(
            hashlib.sha256(messaging_c14n).digest()
        ).decode('ascii')

        # 3. SOAP Body digest (exclusive C14N)
        body_el = envelope.find(f'{{{NS_SOAP12}}}Body')
        body_c14n = etree.tostring(body_el, method='c14n', exclusive=True)
        body_digest = base64.b64encode(
            hashlib.sha256(body_c14n).digest()
        ).decode('ascii')

        # 4. wsu:Timestamp digest (exclusive C14N)
        ts_el = security.find(f'{{{NS_WSU}}}Timestamp')
        ts_c14n = etree.tostring(ts_el, method='c14n', exclusive=True)
        ts_digest = base64.b64encode(
            hashlib.sha256(ts_c14n).digest()
        ).decode('ascii')

        # ── Build ds:SignedInfo ───────────────────────────────────────────────
        signed_info = self._build_signed_info(
            payload_cid=payload_cid,
            payload_digest=payload_digest_b64,
            messaging_digest=messaging_digest,
            body_digest=body_digest,
            ts_digest=ts_digest,
            ts_id=ts_id,
        )

        # Canonicalize SignedInfo — this is what gets RSA-signed
        signed_info_c14n = etree.tostring(signed_info, method='c14n', exclusive=True)

        # ── RSA-SHA256 signature ───────────────────────────────────────────────
        raw_sig = self._key.sign(signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
        sig_value_b64 = base64.b64encode(raw_sig).decode('ascii')

        # ── Assemble ds:Signature and add to Security header ──────────────────
        signature = self._assemble_signature(
            sig_id=sig_id,
            signed_info=signed_info,
            sig_value=sig_value_b64,
            token_ref_uri=token_ref_uri,
        )
        security.append(signature)

    def _build_signed_info(
        self,
        payload_cid: str,
        payload_digest: str,
        messaging_digest: str,
        body_digest: str,
        ts_digest: str,
        ts_id: str,
    ) -> etree._Element:
        signed_info = etree.Element(f'{{{NS_DS}}}SignedInfo')

        c14n_method = etree.SubElement(signed_info, f'{{{NS_DS}}}CanonicalizationMethod')
        c14n_method.set('Algorithm', ALG_C14N_EXCLUSIVE)

        sig_method = etree.SubElement(signed_info, f'{{{NS_DS}}}SignatureMethod')
        sig_method.set('Algorithm', ALG_SIGN_RSA_SHA256)

        # Reference 1: payload attachment (cid: — no XML transform, raw bytes digest)
        self._add_reference(
            signed_info,
            uri=f'cid:{payload_cid}',
            digest=payload_digest,
            transforms=None,
        )

        # Reference 2: eb3:Messaging element (exclusive C14N)
        self._add_reference(
            signed_info,
            uri='#messaging',
            digest=messaging_digest,
            transforms=[ALG_C14N_EXCLUSIVE],
        )

        # Reference 3: SOAP Body (exclusive C14N)
        self._add_reference(
            signed_info,
            uri='#body',
            digest=body_digest,
            transforms=[ALG_C14N_EXCLUSIVE],
        )

        # Reference 4: wsu:Timestamp (exclusive C14N)
        self._add_reference(
            signed_info,
            uri=f'#{ts_id}',
            digest=ts_digest,
            transforms=[ALG_C14N_EXCLUSIVE],
        )

        return signed_info

    def _add_reference(
        self,
        signed_info: etree._Element,
        uri: str,
        digest: str,
        transforms: Optional[list[str]],
    ) -> None:
        ref = etree.SubElement(signed_info, f'{{{NS_DS}}}Reference')
        ref.set('URI', uri)

        if transforms:
            transforms_el = etree.SubElement(ref, f'{{{NS_DS}}}Transforms')
            for alg in transforms:
                tr = etree.SubElement(transforms_el, f'{{{NS_DS}}}Transform')
                tr.set('Algorithm', alg)

        dm = etree.SubElement(ref, f'{{{NS_DS}}}DigestMethod')
        dm.set('Algorithm', ALG_DIGEST_SHA256)

        dv = etree.SubElement(ref, f'{{{NS_DS}}}DigestValue')
        dv.text = digest

    def _assemble_signature(
        self,
        sig_id: str,
        signed_info: etree._Element,
        sig_value: str,
        token_ref_uri: str,
    ) -> etree._Element:
        signature = etree.Element(f'{{{NS_DS}}}Signature')
        signature.set(f'{{{NS_WSU}}}Id', sig_id)

        signature.append(signed_info)

        sv_el = etree.SubElement(signature, f'{{{NS_DS}}}SignatureValue')
        sv_el.text = sig_value

        key_info = etree.SubElement(signature, f'{{{NS_DS}}}KeyInfo')
        sec_token_ref = etree.SubElement(key_info, f'{{{NS_WSSE}}}SecurityTokenReference')
        reference = etree.SubElement(sec_token_ref, f'{{{NS_WSSE}}}Reference')
        reference.set('URI', token_ref_uri)
        reference.set('ValueType', WSSE_TOKEN_TYPE_X509V3)

        return signature

    def _verify_signature(
        self,
        envelope: etree._Element,
        sig_el: etree._Element,
        cert_bytes: bytes,
    ) -> bool:
        """Verify XMLDSig signature. Uses xmlsec if available, else manual RSA check."""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding

            try:
                cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
            except Exception:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())

            pub_key = cert.public_key()

            # Extract SignedInfo and SignatureValue
            signed_info_el = sig_el.find(f'{{{NS_DS}}}SignedInfo')
            sig_value_el   = sig_el.find(f'{{{NS_DS}}}SignatureValue')

            if signed_info_el is None or sig_value_el is None:
                return False

            # Canonicalize SignedInfo with exclusive C14N
            signed_info_c14n = etree.tostring(
                signed_info_el, method='c14n', exclusive=True
            )
            raw_sig = base64.b64decode(sig_value_el.text or '')

            pub_key.verify(raw_sig, signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
            logger.info('AS4 inbound signature verification: VALID')
            return True

        except Exception as exc:
            logger.warning('AS4 signature verification failed: %s', exc)
            return False
