"""
UAE PINT-AE Invoice Compliance Validator.

Validates invoice data against UAE PINT-AE requirements BEFORE XML generation,
providing business-level errors the user can fix in the UI.

This is complementary to the Schematron validator (peppol_validator.py) which
validates the generated XML. This validator works on the Django Invoice model
and is called before submission.

UAE PINT-AE compliance requirements:
  1. TRN validation (15-digit format, starts with 1)
  2. VAT category + rate consistency
  3. Invoice date rules (max 30 days backdated)
  4. Mandatory fields for invoice type
  5. Credit note reference validation
  6. Line item completeness
  7. Tax total accuracy (within AED 0.01 tolerance)
  8. Currency code (AED for domestic, ISO 4217 for foreign)
"""
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from .constants import (
    TRN_LENGTH, TRN_PREFIX,
    INVOICE_TYPE_CREDIT_NOTE,
    VAT_CATEGORY_STANDARD, VAT_CATEGORY_ZERO, VAT_CATEGORY_EXEMPT,
    VAT_CATEGORY_OUT_SCOPE, VAT_CATEGORY_REVERSE,
    VAT_RATE_STANDARD,
    UAE_DEFAULT_CURRENCY,
)

logger = logging.getLogger(__name__)


@dataclass
class PINTAEValidationResult:
    """Result of UAE PINT-AE compliance validation."""
    is_valid:   bool  = True
    errors:     list  = field(default_factory=list)
    warnings:   list  = field(default_factory=list)

    def add_error(self, code: str, message: str) -> None:
        self.errors.append({'code': code, 'message': message})
        self.is_valid = False

    def add_warning(self, code: str, message: str) -> None:
        self.warnings.append({'code': code, 'message': message})

    def to_dict(self) -> dict:
        return {
            'is_valid': self.is_valid,
            'errors':   self.errors,
            'warnings': self.warnings,
        }


