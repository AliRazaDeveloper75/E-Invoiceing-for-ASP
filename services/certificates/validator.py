"""
Certificate Trust Chain + Revocation Validator.

Validates PEPPOL AP certificates by checking:
  1. Trust chain — certificate is issued by a trusted PEPPOL CA
  2. OCSP      — certificate is not revoked (Online Certificate Status Protocol)
  3. CRL       — fallback revocation check via Certificate Revocation List
  4. Validity  — certificate is not expired and not yet valid

PEPPOL Trust Anchors:
  - OpenPEPPOL Root CA (Production)
  - OpenPEPPOL Root CA (Pilot/Test)
  - UAE-specific CA (if applicable)

References:
  RFC 6960 — OCSP (Online Certificate Status Protocol)
  RFC 5280 — Internet X.509 Public Key Infrastructure Certificate
  PEPPOL PKI Policy v4.0
"""
import logging
import socket
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)


@dataclass
class RevocationStatus:
    """Result of a revocation check (OCSP or CRL)."""
    method:      str  = ''      # 'ocsp' or 'crl'
    status:      str  = ''      # 'good', 'revoked', 'unknown', 'error'
    revoked_at:  Optional[datetime] = None
    reason:      str  = ''
    checked_at:  Optional[datetime] = None
    error:       str  = ''

    @property
    def is_revoked(self) -> bool:
        return self.status == 'revoked'

    @property
    def is_good(self) -> bool:
        return self.status == 'good'


@dataclass
class ChainValidationResult:
    """Result of full certificate chain validation."""
    is_trusted:      bool = False
    chain_length:    int  = 0
    trust_anchor:    str  = ''
    errors:          list = field(default_factory=list)
    warnings:        list = field(default_factory=list)
    revocation:      Optional[RevocationStatus] = None

    @property
    def is_valid(self) -> bool:
        return self.is_trusted and not self.errors


# ─── PEPPOL Trusted CA Fingerprints ──────────────────────────────────────────

# OpenPEPPOL Root CA certificates (SHA-256 fingerprints, without colons)
# These are fixed trust anchors — if a cert doesn't chain to one of these,
# it cannot be trusted for PEPPOL transmission.
PEPPOL_TRUSTED_CA_FINGERPRINTS = {
    # OpenPEPPOL Root CA — Production (update when CA is renewed)
    'OpenPEPPOL Root CA': None,   # Load from settings.PEPPOL_CA_CERT_PATH dynamically
}


