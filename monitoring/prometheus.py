"""
Prometheus metrics for the UAE E-Invoicing Platform.

Exposes key operational metrics consumable by Prometheus scraper at /metrics/.
Designed for Grafana dashboards and PagerDuty alerting.

Metric families:
  Invoice lifecycle:
    einvoicing_invoices_created_total       — counter by company, type
    einvoicing_invoices_submitted_total     — counter by company, status
    einvoicing_invoice_processing_seconds   — histogram: end-to-end pipeline time
    einvoicing_invoice_xml_size_bytes       — histogram: generated XML size

  PEPPOL / AS4 transmission:
    einvoicing_peppol_transmissions_total   — counter by status (sent/failed/mdn_received)
    einvoicing_peppol_transmission_seconds  — histogram: AS4 round-trip time
    einvoicing_peppol_mdn_received_total    — counter by ap_signed (true/false)
    einvoicing_smp_lookups_total            — counter by result (hit/miss/error)

  FTA reporting (Corner 5):
    einvoicing_fta_reports_total            — counter by status
    einvoicing_fta_report_seconds           — histogram: FTA submission time
    einvoicing_fta_polling_attempts_total   — counter: async polls performed

  Certificate monitoring:
    einvoicing_cert_days_until_expiry       — gauge by common_name, cert_type
    einvoicing_cert_expired_total           — gauge: count of currently expired certs

  Queue depths (Celery):
    einvoicing_queue_depth                  — gauge by queue_name

  HTTP API:
    einvoicing_http_requests_total          — counter by method, endpoint, status
    einvoicing_http_request_seconds         — histogram by method, endpoint

Usage:
    # In Django views or services:
    from monitoring.prometheus import metrics
    metrics.invoices_submitted.labels(company='ACME', status='accepted').inc()

    # In settings:
    PROMETHEUS_METRICS_TOKEN = 'secret'  # Required to scrape /metrics/
"""
import logging
import time

logger = logging.getLogger(__name__)

# ─── Prometheus client setup ──────────────────────────────────────────────────

try:
    from prometheus_client import (
        Counter, Histogram, Gauge, Summary,
        CollectorRegistry, REGISTRY,
    )
    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False
    logger.warning(
        'prometheus_client not installed — metrics disabled. '
        'Add prometheus-client to requirements/production.txt'
    )


# ─── Null metric stubs (when prometheus_client unavailable) ───────────────────

class _NullMetric:
    """Silent no-op for all metric operations — used when prometheus_client missing."""
    def labels(self, **kwargs):
        return self
    def inc(self, amount=1): pass
    def dec(self, amount=1): pass
    def set(self, value):    pass
    def observe(self, value): pass
    def time(self):          return _NullTimer()


class _NullTimer:
    def __enter__(self): return self
    def __exit__(self, *args): pass


def _counter(name, documentation, labelnames=()) -> object:
    if _PROMETHEUS_AVAILABLE:
        return Counter(name, documentation, labelnames)
    return _NullMetric()


def _histogram(name, documentation, labelnames=(), buckets=None) -> object:
    if _PROMETHEUS_AVAILABLE:
        kwargs = {'labelnames': labelnames}
        if buckets:
            kwargs['buckets'] = buckets
        return Histogram(name, documentation, **kwargs)
    return _NullMetric()


def _gauge(name, documentation, labelnames=()) -> object:
    if _PROMETHEUS_AVAILABLE:
        return Gauge(name, documentation, labelnames)
    return _NullMetric()


# ─── Metric definitions ───────────────────────────────────────────────────────

