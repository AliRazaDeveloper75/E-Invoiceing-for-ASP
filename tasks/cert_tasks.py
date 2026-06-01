"""
Celery Beat tasks for PEPPOL certificate health monitoring.

Tasks:
  check_peppol_certificates()
    — Daily: scans file-based PEPPOL certs via CertificateMonitor (legacy)
    — Also scans CertificateRecord DB records via CertificateManager
    — Updates Prometheus cert expiry gauges
    — Sends email alerts for expiry / revocation issues

  check_db_certificate_records()
    — Hourly: specifically for CertificateRecord model (DB-tracked certs)
    — Runs OCSP validation on certs expiring within 14 days
    — Updates Prometheus gauges

Scheduled at:
  check_peppol_certificates:   daily at 08:00 UAE (04:00 UTC)
  check_db_certificate_records: every hour
"""
import logging

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


# ─── File-based cert check (legacy + DB scan) ─────────────────────────────────

@shared_task(
    name='tasks.cert_tasks.check_peppol_certificates',
    queue='cert_monitoring',
    max_retries=1,
    default_retry_delay=300,
    acks_late=True,
)
def check_peppol_certificates() -> dict:
    """
    Daily certificate health check.

    1. Runs CertificateMonitor (file-based AP cert, CA cert, key)
    2. Runs CertificateManager.check_expiry_alerts() (DB-tracked certs)
    3. Updates Prometheus cert gauges
    4. Sends email alerts on issues

    Returns summary dict.
    """
    from monitoring.prometheus import metrics

    logger.info('Starting PEPPOL certificate health check...')

    summary = {
        'file_certs': _check_file_certs(),
        'db_certs':   _check_db_certs(),
    }

    # Refresh Prometheus cert gauges
    try:
        metrics.refresh_cert_gauges()
    except Exception as exc:
        logger.error('Failed to refresh Prometheus cert gauges: %s', exc)

    logger.info('Certificate check complete: %s', summary)
    return summary


def _check_file_certs() -> dict:
    """Run the legacy file-based CertificateMonitor check."""
    try:
        from services.cert_monitor import CertificateMonitor
        monitor = CertificateMonitor()
        result  = monitor.check()

        for alert in result.critical_alerts:
            logger.critical('PEPPOL CERT CRITICAL: %s', alert)
        for warning in result.warnings:
            logger.warning('PEPPOL CERT WARNING: %s', warning)

        if result.critical_alerts or result.warnings:
            monitor.send_alerts(result)

        return result.to_dict()
    except Exception as exc:
        logger.error('File cert check failed: %s', exc)
        return {'error': str(exc)}


def _check_db_certs() -> dict:
    """Run CertificateManager expiry alerts against DB-tracked certificates."""
    try:
        from services.certificates import CertificateManager
        mgr    = CertificateManager()
        alerts = mgr.check_expiry_alerts()

        expired  = [a for a in alerts if a['is_expired']]
        expiring = [a for a in alerts if not a['is_expired']]

        if expired:
            logger.critical(
                'DB CERT EXPIRED: %d certificate(s) are expired — %s',
                len(expired),
                [a['common_name'] for a in expired],
            )
            _send_db_cert_alerts(expired, 'EXPIRED')

        if expiring:
            logger.warning(
                'DB CERT EXPIRING: %d certificate(s) expire within warning window — %s',
                len(expiring),
                [(a['common_name'], a['days_remaining']) for a in expiring],
            )
            _send_db_cert_alerts(expiring, 'EXPIRING')

        return {
            'total_alerts': len(alerts),
            'expired':      len(expired),
            'expiring_soon': len(expiring),
        }
    except Exception as exc:
        logger.error('DB cert check failed: %s', exc)
        return {'error': str(exc)}


def _send_db_cert_alerts(alerts: list, level: str) -> None:
    """Send email notifications for DB-tracked certificate issues."""
    try:
        from django.conf import settings
        from django.core.mail import send_mail

        recipients = getattr(settings, 'PEPPOL_ALERT_EMAILS', [])
        if not recipients:
            return

        subject = f'[UAE E-Invoicing] CERT {level}: {len(alerts)} certificate(s) affected'
        lines   = [f'Certificate {level.lower()} alert:\n']
        for a in alerts:
            lines.append(
                f'  - {a["common_name"]} ({a["cert_type"]}) for {a["company"]}'
                f' — {a["days_remaining"]} days remaining'
                f' — expires {a["expires_at"]}'
            )

        send_mail(
            subject=subject,
            message='\n'.join(lines),
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@einvoicing.ae'),
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception as exc:
        logger.error('Failed to send cert alert email: %s', exc)


# ─── Hourly DB cert check with OCSP ──────────────────────────────────────────

@shared_task(
    name='tasks.cert_tasks.check_db_certificate_records',
    queue='cert_monitoring',
    acks_late=True,
)
def check_db_certificate_records() -> dict:
    """
    Hourly: validate DB-tracked certificates and refresh Prometheus gauges.

    For certs expiring within 14 days, also runs OCSP validation.
    """
    from monitoring.prometheus import metrics
    from services.certificates import CertificateManager

    mgr   = CertificateManager()
    ocsp_results = []

    try:
        from apps.integrations.models import CertificateRecord
        # Run OCSP on certs expiring within 14 days
        urgent = CertificateRecord.objects.filter(
            is_active=True,
            revoked_at__isnull=True,
        ).select_related('company')

        for cert in urgent:
            if 0 <= cert.days_until_expiry <= 14:
                try:
                    result = mgr.validate_with_ocsp(cert)
                    ocsp_results.append({
                        'cert': cert.common_name,
                        'valid': result.get('valid'),
                        'status': result.get('revocation', {}).get('status') if result.get('revocation') else None,
                    })
                    if result.get('revocation') and result['revocation'].get('status') == 'revoked':
                        logger.critical(
                            'CERT REVOKED: %s (serial=%s)',
                            cert.common_name, cert.serial_number,
                        )
                        mgr.revoke(cert, reason='OCSP reports revoked')
                except Exception as exc:
                    logger.warning('OCSP check failed for %s: %s', cert.common_name, exc)
    except Exception as exc:
        logger.error('check_db_certificate_records failed: %s', exc)

    # Always refresh gauges
    try:
        metrics.refresh_cert_gauges()
        metrics.refresh_queue_gauges()
    except Exception as exc:
        logger.error('Failed to refresh Prometheus gauges: %s', exc)

    return {'ocsp_checked': len(ocsp_results), 'results': ocsp_results}