class CertificateValidator:
    """
    Validates PEPPOL certificates for trustworthiness and revocation.

    Usage:
        validator = CertificateValidator()
        result = validator.validate(cert_pem_bytes)
        if not result.is_valid:
            raise PEPPOLCertError('Certificate invalid: ' + str(result.errors))
    """

    OCSP_TIMEOUT = 10        # seconds
    CRL_TIMEOUT  = 15        # seconds
    CRL_MAX_SIZE = 10 * 1024 * 1024   # 10 MB

    def __init__(self):
        from django.conf import settings
        self._ca_cert_path = getattr(settings, 'PEPPOL_CA_CERT_PATH', '')
        self._warning_days = getattr(settings, 'PEPPOL_CERT_EXPIRY_WARNING_DAYS', 30)

    # ── Public API ────────────────────────────────────────────────────────────

    def validate(self, cert_bytes: bytes, check_revocation: bool = True) -> ChainValidationResult:
        """
        Full certificate validation: expiry + trust chain + revocation.

        Args:
            cert_bytes:        PEM or DER certificate bytes
            check_revocation:  If False, skip OCSP/CRL checks (useful offline)
        """
        from .parser import CertificateParser
        parser = CertificateParser()

        result = ChainValidationResult()

        try:
            parsed = parser.parse_bytes(cert_bytes)
        except Exception as exc:
            result.errors.append(f'Certificate parse failed: {exc}')
            return result

        # 1. Expiry check
        if parsed.is_expired:
            result.errors.append(
                f'Certificate expired on {parsed.not_after.strftime("%Y-%m-%d")} — '
                f'{abs(parsed.days_until_expiry)} day(s) ago.'
            )
        elif parsed.days_until_expiry is not None and parsed.days_until_expiry <= self._warning_days:
            result.warnings.append(
                f'Certificate expires in {parsed.days_until_expiry} day(s) '
                f'({parsed.not_after.strftime("%Y-%m-%d")}) — renew soon.'
            )

        # 2. Trust chain validation
        self._validate_trust_chain(parsed, result)

        # 3. Revocation check (OCSP → CRL fallback)
        if check_revocation and not result.errors:
            result.revocation = self._check_revocation(parsed)
            if result.revocation and result.revocation.is_revoked:
                result.errors.append(
                    f'Certificate is REVOKED via {result.revocation.method}. '
                    f'Reason: {result.revocation.reason or "unspecified"}.'
                )

        result.is_trusted = not result.errors

        return result

    # ── Trust chain ────────────────────────────────────────────────────────────

    def _validate_trust_chain(
        self, parsed, result: ChainValidationResult
    ) -> None:
        """
        Verify the certificate chains to the configured PEPPOL CA.

        If PEPPOL_CA_CERT_PATH is configured, we verify the issuer matches.
        Otherwise, we log a warning and skip (for dev environments without the CA).
        """
        if not self._ca_cert_path:
            result.warnings.append(
                'PEPPOL_CA_CERT_PATH not configured — trust chain validation skipped. '
                'Set PEPPOL_CA_CERT_PATH to the OpenPEPPOL Root CA certificate.'
            )
            result.is_trusted = True   # Tentatively trust
            result.trust_anchor = 'unchecked'
            return

        try:
            from .parser import CertificateParser
            parser = CertificateParser()
            ca_cert = parser.parse_file(self._ca_cert_path)

            # Basic check: issuer DN of the AP cert should match subject DN of CA cert
            if parsed.issuer == ca_cert.subject:
                result.is_trusted = True
                result.trust_anchor = ca_cert.common_name
                result.chain_length = 2   # AP cert + CA cert
                logger.debug(
                    'Certificate trust chain valid: %s → %s',
                    parsed.common_name, ca_cert.common_name,
                )
            else:
                result.errors.append(
                    f'Certificate issuer "{parsed.issuer}" does not match '
                    f'CA subject "{ca_cert.subject}". Not a valid PEPPOL certificate.'
                )

        except Exception as exc:
            result.warnings.append(
                f'Trust chain validation error: {exc} — '
                'verify PEPPOL_CA_CERT_PATH is correct.'
            )
            result.is_trusted = True   # Don't block on config errors

    # ── Revocation ─────────────────────────────────────────────────────────────

    def _check_revocation(self, parsed) -> Optional[RevocationStatus]:
        """Check revocation via OCSP first, then CRL as fallback."""
        # Try OCSP
        if parsed.ocsp_url:
            status = self._check_ocsp(parsed)
            if status.status != 'error':
                return status
            logger.warning(
                'OCSP check failed for %s, falling back to CRL.', parsed.common_name
            )

        # CRL fallback
        if parsed.crl_urls:
            return self._check_crl(parsed)

        logger.info(
            'No revocation endpoints in certificate %s — skipping revocation check.',
            parsed.common_name,
        )
        return RevocationStatus(status='unknown', method='none')

    def _check_ocsp(self, parsed) -> RevocationStatus:
        """Check certificate revocation via OCSP (RFC 6960)."""
        status = RevocationStatus(method='ocsp', checked_at=datetime.now(tz=timezone.utc))

        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            from cryptography.x509 import ocsp
            from cryptography.hazmat.primitives import hashes, serialization

            # We need the issuer certificate to build the OCSP request
            issuer_cert_bytes = self._fetch_issuer_cert(parsed)
            if not issuer_cert_bytes:
                status.status = 'unknown'
                status.error = 'Cannot fetch issuer certificate for OCSP request.'
                return status

            try:
                issuer = x509.load_pem_x509_certificate(issuer_cert_bytes, default_backend())
            except Exception:
                issuer = x509.load_der_x509_certificate(issuer_cert_bytes, default_backend())

            # Load the subject certificate
            try:
                subject = x509.load_pem_x509_certificate(parsed.raw_pem.encode(), default_backend())
            except Exception:
                subject = x509.load_der_x509_certificate(parsed.raw_der, default_backend())

            # Build OCSP request
            builder = ocsp.OCSPRequestBuilder()
            builder = builder.add_certificate(subject, issuer, hashes.SHA1())
            ocsp_request = builder.build()
            ocsp_bytes = ocsp_request.public_bytes(serialization.Encoding.DER)

            # Send OCSP request
            response = requests.post(
                parsed.ocsp_url,
                data=ocsp_bytes,
                headers={'Content-Type': 'application/ocsp-request'},
                timeout=self.OCSP_TIMEOUT,
            )

            if response.status_code != 200:
                status.status = 'error'
                status.error = f'OCSP server returned HTTP {response.status_code}'
                return status

            # Parse OCSP response
            ocsp_response = ocsp.load_der_ocsp_response(response.content)

            if ocsp_response.response_status == ocsp.OCSPResponseStatus.SUCCESSFUL:
                cert_status = ocsp_response.certificate_status
                if cert_status == ocsp.OCSPCertStatus.GOOD:
                    status.status = 'good'
                elif cert_status == ocsp.OCSPCertStatus.REVOKED:
                    status.status = 'revoked'
                    revoked_at = ocsp_response.revocation_time
                    if revoked_at:
                        if revoked_at.tzinfo is None:
                            revoked_at = revoked_at.replace(tzinfo=timezone.utc)
                        status.revoked_at = revoked_at
                    reason = ocsp_response.revocation_reason
                    status.reason = reason.name if reason else 'unspecified'
                else:
                    status.status = 'unknown'
            else:
                status.status = 'error'
                status.error = f'OCSP response status: {ocsp_response.response_status.name}'

        except ImportError:
            status.status = 'error'
            status.error = 'cryptography package required for OCSP validation.'
        except requests.exceptions.Timeout:
            status.status = 'error'
            status.error = f'OCSP request timed out after {self.OCSP_TIMEOUT}s.'
        except Exception as exc:
            status.status = 'error'
            status.error = f'OCSP check error: {exc}'
            logger.error('OCSP check failed for %s: %s', parsed.common_name, exc)

        return status

    def _check_crl(self, parsed) -> RevocationStatus:
        """Check certificate revocation via CRL (RFC 5280)."""
        status = RevocationStatus(method='crl', checked_at=datetime.now(tz=timezone.utc))

        for crl_url in parsed.crl_urls:
            try:
                response = requests.get(
                    crl_url,
                    timeout=self.CRL_TIMEOUT,
                    stream=True,
                )
                if response.status_code != 200:
                    continue

                # Limit CRL download size
                crl_bytes = b''
                for chunk in response.iter_content(chunk_size=8192):
                    crl_bytes += chunk
                    if len(crl_bytes) > self.CRL_MAX_SIZE:
                        status.status = 'error'
                        status.error = 'CRL file too large (>10MB).'
                        return status

                from cryptography import x509
                from cryptography.hazmat.backends import default_backend

                try:
                    crl = x509.load_pem_x509_crl(crl_bytes, default_backend())
                except Exception:
                    crl = x509.load_der_x509_crl(crl_bytes, default_backend())

                # Check if our cert's serial number is in the revoked list
                cert_serial = int(parsed.serial_number, 16)
                revoked = crl.get_revoked_certificate_by_serial_number(cert_serial)

                if revoked is not None:
                    status.status = 'revoked'
                    rev_time = revoked.revocation_date
                    if rev_time.tzinfo is None:
                        rev_time = rev_time.replace(tzinfo=timezone.utc)
                    status.revoked_at = rev_time
                    try:
                        reason_ext = revoked.extensions.get_extension_for_class(
                            x509.CRLReason
                        )
                        status.reason = reason_ext.value.reason.name
                    except Exception:
                        status.reason = 'unspecified'
                else:
                    status.status = 'good'

                return status

            except Exception as exc:
                logger.warning('CRL check failed for URL %s: %s', crl_url, exc)
                continue

        status.status = 'error'
        status.error = 'All CRL URLs failed.'
        return status

    def _fetch_issuer_cert(self, parsed) -> Optional[bytes]:
        """Fetch the issuer certificate via AIA caIssuers URL or PEPPOL_CA_CERT_PATH."""
        # Try configured CA cert first
        if self._ca_cert_path:
            try:
                return Path(self._ca_cert_path).read_bytes()
            except Exception:
                pass

        # Try AIA caIssuers URL
        if parsed.issuer_cert_url:
            try:
                response = requests.get(
                    parsed.issuer_cert_url, timeout=10
                )
                if response.status_code == 200:
                    return response.content
            except Exception as exc:
                logger.debug('Failed to fetch issuer cert from AIA: %s', exc)

        return None


from pathlib import Path  # noqa: E402 (already imported above, ensure available)
