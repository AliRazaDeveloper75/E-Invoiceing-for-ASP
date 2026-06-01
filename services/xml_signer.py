"""
XAdES-BES XML Digital Signature Service for PEPPOL invoices.

Implements XAdES Basic Electronic Signature (XAdES-BES) on top of W3C XMLDSig,
as required by PEPPOL BIS 3.0 and the OpenPEPPOL PKI framework.

XAdES-BES adds:
  - SignedProperties with signing time, signing certificate reference, policy
  - These are included in the signed payload (commitment to what was signed)

The signed XML is wrapped in a UBL ext:UBLExtension block and placed at the
top of the Invoice element, before all other content, per PEPPOL requirements.

Dependencies (install when certs are provisioned):
  pip install signxml lxml cryptography

Usage:
    signer = XAdESBESSigner()
    signed_xml = signer.sign(xml_bytes, invoice_id='INV-0001')

    verifier = XAdESBESSigner()
    is_valid  = verifier.verify(signed_xml)

IMPORTANT: PEPPOL_SIGNING_ENABLED must be True in settings and valid
cert/key paths must be configured before signing will activate.
Unsigned XML is returned unchanged when signing is disabled.
"""
import base64
import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)

# ─── Namespace constants ──────────────────────────────────────────────────────

DS   = 'http://www.w3.org/2000/09/xmldsig#'
XADES = 'http://uri.etsi.org/01903/v1.3.2#'
UBL_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'

NSMAP_DS = {
    'ds':    DS,
    'xades': XADES,
}


# ─── Signer ───────────────────────────────────────────────────────────────────

