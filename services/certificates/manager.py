"""
Certificate Lifecycle Manager.

Manages PEPPOL AP certificates stored in the CertificateRecord model:
  - Import certificates from file upload or file path
  - Parse and validate on import
  - Track expiry with automatic DB updates
  - Integrate with OCSP validation on demand
  - Coordinate key rotation warnings

Used by:
  - Admin panel certificate upload API
  - tasks/cert_tasks.py (daily monitoring)
  - AS4 transport (retrieves active signing cert)
"""
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class CertificateManager:
    """
    High-level certificate lifecycle operations.

    All operations are idempotent — re-importing the same certificate
    (same serial number) updates the existing record rather than creating duplicate.
    """

    def import_from_file(
        self,
        cert_path: str,
        cert_type: str = 'peppol_signing',
        key_storage: str = 'filesystem',
        key_reference: str = '',
        company=None,
    ):
        """
        Import a certificate from a file path into the CertificateRecord model.

        Args:
            cert_path:     Path to the PEM/DER certificate file
            cert_type:     One of: peppol_signing, fta_auth, tls_client
            key_storage:   One of: filesystem, kms, hsm, vault
            key_reference: For filesystem: private key path. For KMS: ARN. Etc.
            company:       Company instance (None = platform-level cert)

        Returns:
            CertificateRecord instance
        """
        from .parser import CertificateParser
        from apps.integrations.models import CertificateRecord

        parser = CertificateParser()
        parsed = parser.parse_file(cert_path)

        return self._upsert_record(
            parsed=parsed,
            cert_type=cert_type,
            cert_path=cert_path,
            key_storage=key_storage,
            key_reference=key_reference,
            company=company,
        )

    def import_from_bytes(
        self,
        cert_bytes: bytes,
        cert_type: str = 'peppol_signing',
        key_storage: str = 'filesystem',
        key_reference: str = '',
        cert_path: str = '',
        company=None,
    ):
        """Import a certificate from raw PEM/DER bytes."""
        from .parser import CertificateParser
        from apps.integrations.models import CertificateRecord

        parser = CertificateParser()
        parsed = parser.parse_bytes(cert_bytes)

        return self._upsert_record(
            parsed=parsed,
            cert_type=cert_type,
            cert_path=cert_path,
            key_storage=key_storage,
            key_reference=key_reference,
            company=company,
        )

    def get_active_signing_cert(self, company=None):
        """
        Retrieve the active PEPPOL signing certificate for a company
        (or the platform-level cert if company is None).

        Returns CertificateRecord or None.
        """
        from apps.integrations.models import CertificateRecord
        from django.utils import timezone as dj_tz

        return (
            CertificateRecord.objects
            .filter(
                cert_type=CertificateRecord.CERT_TYPE_PEPPOL_SIGNING,
                is_active=True,
                expires_at__gt=dj_tz.now(),
                revoked_at__isnull=True,
                company=company,
            )
            .order_by('-expires_at')
            .first()
        )

    def revoke(self, certificate_record, reason: str = '') -> None:
        """Mark a certificate as revoked in the database."""
        from django.utils import timezone as dj_tz
        certificate_record.revoked_at = dj_tz.now()
        certificate_record.revocation_reason = reason
        certificate_record.is_active = False
        certificate_record.save(update_fields=[
            'revoked_at', 'revocation_reason', 'is_active', 'updated_at'
        ])
        logger.warning(
            'Certificate revoked: serial=%s reason=%s',
            certificate_record.serial_number, reason,
        )

    def check_expiry_alerts(self, warning_days: Optional[int] = None) -> list[dict]:
        """
        Scan all active CertificateRecords for upcoming expiry.
        Returns list of alert dicts for certificates within the warning window.
        """
        from apps.integrations.models import CertificateRecord
        from django.conf import settings
        from django.utils import timezone as dj_tz

        if warning_days is None:
            warning_days = getattr(settings, 'PEPPOL_CERT_EXPIRY_WARNING_DAYS', 30)

        threshold = dj_tz.now() + timedelta(days=warning_days)

        expiring = CertificateRecord.objects.filter(
            is_active=True,
            revoked_at__isnull=True,
            expires_at__lte=threshold,
        ).select_related('company')

        alerts = []
        for cert in expiring:
            days = cert.days_until_expiry
            company_name = cert.company.name if cert.company else 'Platform'
            alerts.append({
                'cert_id':      str(cert.id),
                'common_name':  cert.common_name,
                'cert_type':    cert.cert_type,
                'company':      company_name,
                'serial':       cert.serial_number,
                'expires_at':   cert.expires_at.isoformat(),
                'days_remaining': days,
                'is_expired':   days < 0,
            })
            level = 'EXPIRED' if days < 0 else 'WARNING'
            logger.log(
                50 if days < 0 else 30,   # CRITICAL=50, WARNING=30
                'CERT %s: %s (serial=%s) for %s — %s in %d days',
                level, cert.common_name, cert.serial_number, company_name, level, days,
            )

        return alerts

    def validate_with_ocsp(self, certificate_record) -> dict:
        """
        Run OCSP + trust chain validation on a stored certificate record.
        Returns validation result dict.
        """
        from .validator import CertificateValidator
        from .parser import CertificateParser

        try:
            cert_bytes = Path(certificate_record.cert_path).read_bytes()
        except Exception as exc:
            return {'valid': False, 'error': f'Cannot read cert file: {exc}'}

        validator = CertificateValidator()
        result = validator.validate(cert_bytes)

        return {
            'valid':         result.is_valid,
            'is_trusted':    result.is_trusted,
            'trust_anchor':  result.trust_anchor,
            'errors':        result.errors,
            'warnings':      result.warnings,
            'revocation': {
                'method':     result.revocation.method if result.revocation else None,
                'status':     result.revocation.status if result.revocation else None,
                'revoked_at': result.revocation.revoked_at.isoformat() if result.revocation and result.revocation.revoked_at else None,
            } if result.revocation else None,
        }

    # ── Private ────────────────────────────────────────────────────────────────

    def _upsert_record(
        self, parsed, cert_type, cert_path, key_storage, key_reference, company
    ):
        """Create or update a CertificateRecord from a ParsedCertificate."""
        from apps.integrations.models import CertificateRecord

        defaults = {
            'cert_type':            cert_type,
            'common_name':          parsed.common_name,
            'issued_by':            parsed.issuer,
            'issued_at':            parsed.not_before,
            'expires_at':           parsed.not_after,
            'fingerprint_sha256':   parsed.fingerprint_sha256,
            'key_storage':          key_storage,
            'key_reference':        key_reference,
            'cert_path':            cert_path,
            'is_active':            True,
            'company':              company,
        }

        record, created = CertificateRecord.objects.update_or_create(
            serial_number=parsed.serial_number,
            defaults=defaults,
        )

        action = 'Imported' if created else 'Updated'
        logger.info(
            '%s CertificateRecord: serial=%s CN=%s expires=%s',
            action,
            parsed.serial_number,
            parsed.common_name,
            parsed.not_after.strftime('%Y-%m-%d') if parsed.not_after else 'unknown',
        )

        return record
