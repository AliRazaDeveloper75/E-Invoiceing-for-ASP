"""
PEPPOL Sandbox Configuration.

Manages the switch between PEPPOL test and production environments.
Provides sandbox-specific test participant IDs, endpoints, and configuration.

PEPPOL Testing Infrastructure:
  - Test SML: acc.edelivery.tech.ec.europa.eu
  - Test SMP: TestNet SMP (UAE ASP will provide specific test AP URLs)
  - Test AP: Oxalis or Ringo AP for integration testing
  - Test PKI: OpenPEPPOL Pilot PKI (separate from production)

UAE PEPPOL Testing:
  The UAE e-invoicing programme uses the standard PEPPOL test infrastructure
  (TestNet) for integration testing. The production SML/SMP is used once
  accreditation is complete.

Environment detection:
  - PEPPOL_USE_TEST_SML=True  → sandbox mode (TestNet)
  - PEPPOL_USE_TEST_SML=False → production mode (production SML/SMP)
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Well-known test participant IDs ──────────────────────────────────────────

# OpenPEPPOL test participants used in interoperability testing
PEPPOL_TEST_PARTICIPANTS = {
    'oxalis_sender':   '9915:oxalis',
    'oxalis_receiver': '9915:oxalis',
    'ringo_test':      '0200:RINGO-TEST',
    'uae_test_buyer':  '0235:TEST1234567890001',
    'uae_test_seller': '0235:TEST1234567890002',
}

# ─── Environment config dataclass ─────────────────────────────────────────────

@dataclass
class PEPPOLEnvironmentConfig:
    """Complete PEPPOL environment configuration for one environment (test or prod)."""
    name:             str   = 'production'
    sml_zone:         str   = 'edelivery.tech.ec.europa.eu'
    smp_base_url:     str   = ''
    use_test_pki:     bool  = False
    signing_enabled:  bool  = True
    xsd_validation:   bool  = True
    doc_type_id:      str   = ''
    process_id:       str   = ''
    sender_participant_id: str = ''

    # Test AP endpoints (provided by UAE ASP)
    test_ap_endpoint: str   = ''

    # Sandbox-specific settings
    sandbox_capture_mode: bool = False   # If True: capture messages without sending

    @property
    def is_sandbox(self) -> bool:
        return self.name in ('sandbox', 'test', 'testnet')


# ─── PEPPOLSandboxConfig ──────────────────────────────────────────────────────

class PEPPOLEnvironmentManager:
    """
    Manages PEPPOL environment configuration.

    Reads from Django settings and provides a validated configuration
    for the current environment (test or production).

    Usage:
        mgr = PEPPOLEnvironmentManager()
        config = mgr.get_config()
        if config.is_sandbox:
            logger.info('Running in PEPPOL TestNet mode')
    """

    def __init__(self):
        from django.conf import settings
        self._settings = settings

    def get_config(self) -> PEPPOLEnvironmentConfig:
        """Return the active PEPPOL environment configuration."""
        from services.as4.constants import (
            SML_ZONE_TEST, SML_ZONE_PRODUCTION,
            PEPPOL_DOCTYPE_PINT_AE_INVOICE,
            PEPPOL_PROCESS_BIS30,
        )
        s = self._settings
        use_test = getattr(s, 'PEPPOL_USE_TEST_SML', True)

        return PEPPOLEnvironmentConfig(
            name='testnet' if use_test else 'production',
            sml_zone=SML_ZONE_TEST if use_test else SML_ZONE_PRODUCTION,
            smp_base_url=getattr(s, 'PEPPOL_SMP_BASE_URL', ''),
            use_test_pki=use_test,
            signing_enabled=getattr(s, 'PEPPOL_SIGNING_ENABLED', True),
            xsd_validation=getattr(s, 'PEPPOL_XSD_VALIDATION_ENABLED', True),
            doc_type_id=getattr(s, 'PEPPOL_DOC_TYPE_ID', PEPPOL_DOCTYPE_PINT_AE_INVOICE),
            process_id=getattr(s, 'PEPPOL_PROCESS_ID', PEPPOL_PROCESS_BIS30),
            sender_participant_id=getattr(s, 'PEPPOL_SENDER_PARTICIPANT_ID', ''),
            test_ap_endpoint=getattr(s, 'PEPPOL_TEST_AP_ENDPOINT', ''),
            sandbox_capture_mode=getattr(s, 'PEPPOL_SANDBOX_CAPTURE_MODE', False),
        )

    def get_test_sender_id(self) -> str:
        """Return the configured test sender participant ID."""
        config = self.get_config()
        return config.sender_participant_id or PEPPOL_TEST_PARTICIPANTS['uae_test_seller']

    def validate_participant_id(self, participant_id: str) -> tuple[bool, str]:
        """
        Validate PEPPOL participant ID format.

        Format: scheme:identifier (e.g. '0235:123456789012345')

        UAE PEPPOL (scheme 0235):
          - Identifier = TRN (Tax Registration Number), 15 digits
          - Format enforced by DCTCE spec

        Returns (is_valid, error_message).
        """
        if not participant_id:
            return False, 'Participant ID is required.'

        if ':' not in participant_id:
            return False, (
                f'Invalid participant ID format: "{participant_id}". '
                'Expected: scheme:identifier (e.g. 0235:123456789012345)'
            )

        scheme, identifier = participant_id.split(':', 1)

        if not scheme or not identifier:
            return False, 'Both scheme and identifier are required (scheme:identifier).'

        if not scheme.isdigit():
            return False, f'Scheme "{scheme}" must be numeric (ISO 6523 code).'

        if scheme == '0235':   # UAE scheme
            if not identifier.isdigit():
                return False, f'UAE TRN must be numeric, got: "{identifier}"'
            if len(identifier) != 15:
                return False, (
                    f'UAE TRN must be exactly 15 digits, got {len(identifier)}: "{identifier}"'
                )

        return True, ''


# ─── Sandbox message capture ──────────────────────────────────────────────────

class SandboxMessageCapture:
    """
    In sandbox capture mode, stores AS4 messages to database instead of transmitting.

    Used for:
    - Development testing without a live PEPPOL AP
    - Integration test simulations
    - Load testing

    Set PEPPOL_SANDBOX_CAPTURE_MODE=True in settings to enable.
    """

    def capture_outbound(
        self,
        sender_id: str,
        receiver_id: str,
        invoice_xml: bytes,
        message_id: str,
        invoice=None,
    ) -> dict:
        """
        Store an outbound AS4 message in the database without transmitting.
        Returns a simulated successful transmission result.
        """
        import hashlib
        from apps.integrations.models import PEPPOLMessage
        from services.as4.constants import PEPPOL_DOCTYPE_PINT_AE_INVOICE, PEPPOL_PROCESS_BIS30

        payload_hash = hashlib.sha256(invoice_xml).hexdigest()

        try:
            company = invoice.company if invoice else None
            peppol_msg = PEPPOLMessage.objects.create(
                company=company,
                invoice=invoice,
                direction='outbound',
                message_id=__import__('uuid').uuid4(),
                sender_participant_id=sender_id,
                receiver_participant_id=receiver_id,
                document_type_id=PEPPOL_DOCTYPE_PINT_AE_INVOICE,
                process_id=PEPPOL_PROCESS_BIS30,
                transmission_status='delivered',   # Simulated delivery
                as4_message_id=message_id,
                as4_endpoint_url='sandbox://capture',
                raw_payload_hash=payload_hash,
                payload_size_bytes=len(invoice_xml),
                mdn_status='captured',
            )
            logger.info(
                'SANDBOX: captured outbound message %s (%d bytes) for %s → %s',
                message_id, len(invoice_xml), sender_id, receiver_id,
            )
            return {
                'success':    True,
                'message_id': message_id,
                'receipt_id': f'SANDBOX-RECEIPT-{message_id[:8]}',
                'captured':   True,
                'record_id':  str(peppol_msg.id),
            }
        except Exception as exc:
            logger.error('Sandbox capture failed: %s', exc)
            return {'success': False, 'error': str(exc)}
