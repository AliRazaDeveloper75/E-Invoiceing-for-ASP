"""
PEPPOL BIS Billing 3.0 — XML Validation Engine.

Two complementary validation layers:
  1. XSD structural validation  — schema-level (element names, types, cardinality)
  2. Schematron business rules  — PEPPOL/PINT-AE semantic rules (BR-*, PINT-AE-*)

Both are wrapped by FullPEPPOLValidator which returns a ValidationResult
compatible with the existing InvoiceValidationService contract.

Schema files are expected under settings.PEPPOL_SCHEMA_DIR:
  xsd/
    UBL-Invoice-2.1.xsd          (root schema — imports CommonAggregateComponents etc.)
    UBL-CreditNote-2.1.xsd
    common/
      UBL-CommonAggregateComponents-2.1.xsd
      UBL-CommonBasicComponents-2.1.xsd
      UBL-CommonExtensionComponents-2.1.xsd
      ...
  sch/
    PEPPOL-EN16931-UBL.sch       (EN 16931 / BIS 3.0 business rules)
    PINT-AE.sch                  (UAE-specific PINT-AE rules — when published)

Download: python manage.py download_peppol_schemas
  or:     scripts/download_schemas.sh
"""
import logging
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class PEPPOLValidationResult:
    """
    Holds the outcome of PEPPOL schema + schematron validation.

    is_valid   — True only if zero errors in both layers
    errors     — blocking rule violations (schema errors, BR-* failures)
    warnings   — non-blocking advisories (PINT-AE-W* warnings)
    xsd_valid  — was XSD validation specifically clean?
    sch_valid  — was Schematron validation specifically clean?
    """
    is_valid:  bool = True
    errors:    list = field(default_factory=list)
    warnings:  list = field(default_factory=list)
    xsd_valid: bool = True
    sch_valid: bool = True

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.is_valid = False

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)

    def to_dict(self) -> dict:
        return {
            'is_valid':  self.is_valid,
            'xsd_valid': self.xsd_valid,
            'sch_valid': self.sch_valid,
            'errors':    self.errors,
            'warnings':  self.warnings,
        }


# ─── XSD Validator ────────────────────────────────────────────────────────────

class PEPPOLXSDValidator:
    """
    Validates UBL 2.1 Invoice/CreditNote XML against the official OASIS XSD schemas.

    Schemas are loaded once and cached (per invoice type) to avoid repeated I/O.
    Thread-safe: lxml.etree.XMLSchema objects are immutable after construction.

    Usage:
        validator = PEPPOLXSDValidator(schema_dir='/path/to/schemas/xsd')
        result = validator.validate(xml_bytes, invoice_type='invoice')
    """

    # Map Django invoice_type values → XSD filename
    _SCHEMA_FILES = {
        'invoice':        'UBL-Invoice-2.1.xsd',
        'tax_invoice':    'UBL-Invoice-2.1.xsd',
        'credit_note':    'UBL-CreditNote-2.1.xsd',
        'commercial':     'UBL-Invoice-2.1.xsd',
        'continuous':     'UBL-Invoice-2.1.xsd',
    }
    _DEFAULT_SCHEMA = 'UBL-Invoice-2.1.xsd'

    def __init__(self, schema_dir: Optional[str] = None):
        if schema_dir is None:
            from django.conf import settings
            schema_dir = os.path.join(settings.PEPPOL_SCHEMA_DIR, 'xsd')
        self._schema_dir = Path(schema_dir)
        self._cache: dict = {}

    def _load_schema(self, schema_file: str) -> Optional[etree.XMLSchema]:
        """Load and cache an XMLSchema object. Returns None if file missing."""
        if schema_file in self._cache:
            return self._cache[schema_file]

        schema_path = self._schema_dir / schema_file
        if not schema_path.exists():
            logger.warning(
                'PEPPOL XSD schema not found: %s — download via scripts/download_schemas.sh',
                schema_path
            )
            return None

        try:
            doc = etree.parse(str(schema_path))
            schema = etree.XMLSchema(doc)
            self._cache[schema_file] = schema
            logger.debug('Loaded PEPPOL XSD schema: %s', schema_file)
            return schema
        except etree.XMLSchemaParseError as exc:
            logger.error('Failed to parse PEPPOL XSD schema %s: %s', schema_file, exc)
            return None

    def validate(self, xml_bytes: bytes, invoice_type: str = 'invoice') -> PEPPOLValidationResult:
        """
        Validate raw XML bytes against the UBL 2.1 XSD for the given invoice type.

        Returns PEPPOLValidationResult. If the schema file is not available,
        validation is skipped (result.is_valid=True, with a warning).
        """
        result = PEPPOLValidationResult()

        schema_file = self._SCHEMA_FILES.get(invoice_type, self._DEFAULT_SCHEMA)
        schema = self._load_schema(schema_file)

        if schema is None:
            result.add_warning(
                'XSD-W001: PEPPOL XSD schema not available — structural validation skipped. '
                'Run scripts/download_schemas.sh to enable.'
            )
            result.xsd_valid = True  # Don't fail if schema absent (graceful degradation)
            return result

        try:
            doc = etree.fromstring(xml_bytes)
        except etree.XMLSyntaxError as exc:
            result.add_error(f'XSD-001: XML is not well-formed: {exc}')
            result.xsd_valid = False
            return result

        if not schema.validate(doc):
            result.xsd_valid = False
            for error in schema.error_log:
                result.add_error(
                    f'XSD-{error.line:04d}: {error.message}'
                )
            logger.warning(
                'XSD validation failed: %d error(s)', len(result.errors)
            )
        else:
            logger.info('XSD validation passed.')

        return result


