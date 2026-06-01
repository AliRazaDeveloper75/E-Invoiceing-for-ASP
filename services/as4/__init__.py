"""
PEPPOL AS4 transport package.

Exports the primary interfaces needed by tasks and services:
  AS4Transport         — send invoices via AS4
  AS4TransmissionResult — result dataclass
  MDNHandler           — process inbound MDN receipts
  MDNVerificationResult — MDN result dataclass
"""
from .transport import AS4Transport, AS4TransmissionResult
from .mdn_handler import MDNHandler, MDNVerificationResult
from .envelope import AS4EnvelopeBuilder, build_receipt_signal
from .signing import AS4MessageSigner
from . import constants

__all__ = [
    'AS4Transport',
    'AS4TransmissionResult',
    'MDNHandler',
    'MDNVerificationResult',
    'AS4EnvelopeBuilder',
    'AS4MessageSigner',
    'build_receipt_signal',
    'constants',
]
