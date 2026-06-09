"""
PEPPOL SMP/SML Client — Corner 3 endpoint discovery.

PEPPOL's 5-corner model requires dynamic routing:
  Corner 1 (Sender)  → Corner 2 (Sender's AP / our system)
  Corner 3 (Receiver's AP) ← discovered via SMP/SML
  Corner 4 (Receiver)

Discovery flow (per PEPPOL Spec):
  1. Hash the receiver's PEPPOL participant ID (ISO 6523 scheme + identifier)
  2. Perform an SML DNS lookup → returns the SMP hostname
  3. HTTP GET to SMP → returns the AS4 endpoint URL for 'invoice' document type

Caching:
  SMP results are cached in the database (SMPEndpointCache model) for
  PEPPOL_SMP_CACHE_TTL_HOURS hours (default 24h) to avoid repeated DNS/HTTP calls.

References:
  PEPPOL SMP 2.0 specification
  PEPPOL BDXL (Business Document Exchange Locator)
  https://docs.peppol.eu/edelivery/smp/

UAE note:
  The UAE PEPPOL network uses the OpenPEPPOL production SML.
  In testing, use the PEPPOL test SML (acc.edelivery.tech.ec.europa.eu).
"""
import hashlib
import logging
import socket
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# PEPPOL production SML zone
SML_ZONE_PRODUCTION = 'edelivery.tech.ec.europa.eu'
# PEPPOL test/acceptance SML zone
SML_ZONE_TEST       = 'acc.edelivery.tech.ec.europa.eu'

# Document type identifier for UAE PINT-AE Billing Invoice.
# This is what the "Confirm ID" SMP lookup must query in the UAE network —
# NOT the generic EU BIS 3.0 doctype.
PEPPOL_INVOICE_DOCTYPE = (
    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    '::Invoice'
    '##urn:peppol:pint:billing-1@ae-1'
    '::2.1'
)

# Process identifier for PEPPOL BIS Billing 3.0
PEPPOL_INVOICE_PROCESS = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'

# UAE PEPPOL scheme: 0235 (UAE VAT number / TIN)
UAE_PEPPOL_SCHEME = '0235'

# Default cache TTL in hours
DEFAULT_CACHE_TTL_HOURS = 24


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class SMPEndpoint:
    """
    Resolved PEPPOL endpoint for a participant.

    transport_url:   AS4 endpoint URL to send the invoice to
    transport_profile: PEPPOL transport profile (should be 'peppol-transport-as4-v2_0')
    certificate_uid: Certificate UID of the receiving AP (for trust validation)
    participant_id:  The full PEPPOL participant ID (scheme:identifier)
    from_cache:      True if this result came from the local database cache
    """
    transport_url:      str
    transport_profile:  str = 'peppol-transport-as4-v2_0'
    certificate_uid:    str = ''
    participant_id:     str = ''
    from_cache:         bool = False


# ─── SMP Client ───────────────────────────────────────────────────────────────