# ─── Schematron Validator ─────────────────────────────────────────────────────

class PEPPOLSchematronValidator:
    """
    Validates UBL XML against PEPPOL BIS 3.0 Schematron business rules
    (EN 16931 core rules + PINT-AE extension rules).

    Schematron is compiled to XSLT on first use and cached.

    Schema files:
      sch/PEPPOL-EN16931-UBL.sch   — Core EN 16931 + PEPPOL BIS 3.0 rules
      sch/PINT-AE.sch              — UAE-specific PINT profile rules (optional)

    Severity mapping:
      <assert role="fatal"> → error (blocks submission)
      <assert role="warning"> → warning (advisory)
      <report> → warning
    """

    _SCH_FILES = [
        'PEPPOL-EN16931-UBL.sch',
        'PINT-AE.sch',
    ]

    def __init__(self, schema_dir: Optional[str] = None, version: Optional[str] = None):
        if schema_dir is None:
            from django.conf import settings
            schema_dir = os.path.join(settings.PEPPOL_SCHEMA_DIR, 'sch')
        from apps.common.constants import PINT_AE_VERSION
        self._schema_dir = Path(schema_dir)
        # PINT-AE version routing: validate against the active spec version
        # (1.0.3 until 7 Jun 2026, 1.0.4 from 8 Jun 2026). Version-specific
        # Schematron lives in sch/<version>/, falling back to the flat sch/ dir.
        self._version = version or PINT_AE_VERSION
        self._version_dir = self._schema_dir / self._version
        self._xslt_cache: dict = {}

    def _compile_schematron(self, sch_file: str) -> Optional[etree.XSLT]:
        """
        Compile a .sch file to an XSLT transform using the ISO Schematron
        skeleton stylesheets bundled with lxml.

        Looks in the version-specific folder (sch/<version>/) first, then the
        flat sch/ directory. Returns None if the file doesn't exist anywhere
        (graceful degradation).
        """
        if sch_file in self._xslt_cache:
            return self._xslt_cache[sch_file]

        # Prefer the version-pinned artifact, fall back to the flat directory.
        sch_path = self._version_dir / sch_file
        if not sch_path.exists():
            sch_path = self._schema_dir / sch_file
        if not sch_path.exists():
            logger.debug('Schematron file not found (optional): %s', sch_path)
            return None

        try:
            # lxml's isoschematron module handles the multi-pass XSLT compilation
            from lxml.isoschematron import Schematron
            doc = etree.parse(str(sch_path))
            compiled = Schematron(doc, store_report=True)
            self._xslt_cache[sch_file] = compiled
            logger.debug('Compiled Schematron: %s', sch_file)
            return compiled
        except Exception as exc:
            logger.error('Failed to compile Schematron %s: %s', sch_file, exc)
            return None

    def validate(self, xml_bytes: bytes) -> PEPPOLValidationResult:
        """
        Run all available Schematron files against the XML.
        Fatal assertions become errors; warnings stay as warnings.
        """
        result = PEPPOLValidationResult()

        try:
            doc = etree.fromstring(xml_bytes)
        except etree.XMLSyntaxError as exc:
            result.add_error(f'SCH-001: XML is not well-formed: {exc}')
            result.sch_valid = False
            return result

        any_schema_found = False

        for sch_file in self._SCH_FILES:
            compiled = self._compile_schematron(sch_file)
            if compiled is None:
                continue

            any_schema_found = True

            is_valid = compiled.validate(doc)
            if not is_valid:
                result.sch_valid = False
                self._parse_schematron_report(compiled, result)

        if not any_schema_found:
            result.add_warning(
                'SCH-W001: No Schematron files available — business rule validation skipped. '
                'Run scripts/download_schemas.sh to enable.'
            )

        if result.sch_valid:
            logger.info('Schematron validation passed.')
        else:
            logger.warning('Schematron validation failed: %d error(s)', len(result.errors))

        return result

    def _parse_schematron_report(self, compiled, result: PEPPOLValidationResult) -> None:
        """
        Parse lxml's Schematron validation report to extract rule violations.
        Fatal assertions → errors; warnings/reports → warnings.
        """
        try:
            report = compiled.validation_report
            if report is None:
                return

            # Namespaces used in Schematron SVRL output
            SVRL = 'http://purl.oclc.org/dsdl/svrl'

            for failed in report.findall(f'{{{SVRL}}}failed-assert'):
                role = failed.get('role', 'fatal').lower()
                rule_id = failed.get('id', 'UNKNOWN')
                text_el = failed.find(f'{{{SVRL}}}text')
                text = text_el.text.strip() if text_el is not None and text_el.text else 'No message'
                location = failed.get('location', '')

                msg = f'{rule_id}: {text} (at {location})' if location else f'{rule_id}: {text}'

                if role in ('fatal', 'error'):
                    result.add_error(f'SCH-{msg}')
                else:
                    result.add_warning(f'SCH-{msg}')

            for report_el in report.findall(f'{{{SVRL}}}successful-report'):
                rule_id = report_el.get('id', 'UNKNOWN')
                text_el = report_el.find(f'{{{SVRL}}}text')
                text = text_el.text.strip() if text_el is not None and text_el.text else ''
                if text:
                    result.add_warning(f'SCH-{rule_id}: {text}')

        except Exception as exc:
            logger.error('Error parsing Schematron report: %s', exc)