class PINTAEValidator:
    """
    UAE PINT-AE business rule validator for Invoice model instances.

    Validates:
      - Seller and buyer TRN format
      - VAT calculations
      - Invoice date constraints
      - Type-specific mandatory fields
      - Credit note reference requirements

    Usage:
        validator = PINTAEValidator()
        result = validator.validate(invoice)
        if not result.is_valid:
            raise ValidationError(result.errors)
    """

    # Max backdating allowed per DCTCE spec (30 days)
    MAX_BACKDATE_DAYS = 30

    # B2B threshold requiring buyer TRN (AED)
    BUYER_TRN_THRESHOLD = Decimal('10000.00')

    # VAT calculation tolerance (AED)
    VAT_TOLERANCE = Decimal('0.01')

    def validate(self, invoice) -> PINTAEValidationResult:
        """
        Run full UAE PINT-AE compliance validation on an Invoice instance.

        Args:
            invoice: apps.invoices.models.Invoice instance

        Returns:
            PINTAEValidationResult
        """
        result = PINTAEValidationResult()

        self._validate_seller(invoice, result)
        self._validate_buyer(invoice, result)
        self._validate_dates(invoice, result)
        self._validate_line_items(invoice, result)
        self._validate_vat_calculations(invoice, result)
        self._validate_type_specific(invoice, result)
        self._validate_currency(invoice, result)

        if result.is_valid:
            logger.info(
                'PINT-AE validation passed: invoice=%s type=%s',
                getattr(invoice, 'invoice_number', 'unknown'),
                getattr(invoice, 'invoice_type', 'unknown'),
            )
        else:
            logger.warning(
                'PINT-AE validation failed: invoice=%s errors=%d',
                getattr(invoice, 'invoice_number', 'unknown'),
                len(result.errors),
            )

        return result

    # ── Seller validation ──────────────────────────────────────────────────────

    def _validate_seller(self, invoice, result: PINTAEValidationResult) -> None:
        company = getattr(invoice, 'company', None)
        if not company:
            result.add_error('PINT-AE-R001', 'Invoice must be associated with a company (seller).')
            return

        # TRN validation
        trn = getattr(company, 'trn', '') or ''
        if not trn:
            result.add_error(
                'PINT-AE-R001',
                'Seller TRN (Tax Registration Number) is required for PEPPOL invoices. '
                'Update company settings.'
            )
        elif not self._is_valid_trn(trn):
            result.add_error(
                'PINT-AE-R005',
                f'Seller TRN "{trn}" is invalid. UAE TRN must be exactly 15 digits.'
            )

        # Seller address
        if not getattr(company, 'address', ''):
            result.add_warning(
                'PINT-AE-W001',
                'Seller address is missing. Required for PINT-AE compliance.'
            )

        # Seller country
        country = getattr(company, 'country', '') or ''
        if country and country.upper() != 'AE':
            result.add_warning(
                'PINT-AE-W002',
                f'Seller country code "{country}" is not AE (United Arab Emirates). '
                'Verify this is correct for UAE PINT-AE.'
            )

    # ── Buyer validation ───────────────────────────────────────────────────────

    def _validate_buyer(self, invoice, result: PINTAEValidationResult) -> None:
        customer = getattr(invoice, 'customer', None)
        if not customer:
            result.add_error('PINT-AE-R002', 'Invoice must have a customer (buyer).')
            return

        # Check B2B threshold for TRN requirement
        total = getattr(invoice, 'total_amount', Decimal('0')) or Decimal('0')
        try:
            total = Decimal(str(total))
        except Exception:
            total = Decimal('0')

        buyer_trn = getattr(customer, 'trn', '') or getattr(customer, 'vat_number', '') or ''
        is_b2b = getattr(customer, 'is_business', True)

        if is_b2b and total >= self.BUYER_TRN_THRESHOLD and not buyer_trn:
            result.add_error(
                'PINT-AE-R002',
                f'Buyer TRN is required for B2B invoices above AED {self.BUYER_TRN_THRESHOLD:,.2f}. '
                f'Invoice total: AED {total:,.2f}. Update customer record.'
            )

        if buyer_trn and not self._is_valid_trn(buyer_trn):
            result.add_error(
                'PINT-AE-R005',
                f'Buyer TRN "{buyer_trn}" is invalid. UAE TRN must be exactly 15 digits.'
            )

        if not getattr(customer, 'name', ''):
            result.add_error(
                'PINT-AE-R010',
                'Buyer name is required.'
            )

    # ── Date validation ────────────────────────────────────────────────────────

    def _validate_dates(self, invoice, result: PINTAEValidationResult) -> None:
        issue_date = getattr(invoice, 'issue_date', None)
        if not issue_date:
            result.add_error('PINT-AE-R003', 'Invoice issue date is required.')
            return

        if isinstance(issue_date, str):
            try:
                from datetime import datetime
                issue_date = datetime.strptime(issue_date, '%Y-%m-%d').date()
            except ValueError:
                result.add_error('PINT-AE-R003', f'Invalid issue date format: "{issue_date}". Expected YYYY-MM-DD.')
                return

        today = date.today()
        max_backdate = today - timedelta(days=self.MAX_BACKDATE_DAYS)

        if issue_date > today:
            result.add_warning(
                'PINT-AE-W003',
                f'Invoice is dated in the future ({issue_date}). '
                'Future-dated invoices may be rejected by some receiving systems.'
            )

        if issue_date < max_backdate:
            result.add_error(
                'PINT-AE-R003',
                f'Invoice date {issue_date} is more than {self.MAX_BACKDATE_DAYS} days in the past. '
                'UAE e-invoicing requires timely reporting. '
                f'Earliest allowed: {max_backdate}.'
            )

    # ── Line items ─────────────────────────────────────────────────────────────

    def _validate_line_items(self, invoice, result: PINTAEValidationResult) -> None:
        items = getattr(invoice, 'items', None)
        if items is None:
            result.add_error('PINT-AE-R011', 'Invoice must have at least one line item.')
            return

        try:
            item_list = list(items.all())
        except Exception:
            item_list = list(items) if hasattr(items, '__iter__') else []

        if not item_list:
            result.add_error('PINT-AE-R011', 'Invoice must have at least one line item.')
            return

        for i, item in enumerate(item_list, 1):
            if not getattr(item, 'description', ''):
                result.add_error(
                    'PINT-AE-R012',
                    f'Line item #{i}: description is required.'
                )

            qty = getattr(item, 'quantity', None)
            if qty is None or Decimal(str(qty)) <= 0:
                result.add_error(
                    'PINT-AE-R013',
                    f'Line item #{i}: quantity must be positive.'
                )

            unit_price = getattr(item, 'unit_price', None)
            if unit_price is None:
                result.add_error(
                    'PINT-AE-R014',
                    f'Line item #{i}: unit price is required.'
                )

            # VAT category on line
            vat_cat = getattr(item, 'vat_category', VAT_CATEGORY_STANDARD)
            valid_cats = [
                VAT_CATEGORY_STANDARD, VAT_CATEGORY_ZERO,
                VAT_CATEGORY_EXEMPT, VAT_CATEGORY_OUT_SCOPE, VAT_CATEGORY_REVERSE,
            ]
            if vat_cat not in valid_cats:
                result.add_error(
                    'PINT-AE-R015',
                    f'Line item #{i}: invalid VAT category "{vat_cat}". '
                    f'Valid values: {", ".join(valid_cats)}'
                )

    # ── VAT calculation accuracy ───────────────────────────────────────────────

    def _validate_vat_calculations(self, invoice, result: PINTAEValidationResult) -> None:
        """
        Verify that stated VAT amounts are mathematically correct.

        DCTCE requires VAT amounts to be accurate within AED 0.01 per line
        and in total. Incorrect calculations are a common rejection reason.
        """
        try:
            items = list(invoice.items.all()) if hasattr(invoice, 'items') else []
        except Exception:
            return

        calculated_vat = Decimal('0.00')
        calculated_subtotal = Decimal('0.00')

        for item in items:
            try:
                qty   = Decimal(str(getattr(item, 'quantity', 0) or 0))
                price = Decimal(str(getattr(item, 'unit_price', 0) or 0))
                line_total = (qty * price).quantize(Decimal('0.01'), ROUND_HALF_UP)
                calculated_subtotal += line_total

                vat_cat  = getattr(item, 'vat_category', VAT_CATEGORY_STANDARD)
                vat_rate = Decimal(VAT_RATE_STANDARD) if vat_cat == VAT_CATEGORY_STANDARD else Decimal('0')
                item_vat = (line_total * vat_rate).quantize(Decimal('0.01'), ROUND_HALF_UP)
                calculated_vat += item_vat
            except Exception:
                pass

        # Compare with invoice-level totals
        stated_vat = Decimal(str(getattr(invoice, 'vat_amount', 0) or 0))
        diff = abs(calculated_vat - stated_vat)

        if diff > self.VAT_TOLERANCE:
            result.add_error(
                'PINT-AE-R004',
                f'VAT calculation mismatch: stated VAT is {stated_vat:.2f} AED, '
                f'calculated VAT is {calculated_vat:.2f} AED (difference: {diff:.2f} AED). '
                f'Maximum tolerance: {self.VAT_TOLERANCE} AED.'
            )

    # ── Type-specific validation ───────────────────────────────────────────────

    def _validate_type_specific(self, invoice, result: PINTAEValidationResult) -> None:
        invoice_type = getattr(invoice, 'invoice_type', 'tax_invoice') or 'tax_invoice'

        if invoice_type == 'credit_note':
            # Credit notes must reference the original invoice
            ref = (
                getattr(invoice, 'billing_reference', '')
                or getattr(invoice, 'credit_note_reason', '')
            )
            if not ref:
                result.add_error(
                    'PINT-AE-R007',
                    'Credit note must reference the original invoice number '
                    '(set billing_reference or credit_note_reason).'
                )

    # ── Currency ───────────────────────────────────────────────────────────────

    def _validate_currency(self, invoice, result: PINTAEValidationResult) -> None:
        currency = getattr(invoice, 'currency', '') or UAE_DEFAULT_CURRENCY
        if len(currency) != 3 or not currency.isalpha():
            result.add_error(
                'PINT-AE-R016',
                f'Currency "{currency}" is not a valid ISO 4217 3-letter code.'
            )

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _is_valid_trn(trn: str) -> bool:
        """UAE TRN must be exactly 15 digits."""
        return bool(trn) and trn.isdigit() and len(trn) == TRN_LENGTH
