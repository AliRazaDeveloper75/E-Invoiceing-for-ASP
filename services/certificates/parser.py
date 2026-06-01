"""
X.509 Certificate Parser.

Parses PEM/DER certificate files and returns structured metadata.
Used by the certificate management system and PEPPOL certificate monitor.

Supports:
  - PEM and DER encoded certificates
  - RSA and EC keys
  - Certificate chain parsing (PEM bundles)
  - PEPPOL-specific subject field extraction
"""
import base64
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ParsedCertificate:
    """Structured representation of a parsed X.509 certificate."""
    subject:            str = ''
    issuer:             str = ''
    serial_number:      str = ''       # Hex string
    not_before:         Optional[datetime] = None
    not_after:          Optional[datetime] = None
    fingerprint_sha256: str = ''       # Hex
    fingerprint_sha1:   str = ''       # Hex
    key_type:           str = ''       # 'RSA' or 'EC'
    key_size_bits:      int = 0
    is_ca:              bool = False
    san_dns_names:      list = field(default_factory=list)
    san_ip_addresses:   list = field(default_factory=list)
    ocsp_url:           Optional[str] = None
    crl_urls:           list = field(default_factory=list)
    issuer_cert_url:    Optional[str] = None  # AIA caIssuers
    raw_der:            bytes = field(default_factory=bytes)
    raw_pem:            str = ''

    @property
    def days_until_expiry(self) -> Optional[int]:
        if self.not_after is None:
            return None
        return (self.not_after - datetime.now(tz=timezone.utc)).days

    @property
    def is_expired(self) -> bool:
        if self.not_after is None:
            return False
        return datetime.now(tz=timezone.utc) > self.not_after

    @property
    def common_name(self) -> str:
        """Extract CN from subject DN."""
        for part in self.subject.split(','):
            part = part.strip()
            if part.startswith('CN='):
                return part[3:]
        return self.subject


class CertificateParser:
    """
    Parses X.509 certificates from PEM or DER format.

    Usage:
        parser = CertificateParser()
        cert = parser.parse_file('/etc/peppol/ap.pem')
        print(cert.days_until_expiry)
    """

    def parse_file(self, path: str) -> ParsedCertificate:
        """Parse a certificate from a file path."""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f'Certificate file not found: {path}')
        return self.parse_bytes(p.read_bytes())

    def parse_bytes(self, cert_bytes: bytes) -> ParsedCertificate:
        """Parse a certificate from raw bytes (auto-detects PEM or DER)."""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend

            # Try PEM first
            cert = None
            raw_pem = ''
            try:
                cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
                raw_pem = cert_bytes.decode('utf-8', errors='replace')
            except Exception:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())

            return self._extract_fields(cert, raw_pem)

        except ImportError:
            raise RuntimeError(
                'cryptography package is required for certificate parsing. '
                'Install: pip install cryptography'
            )

    def parse_chain(self, pem_bytes: bytes) -> list[ParsedCertificate]:
        """
        Parse a PEM certificate chain (multiple PEM blocks in one file).
        Returns list of ParsedCertificate, ordered as found in the file.
        """
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend

        certs = []
        pem_str = pem_bytes.decode('utf-8', errors='replace')

        # Split on PEM boundaries
        import re
        pem_blocks = re.findall(
            r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',
            pem_str, re.DOTALL
        )

        for block in pem_blocks:
            try:
                cert = x509.load_pem_x509_certificate(
                    block.encode('utf-8'), default_backend()
                )
                parsed = self._extract_fields(cert, block)
                certs.append(parsed)
            except Exception as exc:
                logger.warning('Failed to parse PEM block: %s', exc)

        return certs

    def _extract_fields(self, cert, raw_pem: str = '') -> ParsedCertificate:
        """Extract all fields from a cryptography x509.Certificate object."""
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa, ec

        raw_der = cert.public_bytes(serialization.Encoding.DER)

        # Fingerprints
        fp_sha256 = hashlib.sha256(raw_der).hexdigest()
        fp_sha1   = hashlib.sha1(raw_der).hexdigest()

        # Expiry (handle both old and new cryptography API)
        try:
            not_before = cert.not_valid_before_utc
            not_after  = cert.not_valid_after_utc
        except AttributeError:
            not_before = cert.not_valid_before.replace(tzinfo=timezone.utc)
            not_after  = cert.not_valid_after.replace(tzinfo=timezone.utc)

        # Key type and size
        pub_key = cert.public_key()
        if isinstance(pub_key, rsa.RSAPublicKey):
            key_type = 'RSA'
            key_size = pub_key.key_size
        elif isinstance(pub_key, ec.EllipticCurvePublicKey):
            key_type = 'EC'
            key_size = pub_key.key_size
        else:
            key_type = 'Unknown'
            key_size = 0

        # CA flag
        is_ca = False
        try:
            bc = cert.extensions.get_extension_for_class(x509.BasicConstraints)
            is_ca = bc.value.ca
        except x509.ExtensionNotFound:
            pass

        # SANs
        san_dns, san_ip = [], []
        try:
            san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            san_dns = san.value.get_values_for_type(x509.DNSName)
            san_ip  = [str(ip) for ip in san.value.get_values_for_type(x509.IPAddress)]
        except x509.ExtensionNotFound:
            pass

        # OCSP + CRL + AIA
        ocsp_url, crl_urls, issuer_cert_url = self._extract_revocation_info(cert)

        # If no raw_pem, construct from DER
        if not raw_pem:
            raw_pem = (
                '-----BEGIN CERTIFICATE-----\n'
                + base64.b64encode(raw_der).decode('ascii')
                + '\n-----END CERTIFICATE-----'
            )

        return ParsedCertificate(
            subject=cert.subject.rfc4514_string(),
            issuer=cert.issuer.rfc4514_string(),
            serial_number=format(cert.serial_number, 'x').upper(),
            not_before=not_before,
            not_after=not_after,
            fingerprint_sha256=fp_sha256,
            fingerprint_sha1=fp_sha1,
            key_type=key_type,
            key_size_bits=key_size,
            is_ca=is_ca,
            san_dns_names=san_dns,
            san_ip_addresses=san_ip,
            ocsp_url=ocsp_url,
            crl_urls=crl_urls,
            issuer_cert_url=issuer_cert_url,
            raw_der=raw_der,
            raw_pem=raw_pem,
        )

    def _extract_revocation_info(self, cert) -> tuple[Optional[str], list, Optional[str]]:
        """Extract OCSP URL, CRL DPs, and AIA issuer URL from certificate extensions."""
        from cryptography import x509

        ocsp_url = None
        crl_urls = []
        issuer_cert_url = None

        # Authority Information Access (OCSP + CA Issuers)
        try:
            aia = cert.extensions.get_extension_for_class(x509.AuthorityInformationAccess)
            for access in aia.value:
                if access.access_method == x509.AuthorityInformationAccessOID.OCSP:
                    ocsp_url = access.access_location.value
                elif access.access_method == x509.AuthorityInformationAccessOID.CA_ISSUERS:
                    issuer_cert_url = access.access_location.value
        except x509.ExtensionNotFound:
            pass

        # CRL Distribution Points
        try:
            crldp = cert.extensions.get_extension_for_class(
                x509.CRLDistributionPoints
            )
            for dp in crldp.value:
                if dp.full_name:
                    for name in dp.full_name:
                        crl_urls.append(name.value)
        except x509.ExtensionNotFound:
            pass

        return ocsp_url, crl_urls, issuer_cert_url