# ─── Full PEPPOL Validator ────────────────────────────────────────────────────

class FullPEPPOLValidator:
    """
    Combines XSD + Schematron validation into a single call.

    Returns a PEPPOLValidationResult. If PEPPOL_XSD_VALIDATION_ENABLED is False
    in settings, validation is skipped entirely (for dev environments without schemas).

    Usage:
        from services.peppol_validator import FullPEPPOLValidator
        result = FullPEPPOLValidator().validate(xml_bytes, invoice_type='invoice')
        if not result.is_valid:
            logger.error('PEPPOL validation failed: %s', result.errors)
    """

    def __init__(self):
        self._xsd = PEPPOLXSDValidator()
        self._sch = PEPPOLSchematronValidator()

    def validate(self, xml_bytes: bytes, invoice_type: str = 'invoice') -> PEPPOLValidationResult:
        """
        Run full PEPPOL validation. Returns combined result from XSD + Schematron.
        Respects PEPPOL_XSD_VALIDATION_ENABLED Django setting.
        """
        from django.conf import settings

        if not getattr(settings, 'PEPPOL_XSD_VALIDATION_ENABLED', True):
            result = PEPPOLValidationResult()
            result.add_warning('PEPPOL_XSD_VALIDATION_ENABLED=False — validation skipped.')
            logger.info('PEPPOL validation skipped (disabled in settings).')
            return result

        logger.info('Running full PEPPOL validation (invoice_type=%s)', invoice_type)

        # XSD first — structural errors are caught before business rules
        xsd_result = self._xsd.validate(xml_bytes, invoice_type)

        result = PEPPOLValidationResult(
            is_valid=xsd_result.is_valid,
            errors=list(xsd_result.errors),
            warnings=list(xsd_result.warnings),
            xsd_valid=xsd_result.xsd_valid,
        )

        # Only run Schematron if XSD passed (avoids cascading false failures)
        if xsd_result.xsd_valid:
            sch_result = self._sch.validate(xml_bytes)
            result.sch_valid = sch_result.sch_valid
            result.errors.extend(sch_result.errors)
            result.warnings.extend(sch_result.warnings)
            if sch_result.errors:
                result.is_valid = False
        else:
            result.add_warning('SCH-SKIP: Schematron skipped due to XSD errors.')

        logger.info(
            'PEPPOL validation complete — valid=%s, errors=%d, warnings=%d',
            result.is_valid, len(result.errors), len(result.warnings)
        )
        return result
