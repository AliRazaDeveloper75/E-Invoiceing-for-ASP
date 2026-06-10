"""
PINT-AE business-document validator (official Schematron, XSLT 2.0).

The OpenPeppol PINT-AE validation artifacts are distributed as *preprocessed*
Schematron XSLT (SVRL-producing). They declare ``version="1.0"`` but use XSLT 2.0
constructs (``for-each-group`` etc.), so they require a real XSLT 2.0+ processor —
**not** lxml/libxslt (XSLT 1.0). We use Saxon via the ``saxonche`` package.

Each document is validated against two stylesheets (per PINT-AE version/profile):
  * PINT-UBL-validation-preprocessed.xslt  — PINT core UBL rules
  * PINT-jurisdiction-aligned-rules.xslt   — UAE (AE) jurisdiction rules

A document is valid when neither stylesheet emits a *fatal* ``svrl:failed-assert``.

Artifacts live under ``schemas/peppol/pint-ae/<calendar-version>/<profile>/``.
Version mapping (phive-rules):  1.0.3 → 2026.3,  1.0.4 → 2026.5.
Select with the ``PINT_AE_VERSION`` setting (default 1.0.4).
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)

NS_SVRL = 'http://purl.oclc.org/dsdl/svrl'

# PINT-AE label → phive-rules calendar directory
_VERSION_DIRS = {
    '1.0.3': '2026.3',
    '1.0.4': '2026.5',
}
_DEFAULT_VERSION = '1.0.4'

_ARTIFACT_ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..',
                              'schemas', 'peppol', 'pint-ae')

_STYLESHEETS = ('PINT-UBL-validation-preprocessed.xslt', 'PINT-jurisdiction-aligned-rules.xslt')

# Cached compiled Saxon executables: path -> PyXsltExecutable
_COMPILED: dict = {}
_PROC = None


@dataclass
class PintAeValidationResult:
    is_valid: bool = True
    errors: list = field(default_factory=list)     # [{'id','text','location'}]
    warnings: list = field(default_factory=list)
    ran: bool = False                              # False if Saxon unavailable / artifacts missing

    def __bool__(self):
        return self.is_valid


def _version_dir(version: Optional[str]) -> str:
    version = version or _get_setting_version()
    return _VERSION_DIRS.get(version, _VERSION_DIRS[_DEFAULT_VERSION])


def _get_setting_version() -> str:
    try:
        from django.conf import settings
        return getattr(settings, 'PINT_AE_VERSION', _DEFAULT_VERSION)
    except Exception:
        return _DEFAULT_VERSION


def _profile_dir(profile: str) -> str:
    return 'selfbilling' if profile == 'selfbilling' else 'billing'


def _stylesheet_paths(version: Optional[str], profile: str) -> list:
    base = os.path.normpath(os.path.join(_ARTIFACT_ROOT, _version_dir(version), _profile_dir(profile)))
    return [os.path.join(base, name) for name in _STYLESHEETS]


def _get_processor():
    global _PROC
    if _PROC is None:
        from saxonche import PySaxonProcessor
        _PROC = PySaxonProcessor(license=False)
    return _PROC


def _compile(path: str):
    ex = _COMPILED.get(path)
    if ex is None:
        proc = _get_processor()
        xslt = proc.new_xslt30_processor()
        ex = xslt.compile_stylesheet(stylesheet_file=path)
        _COMPILED[path] = ex
    return ex


def _parse_svrl(svrl_xml: str, errors: list, warnings: list) -> None:
    """Collect svrl:failed-assert / successful-report into errors/warnings."""
    try:
        doc = etree.fromstring(svrl_xml.encode('utf-8') if isinstance(svrl_xml, str) else svrl_xml)
    except Exception as exc:
        logger.warning('PINT-AE: could not parse SVRL output: %s', exc)
        return
    for fa in doc.iter(f'{{{NS_SVRL}}}failed-assert'):
        flag = (fa.get('flag') or 'fatal').lower()
        text_el = fa.find(f'{{{NS_SVRL}}}text')
        entry = {
            'id': fa.get('id', ''),
            'location': fa.get('location', ''),
            'text': (text_el.text or '').strip() if text_el is not None else '',
        }
        (warnings if flag in ('warning', 'info') else errors).append(entry)


def validate_document(xml_bytes: bytes, *, profile: str = 'billing',
                      version: Optional[str] = None) -> PintAeValidationResult:
    """
    Validate a UBL Invoice/CreditNote against the official PINT-AE Schematron.

    Args:
        xml_bytes: the business document (UBL Invoice or CreditNote) bytes.
        profile:   'billing' (default) or 'selfbilling'.
        version:   PINT-AE label (e.g. '1.0.4'); defaults to PINT_AE_VERSION.

    Returns a PintAeValidationResult. If Saxon or the artifacts are unavailable,
    ``ran`` is False and ``is_valid`` is True (caller decides whether to fail-closed).
    """
    res = PintAeValidationResult()

    paths = _stylesheet_paths(version, profile)
    missing = [p for p in paths if not os.path.exists(p)]
    if missing:
        logger.warning('PINT-AE: validation artifacts missing: %s', missing)
        res.warnings.append({'id': 'NO-ARTIFACTS', 'text': f'Missing: {missing}', 'location': ''})
        return res

    try:
        proc = _get_processor()
    except Exception as exc:
        logger.warning('PINT-AE: Saxon (saxonche) unavailable: %s', exc)
        res.warnings.append({'id': 'NO-SAXON', 'text': str(exc), 'location': ''})
        return res

    # Saxon reads the source from an XDM node built from the bytes.
    try:
        source_node = proc.parse_xml(xml_text=xml_bytes.decode('utf-8'))
    except Exception as exc:
        res.is_valid = False
        res.ran = True
        res.errors.append({'id': 'SYNTAX', 'text': f'Document is not well-formed: {exc}', 'location': ''})
        return res

    for path in paths:
        try:
            executable = _compile(path)
            svrl = executable.transform_to_string(xdm_node=source_node)
            if svrl:
                _parse_svrl(svrl, res.errors, res.warnings)
            res.ran = True
        except Exception as exc:
            logger.error('PINT-AE: transform failed for %s: %s', os.path.basename(path), exc)
            res.warnings.append({'id': 'XSLT-ERROR', 'text': str(exc), 'location': os.path.basename(path)})

    res.is_valid = len(res.errors) == 0
    return res
