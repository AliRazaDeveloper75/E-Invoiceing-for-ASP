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
        self._keystore_path = getattr(settings, 'PEPPOL_KEYSTORE_PATH', '')
        self._keystore_pwd  = getattr(settings, 'PEPPOL_KEYSTORE_PASSWORD', '')
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

    def verify_inbound(self, envelope: etree._Element, attachments: Optional[dict] = None) -> bool:
        """
        Verify the WS-Security signature on an inbound AS4 message.

        Resolves the signing certificate via the Signature's KeyInfo →
        SecurityTokenReference → BinarySecurityToken (NOT just the first BST —
        AS4 messages carry a separate encryption-key token too), then verifies:
          1. the SignedInfo signature (RSA-SHA256 over exclusive-C14N SignedInfo,
             honouring InclusiveNamespaces PrefixList), and
          2. each ds:Reference digest (XML elements + cid: attachments).

        Returns True if the signature is valid, False otherwise.
        """
        try:
            security_el = self._find_security_element(envelope)
            sig_el = security_el.find(f'{{{NS_DS}}}Signature')
            if sig_el is None:
                logger.warning('AS4 inbound: no ds:Signature found in Security header.')
                return False

            cert_bytes = self._resolve_signing_cert(security_el, sig_el)
            if cert_bytes is None:
                logger.warning('AS4 inbound: could not resolve the signing certificate.')
                return False

            if not self._verify_signature(envelope, sig_el, cert_bytes, attachments or {}):
                return False

            # PEPPOL trust gate: a cryptographically-valid signature is not enough —
            # the signer's certificate MUST chain to an OpenPEPPOL PKI trust anchor,
            # be within its validity window, and NOT be revoked. Reject otherwise
            # (PKI G3 "invalid certificate reception" / general network policy).
            from django.conf import settings as _settings
            if getattr(_settings, 'PEPPOL_AS4_VERIFY_SIGNER_TRUST', True):
                if not self._verify_signer_trust(cert_bytes):
                    return False

            return True

        except Exception as exc:
            logger.error('AS4 signature verification error: %s', exc, exc_info=True)
            return False

    @staticmethod
    def _verify_signer_trust(cert_bytes: bytes) -> bool:
        """
        Validate the inbound signer certificate against the OpenPEPPOL PKI:
        trust-chain + validity window + CRL revocation. Returns True only when
        the certificate is trusted, current and not revoked.
        """
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            try:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())
            except Exception:
                cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())

            from .cert_validation import validate_recipient_cert
            vr = validate_recipient_cert(cert)
            if not vr.valid:
                logger.warning('AS4 inbound: signer certificate REJECTED — %s (subject=%s)',
                               vr.reason, vr.subject)
            else:
                logger.info('AS4 inbound: signer certificate trusted (subject=%s)', vr.subject)
            return vr.valid
        except Exception as exc:
            logger.warning('AS4 inbound: signer trust validation error: %s', exc)
            return False

    # ── Inbound verification helpers ────────────────────────────────────────────

    @staticmethod
    def _resolve_signing_cert(security_el: etree._Element, sig_el: etree._Element) -> Optional[bytes]:
        """
        Resolve the X.509 signing cert referenced by the Signature's KeyInfo.

        Signature/KeyInfo/SecurityTokenReference/Reference @URI points (by '#id')
        to the wsse:BinarySecurityToken that holds the signer's certificate.
        Falls back to the last BST if no explicit reference is found.
        """
        ref_uri = ''
        key_info = sig_el.find(f'{{{NS_DS}}}KeyInfo')
        if key_info is not None:
            ref = key_info.find(f'.//{{{NS_WSSE}}}Reference')
            if ref is not None:
                ref_uri = (ref.get('URI') or '').lstrip('#')

        bsts = security_el.findall(f'{{{NS_WSSE}}}BinarySecurityToken')
        chosen = None
        if ref_uri:
            for cand in bsts:
                bid = cand.get(f'{{{NS_WSU}}}Id') or cand.get('Id')
                if bid == ref_uri:
                    chosen = cand
                    break
        if chosen is None and bsts:
            chosen = bsts[-1]   # signing token is typically the last one
        if chosen is None or not (chosen.text or '').strip():
            return None
        return base64.b64decode(''.join((chosen.text or '').split()))

    @staticmethod
    def _inclusive_prefixes(method_el: Optional[etree._Element]) -> Optional[list]:
        """Read the exc-c14n InclusiveNamespaces PrefixList from a method/transform element."""
        if method_el is None:
            return None
        inc = method_el.find(f'{{{ALG_C14N_EXCLUSIVE}}}InclusiveNamespaces')
        if inc is None:
            return None
        pl = (inc.get('PrefixList') or '').strip()
        return pl.split() if pl else None

    @staticmethod
    def _c14n(el: etree._Element, prefixes: Optional[list]) -> bytes:
        """Exclusive C14N of an element, honouring an InclusiveNamespaces prefix list."""
        if prefixes:
            return etree.tostring(el, method='c14n', exclusive=True, inclusive_ns_prefixes=prefixes)
        return etree.tostring(el, method='c14n', exclusive=True)

    @staticmethod
    def _find_by_id(envelope: etree._Element, ref_id: str) -> Optional[etree._Element]:
        """Find an element by wsu:Id (or plain Id) anywhere in the envelope."""
        for el in envelope.iter():
            if el.get(f'{{{NS_WSU}}}Id') == ref_id or el.get('Id') == ref_id:
                return el
        return None

    def _verify_reference(
        self, envelope: etree._Element, ref: etree._Element, attachments: dict
    ) -> bool:
        """Verify a single ds:Reference digest (XML element or cid: attachment)."""
        uri = ref.get('URI') or ''
        digest_el = ref.find(f'{{{NS_DS}}}DigestValue')
        if digest_el is None or not digest_el.text:
            return False
        expected = digest_el.text.strip()

        if uri.startswith('cid:'):
            cid = uri[4:]
            data = attachments.get(cid)
            if data is None:
                data = attachments.get(cid.split('@', 1)[0])
            if data is None:
                logger.warning('AS4 verify: attachment for %s not available', uri)
                return False
            actual = base64.b64encode(hashlib.sha256(data).digest()).decode('ascii')
            return actual == expected

        ref_id = uri.lstrip('#')
        target = self._find_by_id(envelope, ref_id)
        if target is None:
            logger.warning('AS4 verify: referenced element #%s not found', ref_id)
            return False

        prefixes = None
        transforms = ref.find(f'{{{NS_DS}}}Transforms')
        if transforms is not None:
            for t in transforms.findall(f'{{{NS_DS}}}Transform'):
                if t.get('Algorithm') == ALG_C14N_EXCLUSIVE:
                    prefixes = self._inclusive_prefixes(t)
        c14n = self._c14n(target, prefixes)
        actual = base64.b64encode(hashlib.sha256(c14n).digest()).decode('ascii')
        return actual == expected

    # ── Credential loading ─────────────────────────────────────────────────────

    def _load_credentials(self) -> None:
        if self._cert is not None:
            return

        from cryptography.hazmat.primitives import serialization as ser

        # Preferred path: a PKCS#12 keystore (.p12/.pfx) as issued by the PEPPOL portal.
        if self._keystore_path:
            self._load_from_keystore()
        elif self._cert_path and self._key_path:
            self._load_from_pem()
        else:
            raise RuntimeError(
                'No AS4 signing credentials configured. Set PEPPOL_KEYSTORE_PATH '
                '(+ PEPPOL_KEYSTORE_PASSWORD) for a .p12 keystore, or '
                'PEPPOL_CERT_PATH + PEPPOL_PRIVATE_KEY_PATH for PEM files.'
            )

        # Cache the DER encoding of the cert for the BinarySecurityToken.
        self._cert_der = self._cert.public_bytes(ser.Encoding.DER)

    def _load_from_keystore(self) -> None:
        """Load cert + private key from a PKCS#12 (.p12/.pfx) keystore."""
        from cryptography.hazmat.primitives.serialization import pkcs12

        p12_bytes = Path(self._keystore_path).read_bytes()
        password  = self._keystore_pwd.encode('utf-8') if self._keystore_pwd else None

        key, cert, _additional = pkcs12.load_key_and_certificates(p12_bytes, password)
        if cert is None or key is None:
            raise RuntimeError(
                f'PKCS#12 keystore {self._keystore_path} did not contain both a '
                'certificate and a private key.'
            )
        self._cert = cert
        self._key  = key
        logger.info('AS4 signing credentials loaded from keystore: %s', self._keystore_path)

    def _load_from_pem(self) -> None:
        """Load cert + (unencrypted) private key from separate PEM/DER files."""
        from cryptography import x509
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend

        cert_pem = Path(self._cert_path).read_bytes()
        key_pem  = Path(self._key_path).read_bytes()

        try:
            self._cert = x509.load_pem_x509_certificate(cert_pem, default_backend())
        except Exception:
            self._cert = x509.load_der_x509_certificate(cert_pem, default_backend())

        try:
            self._key = serialization.load_pem_private_key(key_pem, password=None)
        except Exception:
            self._key = serialization.load_der_private_key(key_pem, password=None)

        logger.info('AS4 signing credentials loaded from PEM: %s', self._cert_path)

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

        # 1. Payload attachment digest (raw bytes, no XML transforms).
        #    Receipts/signals have no payload attachment, so this is skipped
        #    when payload_bytes is empty (no cid: reference to resolve).
        if payload_bytes:
            payload_cid = message_id.replace('@', '_').replace('.', '_')
            payload_digest_b64 = base64.b64encode(
                hashlib.sha256(payload_bytes).digest()
            ).decode('ascii')
        else:
            payload_cid = None
            payload_digest_b64 = None

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

        # ── Assemble ds:Signature and attach to the tree FIRST ────────────────
        # SignedInfo must be canonicalized from its in-tree position so the
        # namespace context matches at sign-time and verify-time. Signing a
        # detached SignedInfo and verifying an attached one produces a mismatch.
        signature = self._assemble_signature(
            sig_id=sig_id,
            signed_info=signed_info,
            sig_value='',                 # filled in after we compute the signature
            token_ref_uri=token_ref_uri,
        )
        security.append(signature)

        # ── Canonicalize the now-attached SignedInfo and RSA-sign it ──────────
        signed_info_c14n = etree.tostring(signed_info, method='c14n', exclusive=True)
        raw_sig = self._key.sign(signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
        sig_value_el = signature.find(f'{{{NS_DS}}}SignatureValue')
        sig_value_el.text = base64.b64encode(raw_sig).decode('ascii')

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

        # Reference 1: payload attachment (cid: — raw bytes digest, no transform).
        # Omitted for receipts/signals that carry no payload attachment.
        if payload_cid is not None and payload_digest is not None:
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
        attachments: dict,
    ) -> bool:
        """Verify the XMLDSig: SignedInfo RSA signature + each reference digest."""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding

            try:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())
            except Exception:
                cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())

            pub_key = cert.public_key()

            signed_info_el = sig_el.find(f'{{{NS_DS}}}SignedInfo')
            sig_value_el   = sig_el.find(f'{{{NS_DS}}}SignatureValue')
            if signed_info_el is None or sig_value_el is None:
                logger.warning('AS4 verify: missing SignedInfo / SignatureValue.')
                return False

            # 1. Verify the SignedInfo signature — exclusive C14N honouring the
            #    CanonicalizationMethod's InclusiveNamespaces PrefixList.
            c14n_method = signed_info_el.find(f'{{{NS_DS}}}CanonicalizationMethod')
            prefixes = self._inclusive_prefixes(c14n_method)
            signed_info_c14n = self._c14n(signed_info_el, prefixes)
            raw_sig = base64.b64decode(''.join((sig_value_el.text or '').split()))
            try:
                pub_key.verify(raw_sig, signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
            except Exception as exc:
                logger.warning('AS4 verify: SignedInfo signature INVALID: %s', exc)
                return False

            # 2. Verify each reference digest (XML elements + cid attachments).
            from django.conf import settings as _settings
            strict = getattr(_settings, 'PEPPOL_AS4_STRICT_DIGESTS', True)
            for ref in signed_info_el.findall(f'{{{NS_DS}}}Reference'):
                if not self._verify_reference(envelope, ref, attachments):
                    if strict:
                        logger.warning('AS4 verify: reference digest FAILED for %s', ref.get('URI'))
                        return False
                    logger.warning('AS4 verify: reference digest mismatch (non-strict) for %s', ref.get('URI'))

            logger.info('AS4 inbound signature verification: VALID (signer=%s)',
                        cert.subject.rfc4514_string())
            return True

        except Exception as exc:
            logger.warning('AS4 signature verification failed: %s', exc)
            return False
