"""
PEPPOL Certificate Monitor.

Checks the health of the PEPPOL access point certificates and raises
alerts when they are close to expiry or have expired.

Three certificate types are monitored:
  1. PEPPOL_CERT_PATH       — Your AP's end-entity certificate (issued by OpenPEPPOL CA)
  2. PEPPOL_CA_CERT_PATH    — The OpenPEPPOL issuing CA certificate
  3. PEPPOL_PRIVATE_KEY_PATH — Verified to exist and be readable (key itself not inspected)

Used by:
  tasks/cert_tasks.py  — Celery Beat task runs this daily

Alert channels:
  - Django logger (always)
  - Email via Django's send_mail (if PEPPOL_ALERT_EMAILS is set)
"""
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class CertificateStatus:
    """Status of a single certificate file."""
    path:         str
    label:        str
    exists:       bool  = False
    readable:     bool  = False
    subject:      str   = ''
    issuer:       str   = ''
    not_before:   Optional[datetime] = None
    not_after:    Optional[datetime] = None
    days_remaining: Optional[int]   = None
    is_expired:   bool  = False
    is_warning:   bool  = False   # True if within warning threshold
    errors:       list  = field(default_factory=list)

    @property
    def is_healthy(self) -> bool:
        return self.exists and self.readable and not self.is_expired and not self.errors


@dataclass
class CertMonitorResult:
    """Aggregated result from checking all certificates."""
    all_healthy:    bool          = True
    certificates:   list          = field(default_factory=list)
    critical_alerts: list         = field(default_factory=list)
    warnings:       list          = field(default_factory=list)

    def add_certificate(self, status: CertificateStatus) -> None:
        self.certificates.append(status)
        if not status.is_healthy or status.is_expired:
            self.all_healthy = False
            self.critical_alerts.append(
                f'{status.label}: {"EXPIRED" if status.is_expired else "UNHEALTHY"} — {", ".join(status.errors)}'
            )
        elif status.is_warning:
            self.warnings.append(
                f'{status.label}: expires in {status.days_remaining} day(s) '
                f'({status.not_after.strftime("%Y-%m-%d") if status.not_after else "unknown"})'
            )

    def to_dict(self) -> dict:
        return {
            'all_healthy':    self.all_healthy,
            'critical_alerts': self.critical_alerts,
            'warnings':       self.warnings,
            'certificates': [
                {
                    'label':         c.label,
                    'path':          c.path,
                    'subject':       c.subject,
                    'issuer':        c.issuer,
                    'not_after':     c.not_after.isoformat() if c.not_after else None,
                    'days_remaining': c.days_remaining,
                    'is_expired':    c.is_expired,
                    'is_warning':    c.is_warning,
                    'is_healthy':    c.is_healthy,
                    'errors':        c.errors,
                }
                for c in self.certificates
            ],
        }


# ─── Monitor ──────────────────────────────────────────────────────────────────