class XAdESBESSigner:
    """
    Signs and verifies PEPPOL UBL 2.1 Invoice XML using XAdES-BES.

    Sign flow:
      1. Load private key + certificate from settings paths
      2. Build XAdES SignedProperties (signing time, cert digest, policy)
      3. Compute Canonicalized digest of SignedProperties
      4. Build ds:Signature element with SignedInfo over document + SignedProperties
      5. Compute RSA-SHA256 signature value
      6. Embed the complete signature as a UBL extension in the Invoice root

    Verify flow:
      1. Extract ds:Signature from the document
      2. Re-compute digests and verify the signature value against the certificate
    """

    # PEPPOL uses the ETSI explicit policy — no specific OID mandated yet for UAE
    _POLICY_ID          = 'urn:fdc:peppol.eu:2017:polacc:1.0'
    _POLICY_DESCRIPTION = 'PEPPOL POACC Procurement 1.0 Signature Policy'
    _DIGEST_ALG         = 'http://www.w3.org/2001/04/xmlenc#sha256'
    _SIGN_ALG           = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
    _C14N_ALG           = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'

    def __init__(self):
        from django.conf import settings
        self._cert_path = getattr(settings, 'PEPPOL_CERT_PATH',        '')
        self._key_path  = getattr(settings, 'PEPPOL_PRIVATE_KEY_PATH', '')
        self._enabled   = getattr(settings, 'PEPPOL_SIGNING_ENABLED',  False)
        self._cert      = None
        self._key       = None

    # ── Public API ────────────────────────────────────────────────────────────

    def sign(self, xml_bytes: bytes, invoice_id: str = '') -> bytes:
        """
        Sign the invoice XML. Returns signed XML bytes.
        If signing is disabled or certs are missing, returns xml_bytes unchanged.
        """
        if not self._enabled:
            logger.debug('XML signing disabled (PEPPOL_SIGNING_ENABLED=False).')
            return xml_bytes

        try:
            self._load_credentials()
        except Exception as exc:
            logger.error('Cannot load signing credentials: %s — invoice will be unsigned.', exc)
            return xml_bytes

        try:
            doc = etree.fromstring(xml_bytes)
            self._inject_signature(doc, invoice_id)
            signed = etree.tostring(
                doc,
                pretty_print=True,
                xml_declaration=True,
                encoding='UTF-8',
            )
            logger.info('Invoice %s signed with XAdES-BES.', invoice_id)
            return signed
        except Exception as exc:
            logger.error('XML signing failed for %s: %s — returning unsigned XML.', invoice_id, exc)
            return xml_bytes

    def verify(self, xml_bytes: bytes) -> bool:
        """
        Verify the XAdES-BES signature in the XML.
        Returns True if signature is valid, False otherwise.

        Requires the `signxml` library for full verification.
        Falls back to basic structural check if signxml is unavailable.
        """
        try:
            from signxml import XMLVerifier
            doc = etree.fromstring(xml_bytes)
            # signxml finds the ds:Signature automatically
            XMLVerifier().verify(doc)
            logger.info('XAdES-BES signature verification: VALID')
            return True
        except ImportError:
            logger.warning('signxml not installed — signature verification unavailable.')
            return self._structural_check(xml_bytes)
        except Exception as exc:
            logger.warning('Signature verification FAILED: %s', exc)
            return False

    # ── Internal: credential loading ──────────────────────────────────────────

    def _load_credentials(self) -> None:
        """Load and cache the signing cert + private key."""
        if self._cert is not None and self._key is not None:
            return  # Already loaded

        if not self._cert_path or not self._key_path:
            raise RuntimeError(
                'PEPPOL_CERT_PATH and PEPPOL_PRIVATE_KEY_PATH must be set in settings.'
            )

        from cryptography import x509
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend

        cert_bytes = Path(self._cert_path).read_bytes()
        key_bytes  = Path(self._key_path).read_bytes()

        # Support PEM and DER
        try:
            self._cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
        except Exception:
            self._cert = x509.load_der_x509_certificate(cert_bytes, default_backend())

        # Private key — try PEM first (most common), then DER
        try:
            self._key = serialization.load_pem_private_key(key_bytes, password=None)
        except Exception:
            self._key = serialization.load_der_private_key(key_bytes, password=None)

        logger.debug('Signing credentials loaded from: %s', self._cert_path)

    # ── Internal: signature construction ──────────────────────────────────────

    def _inject_signature(self, doc: etree._Element, invoice_id: str) -> None:
        """
        Build and inject a ds:Signature element into the UBL Invoice root.

        The signature covers:
          - The entire Invoice document (Reference URI="")
          - The xades:SignedProperties element (Reference URI="#SignedProperties")
        """
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        signing_time = datetime.now(tz=timezone.utc).isoformat()
        sig_id = f'Signature-{invoice_id}' if invoice_id else 'Signature-1'

        # ── Build xades:SignedProperties ──────────────────────────────────────
        signed_props = self._build_signed_properties(sig_id, signing_time)

        # Canonicalize SignedProperties and compute its digest
        c14n_props = etree.tostring(signed_props, method='c14n', exclusive=False)
        props_digest = base64.b64encode(
            hashlib.sha256(c14n_props).digest()
        ).decode('ascii')

        # ── Canonicalize the invoice document and compute its digest ──────────
        c14n_doc = etree.tostring(doc, method='c14n', exclusive=False)
        doc_digest = base64.b64encode(
            hashlib.sha256(c14n_doc).digest()
        ).decode('ascii')

        # ── Build ds:SignedInfo ───────────────────────────────────────────────
        signed_info = self._build_signed_info(doc_digest, props_digest, sig_id)

        # Canonicalize SignedInfo — this is what gets RSA-signed
        c14n_signed_info = etree.tostring(signed_info, method='c14n', exclusive=False)

        # ── Compute RSA-SHA256 signature ──────────────────────────────────────
        raw_sig = self._key.sign(c14n_signed_info, padding.PKCS1v15(), hashes.SHA256())
        sig_value = base64.b64encode(raw_sig).decode('ascii')

        # ── Get certificate DER bytes for KeyInfo ─────────────────────────────
        cert_der = self._cert.public_bytes(serialization.Encoding.DER)
        cert_b64 = base64.b64encode(cert_der).decode('ascii')

        # ── Assemble ds:Signature ─────────────────────────────────────────────
        signature = self._assemble_signature(
            sig_id, signed_info, sig_value, cert_b64, signed_props
        )

        # ── Wrap in UBL UBLExtensions/UBLExtension/ExtensionContent ──────────
        self._inject_ubl_extension(doc, signature)

    def _build_signed_properties(self, sig_id: str, signing_time: str) -> etree._Element:
        """Construct xades:SignedProperties with SigningTime, cert reference, policy."""
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.backends import default_backend

        props_id = f'SignedProperties-{sig_id}'
        signed_props = etree.Element(f'{{{XADES}}}SignedProperties', Id=props_id, nsmap=NSMAP_DS)

        sig_signed_props = etree.SubElement(signed_props, f'{{{XADES}}}SignedSignatureProperties')

        # SigningTime
        time_el = etree.SubElement(sig_signed_props, f'{{{XADES}}}SigningTime')
        time_el.text = signing_time

        # SigningCertificate — digest of the signing cert
        cert_der = self._cert.public_bytes(serialization.Encoding.DER)
        cert_digest = base64.b64encode(hashlib.sha256(cert_der).digest()).decode('ascii')

        signing_cert = etree.SubElement(sig_signed_props, f'{{{XADES}}}SigningCertificate')
        cert_el = etree.SubElement(signing_cert, f'{{{XADES}}}Cert')
        cert_digest_el = etree.SubElement(cert_el, f'{{{XADES}}}CertDigest')
        dig_method = etree.SubElement(cert_digest_el, f'{{{DS}}}DigestMethod')
        dig_method.set('Algorithm', self._DIGEST_ALG)
        dig_value = etree.SubElement(cert_digest_el, f'{{{DS}}}DigestValue')
        dig_value.text = cert_digest

        # IssuerSerial
        issuer_serial = etree.SubElement(cert_el, f'{{{XADES}}}IssuerSerial')
        x509_issuer = etree.SubElement(issuer_serial, f'{{{DS}}}X509IssuerName')
        x509_issuer.text = self._cert.issuer.rfc4514_string()
        x509_serial = etree.SubElement(issuer_serial, f'{{{DS}}}X509SerialNumber')
        x509_serial.text = str(self._cert.serial_number)

        # SignaturePolicyIdentifier
        policy = etree.SubElement(sig_signed_props, f'{{{XADES}}}SignaturePolicyIdentifier')
        policy_id = etree.SubElement(policy, f'{{{XADES}}}SignaturePolicyId')
        sig_policy_id = etree.SubElement(policy_id, f'{{{XADES}}}SigPolicyId')
        id_el = etree.SubElement(sig_policy_id, f'{{{XADES}}}Identifier')
        id_el.text = self._POLICY_ID
        desc_el = etree.SubElement(sig_policy_id, f'{{{XADES}}}Description')
        desc_el.text = self._POLICY_DESCRIPTION

        return signed_props

    def _build_signed_info(
        self, doc_digest: str, props_digest: str, sig_id: str
    ) -> etree._Element:
        """Construct ds:SignedInfo with References to the document and SignedProperties."""
        signed_info = etree.Element(f'{{{DS}}}SignedInfo', nsmap=NSMAP_DS)

        c14n_method = etree.SubElement(signed_info, f'{{{DS}}}CanonicalizationMethod')
        c14n_method.set('Algorithm', self._C14N_ALG)

        sig_method = etree.SubElement(signed_info, f'{{{DS}}}SignatureMethod')
        sig_method.set('Algorithm', self._SIGN_ALG)

        # Reference 1: the invoice document itself
        ref1 = etree.SubElement(signed_info, f'{{{DS}}}Reference', URI='')
        transforms1 = etree.SubElement(ref1, f'{{{DS}}}Transforms')
        tr1 = etree.SubElement(transforms1, f'{{{DS}}}Transform')
        tr1.set('Algorithm', self._C14N_ALG)
        dm1 = etree.SubElement(ref1, f'{{{DS}}}DigestMethod')
        dm1.set('Algorithm', self._DIGEST_ALG)
        dv1 = etree.SubElement(ref1, f'{{{DS}}}DigestValue')
        dv1.text = doc_digest

        # Reference 2: the xades:SignedProperties
        props_ref_uri = f'#SignedProperties-Signature-{sig_id}' if 'Signature-' not in sig_id else f'#SignedProperties-{sig_id}'
        ref2 = etree.SubElement(signed_info, f'{{{DS}}}Reference', URI=props_ref_uri)
        ref2.set('Type', 'http://uri.etsi.org/01903#SignedProperties')
        dm2 = etree.SubElement(ref2, f'{{{DS}}}DigestMethod')
        dm2.set('Algorithm', self._DIGEST_ALG)
        dv2 = etree.SubElement(ref2, f'{{{DS}}}DigestValue')
        dv2.text = props_digest

        return signed_info

    def _assemble_signature(
        self,
        sig_id: str,
        signed_info: etree._Element,
        sig_value: str,
        cert_b64: str,
        signed_props: etree._Element,
    ) -> etree._Element:
        """Assemble the complete ds:Signature element."""
        signature = etree.Element(f'{{{DS}}}Signature', Id=sig_id, nsmap=NSMAP_DS)
        signature.append(signed_info)

        # SignatureValue
        sv = etree.SubElement(signature, f'{{{DS}}}SignatureValue')
        sv.text = sig_value

        # KeyInfo with X509Data
        key_info = etree.SubElement(signature, f'{{{DS}}}KeyInfo')
        x509_data = etree.SubElement(key_info, f'{{{DS}}}X509Data')
        x509_cert = etree.SubElement(x509_data, f'{{{DS}}}X509Certificate')
        x509_cert.text = cert_b64

        # Object containing xades:QualifyingProperties → SignedProperties
        obj = etree.SubElement(signature, f'{{{DS}}}Object')
        qualifying = etree.SubElement(obj, f'{{{XADES}}}QualifyingProperties', Target=f'#{sig_id}')
        qualifying.append(signed_props)

        return signature

    def _inject_ubl_extension(self, doc: etree._Element, signature: etree._Element) -> None:
        """
        Wrap the ds:Signature in a UBL UBLExtensions structure and prepend
        it as the first child of the Invoice root element.
        """
        ext_content = etree.Element(f'{{{UBL_EXT}}}ExtensionContent')
        ext_content.append(signature)

        ubl_extension = etree.Element(f'{{{UBL_EXT}}}UBLExtension')
        ubl_extension.append(ext_content)

        ubl_extensions = etree.Element(f'{{{UBL_EXT}}}UBLExtensions')
        ubl_extensions.append(ubl_extension)

        # Insert as the first child (before cbc:UBLVersionID etc.)
        doc.insert(0, ubl_extensions)

    # ── Internal: structural verification fallback ────────────────────────────

    def _structural_check(self, xml_bytes: bytes) -> bool:
        """Minimal check: does a ds:Signature element exist?"""
        try:
            doc = etree.fromstring(xml_bytes)
            sig_els = doc.findall(f'.//{{{DS}}}Signature')
            has_sig = len(sig_els) > 0
            if not has_sig:
                logger.warning('No ds:Signature element found in document.')
            return has_sig
        except Exception as exc:
            logger.error('Structural signature check failed: %s', exc)
            return False
