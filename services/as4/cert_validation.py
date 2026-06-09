"""
PEPPOL recipient-certificate trust validation (Corner 3 outbound gate).

Before an Access Point encrypts and transmits a business document, the PEPPOL
network rules require it to verify that the *recipient* AP certificate it learned
from the SMP is genuinely trustworthy:

  1. it chains to an OpenPEPPOL PKI trust anchor (Root CA → AP CA),
  2. every certificate in the path is within its validity window, and
  3. the leaf certificate has not been **revoked** (CRL / OCSP).

If any of those fail the message MUST NOT be sent. This is exactly what the
eDelivery Testbed TC2A.4 ("Invalid certificate handling") exercises: one of the
prepared recipients resolves to an SMP endpoint certificate that has been
revoked in the PEPPOL test CA's CRL — our AP is expected to detect it and refuse
to transact that document while still sending the valid ones.

Trust anchors live as PEM files under ``certs/peppol_pki/`` and are configurable
via ``PEPPOL_TRUST_ANCHORS`` (list of PEM paths). CRLs are fetched live from each
certificate's CRL Distribution Point and verified against their issuer before
the revocation list is consulted; results are cached briefly in-process.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import padding, rsa, ec
from cryptography.x509.oid import ExtensionOID

logger = logging.getLogger(__name__)

# Default trust anchors shipped with the repo (OpenPEPPOL test PKI G3), stored
# beside this module so they deploy with the code. Production anchors can be
# added here or supplied via the PEPPOL_TRUST_ANCHORS setting.
_DEFAULT_ANCHOR_DIR = os.path.join(os.path.dirname(__file__), 'trust_anchors')
_DEFAULT_ANCHORS = ('peppol-test-root-g3.pem', 'peppol-test-ap-g3.pem')

# In-process CRL cache: url -> (expires_epoch, x509.CertificateRevocationList)
_CRL_CACHE: dict[str, tuple[float, x509.CertificateRevocationList]] = {}
_CRL_TTL_SECONDS = 3600


@dataclass
class CertValidationResult:
    """Outcome of validating a recipient certificate."""
    valid: bool
    reason: str = ''                       # human-readable failure reason (empty if valid)
    revoked: bool = False
    subject: str = ''
    issuer: str = ''
    chain_ok: bool = False
    crl_checked: bool = False
    warnings: list = field(default_factory=list)

    def __bool__(self) -> bool:            # allow `if result:`
        return self.valid


# ─── Trust anchor loading ──────────────────────────────────────────────────────

def _anchor_paths() -> list:
    """Resolve the configured trust-anchor PEM paths (defaults to bundled test PKI)."""
    paths = []
    try:
        from django.conf import settings
        configured = getattr(settings, 'PEPPOL_TRUST_ANCHORS', None)
        base = getattr(settings, 'BASE_DIR', '')
    except Exception:
        configured, base = None, ''

    if configured:
        for p in configured:
            paths.append(p if os.path.isabs(p) else os.path.join(str(base), p))
    else:
        for name in _DEFAULT_ANCHORS:
            paths.append(os.path.join(_DEFAULT_ANCHOR_DIR, name))
    return paths


def load_trust_anchors() -> list:
    """Load trust-anchor X.509 certificates from the configured PEM files."""
    anchors = []
    for path in _anchor_paths():
        try:
            with open(path, 'rb') as fh:
                data = fh.read()
            try:
                anchors.append(x509.load_pem_x509_certificate(data, default_backend()))
            except ValueError:
                anchors.append(x509.load_der_x509_certificate(data, default_backend()))
        except FileNotFoundError:
            logger.warning('Trust anchor not found: %s', path)
        except Exception as exc:
            logger.warning('Failed to load trust anchor %s: %s', path, exc)
    return anchors


# ─── Signature / chain helpers ─────────────────────────────────────────────────

def _verify_signed_by(child, issuer) -> bool:
    """Return True if ``child``'s signature verifies against ``issuer``'s public key."""
    pub = issuer.public_key()
    try:
        if isinstance(pub, rsa.RSAPublicKey):
            pub.verify(child.signature, child.tbs_certificate_bytes,
                       padding.PKCS1v15(), child.signature_hash_algorithm)
        elif isinstance(pub, ec.EllipticCurvePublicKey):
            pub.verify(child.signature, child.tbs_certificate_bytes,
                       ec.ECDSA(child.signature_hash_algorithm))
        else:
            return False
        return True
    except InvalidSignature:
        return False
    except Exception as exc:
        logger.debug('signature verify error: %s', exc)
        return False


def _build_chain(leaf, anchors):
    """
    Build a path from ``leaf`` up to one of the ``anchors`` (by issuer/subject +
    signature). Returns (path_including_anchor, anchor) or (None, None).
    """
    by_subject = {a.subject.rfc4514_string(): a for a in anchors}
    chain = [leaf]
    current = leaf
    # Limited depth — PEPPOL PKI is leaf → AP CA → Root (3 levels).
    for _ in range(8):
        issuer_name = current.issuer.rfc4514_string()
        candidate = by_subject.get(issuer_name)
        if candidate is None:
            return None, None
        if not _verify_signed_by(current, candidate):
            return None, None
        chain.append(candidate)
        if candidate.subject == candidate.issuer:        # reached a self-signed root anchor
            return chain, candidate
        current = candidate
    return None, None


def _within_validity(cert, now) -> bool:
    try:
        nb = cert.not_valid_before_utc
        na = cert.not_valid_after_utc
    except AttributeError:                                # older cryptography
        nb, na = cert.not_valid_before, cert.not_valid_after
    return nb <= now <= na


# ─── CRL revocation check ───────────────────────────────────────────────────────

def _crl_urls(cert) -> list:
    urls = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.CRL_DISTRIBUTION_POINTS).value
        for dp in ext:
            for name in (dp.full_name or []):
                val = getattr(name, 'value', '')
                if isinstance(val, str) and val.lower().startswith('http'):
                    urls.append(val)
    except x509.ExtensionNotFound:
        pass
    return urls


def _fetch_crl(url) -> Optional[x509.CertificateRevocationList]:
    cached = _CRL_CACHE.get(url)
    if cached and cached[0] > time.time():
        return cached[1]
    try:
        import requests
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        raw = resp.content
        try:
            crl = x509.load_der_x509_crl(raw, default_backend())
        except ValueError:
            crl = x509.load_pem_x509_crl(raw, default_backend())
        _CRL_CACHE[url] = (time.time() + _CRL_TTL_SECONDS, crl)
        return crl
    except Exception as exc:
        logger.warning('CRL fetch failed (%s): %s', url, exc)
        return None


def _check_revocation(cert, issuer) -> tuple:
    """
    Check the leaf ``cert`` against its CRL Distribution Points.

    Returns (status, detail) where status is one of:
      'revoked'   — serial present on a validly-signed CRL,
      'good'      — CRL fetched/verified and serial absent,
      'unknown'   — no CRL available / could not verify (caller decides policy).
    """
    urls = _crl_urls(cert)
    if not urls:
        return 'unknown', 'no CRL distribution point'

    for url in urls:
        crl = _fetch_crl(url)
        if crl is None:
            continue
        # Verify the CRL was signed by the certificate's issuer CA.
        if issuer is not None:
            try:
                if not crl.is_signature_valid(issuer.public_key()):
                    logger.warning('CRL signature invalid for %s', url)
                    continue
            except Exception:
                # Fall back to manual verify
                pass
        rc = crl.get_revoked_certificate_by_serial_number(cert.serial_number)
        if rc is not None:
            try:
                when = rc.revocation_date_utc
            except AttributeError:
                when = rc.revocation_date
            return 'revoked', f'revoked on {when}'
        return 'good', f'not listed on CRL ({url})'

    return 'unknown', 'CRL could not be retrieved/verified'


# ─── Public entry point ─────────────────────────────────────────────────────────

def validate_recipient_cert(cert, *, check_revocation: bool = True,
                            require_crl: bool = False) -> CertValidationResult:
    """
    Validate a recipient AP certificate for trustworthiness before sending.

    Args:
        cert:             the recipient's x509 certificate (from the SMP).
        check_revocation: perform a CRL revocation check (default True).
        require_crl:      if True, treat an unobtainable CRL as a failure
                          (strict mode). Default False (a transient CRL outage
                          should not block sending to an otherwise-trusted AP).

    Returns a CertValidationResult; ``bool(result)`` is True only when the
    certificate is trusted, current and not revoked.
    """
    subject = cert.subject.rfc4514_string()
    issuer = cert.issuer.rfc4514_string()
    res = CertValidationResult(valid=False, subject=subject, issuer=issuer)

    anchors = load_trust_anchors()
    if not anchors:
        res.reason = 'no PEPPOL trust anchors configured'
        return res

    # 1. Chain to a trusted anchor
    chain, anchor = _build_chain(cert, anchors)
    if chain is None:
        res.reason = f'certificate does not chain to a trusted OpenPEPPOL CA (issuer={issuer})'
        return res
    res.chain_ok = True

    # 2. Validity window for every cert in the path
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for c in chain:
        if not _within_validity(c, now):
            res.reason = f'certificate or CA in path is expired/not-yet-valid: {c.subject.rfc4514_string()}'
            return res

    # 3. Revocation (CRL) of the leaf certificate
    if check_revocation:
        ca = chain[1] if len(chain) > 1 else anchor
        status, detail = _check_revocation(cert, ca)
        res.crl_checked = status in ('revoked', 'good')
        if status == 'revoked':
            res.revoked = True
            res.reason = f'certificate has been revoked ({detail})'
            return res
        if status == 'unknown':
            if require_crl:
                res.reason = f'revocation status could not be determined ({detail})'
                return res
            res.warnings.append(f'revocation not verified: {detail}')

    res.valid = True
    return res