class CertificateMonitor:
    """
    Checks PEPPOL certificate health.

    Usage:
        monitor = CertificateMonitor()
        result  = monitor.check()
        if not result.all_healthy:
            for alert in result.critical_alerts:
                logger.critical(alert)
    """

    def __init__(self):
        from django.conf import settings
        self._cert_path     = getattr(settings, 'PEPPOL_CERT_PATH',        '')
        self._key_path      = getattr(settings, 'PEPPOL_PRIVATE_KEY_PATH', '')
        self._ca_cert_path  = getattr(settings, 'PEPPOL_CA_CERT_PATH',     '')
        self._warning_days  = getattr(settings, 'PEPPOL_CERT_EXPIRY_WARNING_DAYS', 30)

    def check(self) -> CertMonitorResult:
        """
        Check all configured certificates and return aggregated result.
        Certificates with empty paths are skipped gracefully.
        """
        result = CertMonitorResult()

        certs_to_check = [
            (self._cert_path,    'PEPPOL AP Certificate'),
            (self._ca_cert_path, 'PEPPOL CA Certificate'),
        ]

        for path, label in certs_to_check:
            if not path:
                logger.debug('%s: path not configured — skipping.', label)
                continue
            status = self._check_certificate(path, label)
            result.add_certificate(status)

        # Private key — only check existence/readability (never load the private key bytes)
        if self._key_path:
            key_status = self._check_key_file(self._key_path, 'PEPPOL Private Key')
            result.add_certificate(key_status)
            if not key_status.is_healthy:
                result.all_healthy = False
                result.critical_alerts.append(
                    f'{key_status.label}: not accessible — {", ".join(key_status.errors)}'
                )

        if not any(c.path for c in result.certificates):
            logger.info(
                'CertificateMonitor: no certificate paths configured '
                '(PEPPOL_CERT_PATH / PEPPOL_CA_CERT_PATH not set).'
            )

        return result

    def _check_certificate(self, path: str, label: str) -> CertificateStatus:
        """Load and inspect a PEM/DER certificate file."""
        status = CertificateStatus(path=path, label=label)
        p = Path(path)

        if not p.exists():
            status.errors.append(f'File not found: {path}')
            return status
        status.exists = True

        try:
            cert_bytes = p.read_bytes()
        except OSError as exc:
            status.errors.append(f'Cannot read file: {exc}')
            return status
        status.readable = True

        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend

            # Try PEM first, then DER
            cert = None
            try:
                cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
            except Exception:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())

            status.subject = cert.subject.rfc4514_string()
            status.issuer  = cert.issuer.rfc4514_string()

            # Use timezone-aware datetimes (cryptography 41+ returns aware datetimes)
            try:
                not_after = cert.not_valid_after_utc
            except AttributeError:
                # cryptography < 42 compatibility
                not_after = cert.not_valid_after.replace(tzinfo=timezone.utc)

            try:
                not_before = cert.not_valid_before_utc
            except AttributeError:
                not_before = cert.not_valid_before.replace(tzinfo=timezone.utc)

            status.not_after  = not_after
            status.not_before = not_before

            now = datetime.now(tz=timezone.utc)
            delta = not_after - now
            status.days_remaining = delta.days

            status.is_expired = delta.days < 0
            status.is_warning = (not status.is_expired) and (delta.days <= self._warning_days)

            if status.is_expired:
                status.errors.append(f'Certificate expired on {not_after.strftime("%Y-%m-%d")}')
                logger.critical('%s: EXPIRED on %s', label, not_after.strftime('%Y-%m-%d'))
            elif status.is_warning:
                logger.warning('%s: expires in %d day(s)', label, delta.days)
            else:
                logger.info('%s: healthy, expires in %d day(s)', label, delta.days)

        except ImportError:
            # cryptography package not installed — basic existence check only
            status.errors.append(
                'cryptography package not installed — install via: pip install cryptography'
            )
            logger.warning('%s: cryptography library missing, cannot inspect cert details.', label)
        except Exception as exc:
            status.errors.append(f'Certificate parse error: {exc}')
            logger.error('%s: failed to parse certificate: %s', label, exc)

        return status

    def _check_key_file(self, path: str, label: str) -> CertificateStatus:
        """Check that the private key file exists and is readable (never loads key material)."""
        status = CertificateStatus(path=path, label=label)
        p = Path(path)

        if not p.exists():
            status.errors.append(f'File not found: {path}')
            return status
        status.exists = True

        if not os.access(path, os.R_OK):
            status.errors.append(f'File not readable (check permissions): {path}')
            return status
        status.readable = True

        logger.info('%s: file exists and is readable.', label)
        return status

    def send_alerts(self, result: CertMonitorResult) -> None:
        """
        Send email alerts for critical issues and warnings.
        Only sends if PEPPOL_ALERT_EMAILS is configured.
        """
        from django.conf import settings
        from django.core.mail import send_mail

        alert_emails = getattr(settings, 'PEPPOL_ALERT_EMAILS', [])
        if not alert_emails:
            return

        subject_lines = []
        body_lines = []

        if result.critical_alerts:
            subject_lines.append('CRITICAL: PEPPOL Certificate Issues Detected')
            body_lines.append('=== CRITICAL ALERTS ===')
            body_lines.extend(result.critical_alerts)
            body_lines.append('')

        if result.warnings:
            if not subject_lines:
                subject_lines.append('WARNING: PEPPOL Certificate Expiry Warning')
            body_lines.append('=== WARNINGS ===')
            body_lines.extend(result.warnings)

        if not body_lines:
            return

        subject = subject_lines[0]
        body = (
            'PEPPOL Certificate Monitor — Daily Check\n'
            f'Checked at: {datetime.now(tz=timezone.utc).isoformat()}\n\n'
            + '\n'.join(body_lines)
            + '\n\nPlease renew certificates before expiry to avoid PEPPOL network disruption.'
        )

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@e-numerak.com'),
                recipient_list=alert_emails,
                fail_silently=False,
            )
            logger.info('Certificate alert email sent to: %s', ', '.join(alert_emails))
        except Exception as exc:
            logger.error('Failed to send certificate alert email: %s', exc)