class EInvoicingMetrics:
    """
    Central registry of all platform metrics.

    Instantiated once as a module-level singleton (metrics).
    Import and use: from monitoring.prometheus import metrics
    """

    def __init__(self):
        # ── Invoice lifecycle ──────────────────────────────────────────────────
        self.invoices_created = _counter(
            'einvoicing_invoices_created_total',
            'Total invoices created on the platform.',
            ['invoice_type'],
        )
        self.invoices_submitted = _counter(
            'einvoicing_invoices_submitted_total',
            'Total invoices submitted to the PEPPOL network.',
            ['status'],
        )
        self.invoice_processing_time = _histogram(
            'einvoicing_invoice_processing_seconds',
            'End-to-end invoice processing pipeline duration.',
            [],
            buckets=[0.5, 1, 2, 5, 10, 30, 60, 120],
        )
        self.invoice_xml_size = _histogram(
            'einvoicing_invoice_xml_size_bytes',
            'Size of generated UBL invoice XML.',
            [],
            buckets=[1024, 4096, 16384, 65536, 262144, 1048576],
        )

        # ── PEPPOL / AS4 ───────────────────────────────────────────────────────
        self.peppol_transmissions = _counter(
            'einvoicing_peppol_transmissions_total',
            'Total PEPPOL AS4 transmission attempts.',
            ['status'],
        )
        self.peppol_transmission_time = _histogram(
            'einvoicing_peppol_transmission_seconds',
            'AS4 transmission round-trip duration.',
            [],
            buckets=[0.5, 1, 2, 5, 10, 30, 60],
        )
        self.peppol_mdn_received = _counter(
            'einvoicing_peppol_mdn_received_total',
            'Total MDN receipts received from remote AP.',
            ['ap_signed'],
        )
        self.smp_lookups = _counter(
            'einvoicing_smp_lookups_total',
            'SMP endpoint discovery lookups.',
            ['result'],
        )

        # ── FTA Corner 5 ───────────────────────────────────────────────────────
        self.fta_reports = _counter(
            'einvoicing_fta_reports_total',
            'Total FTA data platform report submissions.',
            ['status'],
        )
        self.fta_report_time = _histogram(
            'einvoicing_fta_report_seconds',
            'FTA submission round-trip duration.',
            [],
            buckets=[1, 5, 10, 30, 60, 120, 300],
        )
        self.fta_polling_attempts = _counter(
            'einvoicing_fta_polling_attempts_total',
            'Total async FTA polling requests made.',
            [],
        )

        # ── Certificate monitoring ─────────────────────────────────────────────
        self.cert_days_until_expiry = _gauge(
            'einvoicing_cert_days_until_expiry',
            'Days until certificate expiry (negative = already expired).',
            ['common_name', 'cert_type'],
        )
        self.cert_expired_count = _gauge(
            'einvoicing_cert_expired_total',
            'Number of currently expired certificates.',
            [],
        )

        # ── Celery queue depths ────────────────────────────────────────────────
        self.queue_depth = _gauge(
            'einvoicing_queue_depth',
            'Celery queue depth (approximate).',
            ['queue_name'],
        )

        # ── HTTP API ───────────────────────────────────────────────────────────
        self.http_requests = _counter(
            'einvoicing_http_requests_total',
            'Total HTTP API requests processed.',
            ['method', 'endpoint', 'status_code'],
        )
        self.http_request_time = _histogram(
            'einvoicing_http_request_seconds',
            'HTTP API request processing duration.',
            ['method', 'endpoint'],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
        )

    # ── Convenience helpers ────────────────────────────────────────────────────

    def record_peppol_transmission(self, success: bool, duration_ms: int) -> None:
        status = 'success' if success else 'failure'
        self.peppol_transmissions.labels(status=status).inc()
        self.peppol_transmission_time.observe(duration_ms / 1000.0)

    def record_fta_report(self, status: str, duration_ms: int) -> None:
        self.fta_reports.labels(status=status).inc()
        self.fta_report_time.observe(duration_ms / 1000.0)

    def record_invoice_submitted(self, status: str) -> None:
        self.invoices_submitted.labels(status=status).inc()

    def refresh_cert_gauges(self) -> None:
        """
        Update certificate expiry gauges from the database.
        Called by cert_tasks.py on each scheduled run.
        """
        try:
            from apps.integrations.models import CertificateRecord
            active_certs = CertificateRecord.objects.filter(
                is_active=True, revoked_at__isnull=True
            ).select_related('company')

            expired_count = 0
            for cert in active_certs:
                days = cert.days_until_expiry
                self.cert_days_until_expiry.labels(
                    common_name=cert.common_name,
                    cert_type=cert.cert_type,
                ).set(days)
                if days < 0:
                    expired_count += 1

            self.cert_expired_count.set(expired_count)
        except Exception as exc:
            logger.error('Failed to refresh cert gauges: %s', exc)

    def refresh_queue_gauges(self) -> None:
        """
        Sample Celery queue depths from Redis and update gauges.
        Called periodically by a Beat task.
        """
        try:
            import redis as _redis
            from django.conf import settings
            r = _redis.from_url(getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0'))
            for queue in ('invoice_processing', 'peppol_transmission', 'fta_reporting', 'cert_monitoring'):
                depth = r.llen(queue)
                self.queue_depth.labels(queue_name=queue).set(depth)
        except Exception as exc:
            logger.error('Failed to refresh queue depth gauges: %s', exc)


# ─── Singleton ────────────────────────────────────────────────────────────────

metrics = EInvoicingMetrics()