class SMPClient:
    """
    Looks up a PEPPOL receiver's AS4 endpoint via SML DNS + SMP HTTP.

    Usage:
        client   = SMPClient()
        endpoint = client.lookup_invoice_endpoint(invoice)
        if endpoint:
            # use endpoint.transport_url for AS4 delivery
    """

    def __init__(self):
        from django.conf import settings
        self._smp_base_url  = getattr(settings, 'PEPPOL_SMP_BASE_URL',        '')
        self._use_test_sml  = getattr(settings, 'PEPPOL_USE_TEST_SML',        True)
        self._cache_ttl     = getattr(settings, 'PEPPOL_SMP_CACHE_TTL_HOURS', DEFAULT_CACHE_TTL_HOURS)
        # Explicit override wins (e.g. a Testbed SMK zone); else test/prod default.
        self._sml_zone      = (getattr(settings, 'PEPPOL_SML_ZONE', '') or
                               (SML_ZONE_TEST if self._use_test_sml else SML_ZONE_PRODUCTION))

    # ── Public API ────────────────────────────────────────────────────────────

    def lookup_invoice_endpoint(self, invoice) -> Optional[SMPEndpoint]:
        """
        Resolve the AS4 endpoint for the invoice's recipient (customer).

        Returns None if the recipient is not registered on the PEPPOL network
        or if SMP lookup is not configured.
        """
        participant_id = self._build_participant_id(invoice.customer)
        if not participant_id:
            logger.debug(
                'SMP: no PEPPOL endpoint or TRN for customer "%s" — skipping SMP lookup.',
                invoice.customer.name
            )
            return None

        return self.lookup(participant_id, PEPPOL_INVOICE_DOCTYPE)

    def lookup(
        self,
        participant_id: str,
        document_type_id: str = PEPPOL_INVOICE_DOCTYPE,
    ) -> Optional[SMPEndpoint]:
        """
        Full SMP lookup for a participant + document type combination.

        Steps:
          1. Check local cache
          2. SML DNS lookup → SMP hostname
          3. SMP HTTP GET → endpoint URL
          4. Cache the result
          5. Return SMPEndpoint

        Args:
            participant_id:   e.g. '0235:123456789012345'
            document_type_id: PEPPOL document type identifier

        Returns:
            SMPEndpoint or None if participant not found / not registered
        """
        # 1. Cache check
        cached = self._get_cached(participant_id, document_type_id)
        if cached:
            logger.debug('SMP cache hit: %s', participant_id)
            return cached

        # 2. SML DNS lookup
        smp_hostname = self._sml_dns_lookup(participant_id)
        if not smp_hostname:
            logger.info('SMP: participant not found in SML: %s', participant_id)
            return None

        # 3. SMP HTTP lookup
        endpoint = self._smp_http_lookup(smp_hostname, participant_id, document_type_id)
        if not endpoint:
            return None

        endpoint.participant_id = participant_id

        # 4. Cache result
        self._cache_endpoint(participant_id, document_type_id, endpoint)

        return endpoint

    def is_registered(self, participant_id: str) -> bool:
        """Check whether a PEPPOL participant is registered (DNS existence check only)."""
        return self._sml_dns_lookup(participant_id) is not None

    # ── SML DNS lookup ────────────────────────────────────────────────────────

    def _sml_dns_lookup(self, participant_id: str) -> Optional[str]:
        """
        Resolve the SMP base URL for a participant via PEPPOL BDXL (NAPTR).

        Algorithm (PEPPOL Policy for use of Identifiers / BDXL):
          1. host = base32( SHA-256( lowercase(participant value) ) )  [no padding]
             e.g. SHA-256('9922:optbcntrlp1001')
          2. dns_name = '{host}.iso6523-actorid-upis.{sml_zone}'
          3. Query NAPTR; the "U" record's regexp '!.*!<SMP-URL>!' yields the SMP URL.

        Returns the SMP base URL (e.g. 'https://smp-test.peppol.org') or None.
        """
        try:
            import base64
            import dns.resolver

            value = participant_id.lower()                      # '9922:optbcntrlp1001'
            digest = hashlib.sha256(value.encode('utf-8')).digest()
            host = base64.b32encode(digest).decode('ascii').rstrip('=').lower()
            dns_name = f'{host}.iso6523-actorid-upis.{self._sml_zone}'

            logger.debug('BDXL NAPTR lookup: %s', dns_name)
            answers = dns.resolver.resolve(dns_name, 'NAPTR')
            for rec in answers:
                regexp = rec.regexp.decode('utf-8', 'ignore') if isinstance(rec.regexp, bytes) else str(rec.regexp)
                # regexp form: '!.*!https://smp-test.peppol.org!'
                if regexp.startswith('!'):
                    parts = regexp.split('!')
                    if len(parts) >= 3 and parts[2].startswith('http'):
                        smp_url = parts[2]
                        logger.info('SML resolved %s -> %s', participant_id, smp_url)
                        return smp_url
            logger.info('SML: NAPTR found but no SMP URL for %s', participant_id)
        except Exception as exc:
            logger.info('SML BDXL lookup failed for %s: %s', participant_id, exc)

        return None

    def _resolve_cname(self, dns_name: str) -> str:
        """
        Resolve a CNAME record to its target hostname.
        Uses dnspython if available; falls back to socket-based derivation.
        """
        try:
            import dns.resolver
            answers = dns.resolver.resolve(dns_name, 'CNAME')
            return str(answers[0].target).rstrip('.')
        except ImportError:
            # dnspython not installed — derive SMP hostname from DNS name pattern
            # For PEPPOL production: B-{hash}.iso6523-actorid-upis.edelivery.tech.ec.europa.eu
            # The SMP URL is constructed differently per ASP — use configured base if available
            if self._smp_base_url:
                return self._smp_base_url
            # Generic fallback: strip the B-{hash} prefix to get the SMP zone
            parts = dns_name.split('.', 2)
            return parts[2] if len(parts) == 3 else dns_name
        except Exception as exc:
            logger.debug('CNAME resolution failed for %s: %s', dns_name, exc)
            return self._smp_base_url or dns_name

    # ── SMP HTTP lookup ───────────────────────────────────────────────────────

    def _smp_http_lookup(
        self,
        smp_hostname: str,
        participant_id: str,
        document_type_id: str,
    ) -> Optional[SMPEndpoint]:
        """
        HTTP GET to the SMP to retrieve the AS4 endpoint for the given participant
        and document type.

        PEPPOL SMP REST URL pattern:
          http://{smp_host}/{participant_scheme}::{participant_id}/services/{doc_type_encoded}

        Returns SMPEndpoint or None on failure.
        """
        try:
            import requests
        except ImportError:
            logger.error('SMP HTTP lookup requires the requests library.')
            return None

        # smp_hostname is now the SMP base URL from the NAPTR record
        # (e.g. 'https://smp-test.peppol.org'). The participant is addressed with
        # its full identifier 'iso6523-actorid-upis::<value>', URL-encoded.
        base = smp_hostname.rstrip('/')
        if not base.startswith('http'):
            base = f'https://{base}'
        part_encoded = quote(f'iso6523-actorid-upis::{participant_id}', safe='')
        doc_encoded  = quote(document_type_id, safe='')

        url = f'{base}/{part_encoded}/services/{doc_encoded}'

        logger.debug('SMP HTTP GET: %s', url)

        try:
            response = requests.get(url, timeout=10, headers={'Accept': 'application/xml'})

            if response.status_code == 404:
                logger.info('SMP: participant %s not registered for doc type.', participant_id)
                return None

            response.raise_for_status()
            return self._parse_smp_response(response.content)

        except Exception as exc:
            logger.warning('SMP HTTP lookup failed for %s: %s', participant_id, exc)
            return None

    def _parse_smp_response(self, xml_bytes: bytes) -> Optional[SMPEndpoint]:
        """
        Parse the SMP ServiceMetadata XML response to extract the AS4 endpoint URL.

        PEPPOL SMP response is XML with structure:
          <ServiceMetadata>
            <ServiceInformation>
              <ProcessList>
                <Process>
                  <ServiceEndpointList>
                    <Endpoint transportProfile="peppol-transport-as4-v2_0">
                      <EndpointURI>https://...</EndpointURI>
                      <Certificate>...</Certificate>
                    </Endpoint>
        """
        from lxml import etree

        def _ln(el) -> str:
            try:
                return etree.QName(el).localname
            except Exception:
                return ''

        try:
            doc = etree.fromstring(xml_bytes)

            # Namespace-agnostic: works for busdox SMP 1.0 and OASIS BDXR SMP 2.0.
            for ep in doc.iter():
                if _ln(ep) != 'Endpoint':
                    continue
                profile = (ep.get('transportProfile') or '')
                if 'as4' not in profile.lower():
                    continue

                transport_url = ''
                cert_b64 = ''
                for ch in ep.iter():
                    ln = _ln(ch)
                    txt = (ch.text or '').strip()
                    if not txt:
                        continue
                    if ln in ('EndpointURI', 'EndpointReference', 'Address') and not transport_url:
                        transport_url = txt
                    elif ln == 'Certificate' and not cert_b64:
                        cert_b64 = ''.join(txt.split())

                if transport_url:
                    logger.info('SMP: resolved AS4 endpoint: %s', transport_url)
                    return SMPEndpoint(
                        transport_url=transport_url,
                        transport_profile=profile,
                        certificate_uid=cert_b64,
                    )

            logger.warning('SMP response contained no AS4 endpoint.')
            return None

        except Exception as exc:
            logger.error('SMP response parse error: %s', exc)
            return None

    # ── Cache layer ───────────────────────────────────────────────────────────

    def _get_cached(
        self, participant_id: str, document_type_id: str
    ) -> Optional[SMPEndpoint]:
        """Return a cached SMPEndpoint if still valid, else None."""
        try:
            from apps.integrations.models import SMPEndpointCache
            from django.utils import timezone
            from datetime import timedelta

            cutoff = timezone.now() - timedelta(hours=self._cache_ttl)
            record = SMPEndpointCache.objects.filter(
                participant_id=participant_id,
                document_type_id=document_type_id,
                updated_at__gte=cutoff,
            ).first()

            if record:
                return SMPEndpoint(
                    transport_url=record.transport_url,
                    transport_profile=record.transport_profile,
                    certificate_uid=record.certificate_uid,
                    participant_id=participant_id,
                    from_cache=True,
                )
        except Exception as exc:
            logger.debug('SMP cache read error: %s', exc)

        return None

    def _cache_endpoint(
        self,
        participant_id: str,
        document_type_id: str,
        endpoint: SMPEndpoint,
    ) -> None:
        """Upsert an SMPEndpointCache record."""
        try:
            from apps.integrations.models import SMPEndpointCache
            SMPEndpointCache.objects.update_or_create(
                participant_id=participant_id,
                document_type_id=document_type_id,
                defaults={
                    'transport_url':     endpoint.transport_url,
                    'transport_profile': endpoint.transport_profile,
                    'certificate_uid':   endpoint.certificate_uid,
                },
            )
            logger.debug('SMP cache updated for: %s', participant_id)
        except Exception as exc:
            logger.warning('SMP cache write error (non-fatal): %s', exc)

    # ── Participant ID builder ─────────────────────────────────────────────────

    def _build_participant_id(self, customer) -> Optional[str]:
        """
        Build the PEPPOL participant ID for a customer.

        Priority:
          1. customer.peppol_endpoint (already in '0088:...' GLN form)
          2. customer.trn with UAE scheme 0235
          3. customer.vat_number with UAE scheme 0235
        """
        if customer.peppol_endpoint:
            # If stored as a bare number, prefix with the UAE scheme
            ep = customer.peppol_endpoint.strip()
            if ':' not in ep:
                return f'{UAE_PEPPOL_SCHEME}:{ep}'
            return ep

        trn = getattr(customer, 'trn', '') or ''
        if trn and len(trn) >= 10:
            # TIN is first 10 digits of the 15-digit TRN
            return f'{UAE_PEPPOL_SCHEME}:{trn[:10]}'

        vat = getattr(customer, 'vat_number', '') or ''
        if vat:
            return f'{UAE_PEPPOL_SCHEME}:{vat}'

        return None
