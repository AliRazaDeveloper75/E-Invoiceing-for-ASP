"""
UAE PINT-AE Compliance Validator Tests.

Tests the PINTAEValidator against Invoice-like objects (using simple
attribute stubs — no DB required).
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock

import pytest

from services.peppol.pint_ae.validator import PINTAEValidator, PINTAEValidationResult


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def _make_company(**kwargs):
    c = MagicMock()
    c.trn     = kwargs.get('trn',     '100000000000001')
    c.address = kwargs.get('address', '123 Sheikh Zayed Road, Dubai')
    c.country = kwargs.get('country', 'AE')
    return c


def _make_customer(**kwargs):
    c = MagicMock()
    c.name        = kwargs.get('name',        'Test Buyer LLC')
    c.trn         = kwargs.get('trn',         '200000000000001')
    c.vat_number  = kwargs.get('vat_number',  '')
    c.is_business = kwargs.get('is_business', True)
    return c


def _make_item(**kwargs):
    i = MagicMock()
    i.description = kwargs.get('description', 'Consulting Services')
    i.quantity    = kwargs.get('quantity',    Decimal('1'))
    i.unit_price  = kwargs.get('unit_price',  Decimal('1000.00'))
    i.vat_category = kwargs.get('vat_category', 'S')
    return i


def _make_invoice(**kwargs):
    """Build a minimal valid invoice stub."""
    inv = MagicMock()
    inv.invoice_number  = kwargs.get('invoice_number', 'INV-001')
    inv.invoice_type    = kwargs.get('invoice_type',   'tax_invoice')
    inv.issue_date      = kwargs.get('issue_date',     date.today())
    inv.currency        = kwargs.get('currency',       'AED')
    inv.total_amount    = kwargs.get('total_amount',   Decimal('1050.00'))
    inv.vat_amount      = kwargs.get('vat_amount',     Decimal('50.00'))
    inv.company         = kwargs.get('company',        _make_company())
    inv.customer        = kwargs.get('customer',       _make_customer())
    inv.billing_reference = kwargs.get('billing_reference', '')
    inv.credit_note_reason = kwargs.get('credit_note_reason', '')

    # items.all() returns a list
    items = kwargs.get('items', [_make_item()])
    items_mock = MagicMock()
    items_mock.all.return_value = items
    inv.items = items_mock
    return inv


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestPINTAEValidatorValid:
    """Happy-path tests — all should pass validation."""

    def test_valid_standard_invoice(self):
        validator = PINTAEValidator()
        result = validator.validate(_make_invoice())
        assert result.is_valid, result.errors

    def test_valid_high_value_b2b(self):
        inv = _make_invoice(
            total_amount=Decimal('50000.00'),
            vat_amount=Decimal('2500.00'),
            items=[_make_item(quantity=Decimal('10'), unit_price=Decimal('5000.00'))],
        )
        result = PINTAEValidator().validate(inv)
        assert result.is_valid, result.errors

    def test_valid_credit_note_with_reference(self):
        inv = _make_invoice(
            invoice_type='credit_note',
            billing_reference='INV-001',
        )
        result = PINTAEValidator().validate(inv)
        assert result.is_valid, result.errors

    def test_valid_zero_rated_item(self):
        items = [_make_item(vat_category='Z', unit_price=Decimal('500.00'))]
        inv = _make_invoice(
            vat_amount=Decimal('0.00'),
            total_amount=Decimal('500.00'),
            items=items,
        )
        result = PINTAEValidator().validate(inv)
        assert result.is_valid, result.errors


class TestTRNValidation:
    """TRN format enforcement tests."""

    def test_invalid_seller_trn_too_short(self):
        company = _make_company(trn='12345')
        result = PINTAEValidator().validate(_make_invoice(company=company))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R005' in codes

    def test_invalid_seller_trn_not_digits(self):
        company = _make_company(trn='ABCDE12345678901')
        result = PINTAEValidator().validate(_make_invoice(company=company))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R005' in codes

    def test_missing_seller_trn(self):
        company = _make_company(trn='')
        result = PINTAEValidator().validate(_make_invoice(company=company))
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R001' in codes

    def test_invalid_buyer_trn(self):
        customer = _make_customer(trn='NOTDIGITS12345')
        result = PINTAEValidator().validate(_make_invoice(customer=customer))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R005' in codes

    def test_valid_15_digit_trn(self):
        assert PINTAEValidator._is_valid_trn('100000000000001')
        assert PINTAEValidator._is_valid_trn('200000000000099')

    def test_invalid_trn_16_digits(self):
        assert not PINTAEValidator._is_valid_trn('1000000000000011')

    def test_invalid_trn_empty(self):
        assert not PINTAEValidator._is_valid_trn('')


class TestBuyerTRNThreshold:
    """B2B threshold AED 10,000 — buyer TRN required above threshold."""

    def test_b2b_above_threshold_no_trn(self):
        customer = _make_customer(trn='', vat_number='', is_business=True)
        items = [_make_item(quantity=Decimal('10'), unit_price=Decimal('1000.00'))]
        inv = _make_invoice(
            customer=customer,
            total_amount=Decimal('10500.00'),
            vat_amount=Decimal('500.00'),
            items=items,
        )
        result = PINTAEValidator().validate(inv)
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R002' in codes

    def test_b2b_below_threshold_no_trn_allowed(self):
        customer = _make_customer(trn='', vat_number='', is_business=True)
        inv = _make_invoice(
            customer=customer,
            total_amount=Decimal('9000.00'),
            vat_amount=Decimal('428.57'),
            items=[_make_item(quantity=Decimal('9'), unit_price=Decimal('952.38'))],
        )
        result = PINTAEValidator().validate(inv)
        # No PINT-AE-R002 error (below threshold)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R002' not in codes

    def test_b2c_no_trn_required(self):
        customer = _make_customer(trn='', vat_number='', is_business=False)
        inv = _make_invoice(
            customer=customer,
            total_amount=Decimal('50000.00'),
        )
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R002' not in codes


class TestDateValidation:
    """Invoice date constraints."""

    def test_backdated_31_days_error(self):
        issue_date = date.today() - timedelta(days=31)
        result = PINTAEValidator().validate(_make_invoice(issue_date=issue_date))
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R003' in codes

    def test_backdated_30_days_allowed(self):
        issue_date = date.today() - timedelta(days=30)
        result = PINTAEValidator().validate(_make_invoice(issue_date=issue_date))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R003' not in codes

    def test_future_date_warning_not_error(self):
        issue_date = date.today() + timedelta(days=1)
        result = PINTAEValidator().validate(_make_invoice(issue_date=issue_date))
        # May have a warning, but not a hard error
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R003' not in codes
        warn_codes = [w['code'] for w in result.warnings]
        assert 'PINT-AE-W003' in warn_codes

    def test_missing_date_error(self):
        result = PINTAEValidator().validate(_make_invoice(issue_date=None))
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R003' in codes

    def test_string_date_format_valid(self):
        issue_date = str(date.today())
        result = PINTAEValidator().validate(_make_invoice(issue_date=issue_date))
        # Should parse correctly, no R003 error
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R003' not in codes


class TestVATCalculation:
    """VAT calculation accuracy within AED 0.01 tolerance."""

    def test_correct_vat_passes(self):
        items = [_make_item(quantity=Decimal('2'), unit_price=Decimal('1000.00'))]
        # 2 × 1000 × 0.05 = 100.00
        inv = _make_invoice(
            items=items,
            vat_amount=Decimal('100.00'),
            total_amount=Decimal('2100.00'),
        )
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R004' not in codes

    def test_vat_tolerance_within_limit(self):
        items = [_make_item(quantity=Decimal('1'), unit_price=Decimal('1000.00'))]
        # Correct: 50.00, stated: 50.005 (within 0.01 tolerance)
        inv = _make_invoice(
            items=items,
            vat_amount=Decimal('50.005'),
            total_amount=Decimal('1050.00'),
        )
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R004' not in codes

    def test_vat_mismatch_over_tolerance(self):
        items = [_make_item(quantity=Decimal('1'), unit_price=Decimal('1000.00'))]
        # Correct: 50.00, stated: 60.00 (10.00 difference)
        inv = _make_invoice(
            items=items,
            vat_amount=Decimal('60.00'),
            total_amount=Decimal('1060.00'),
        )
        result = PINTAEValidator().validate(inv)
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R004' in codes

    def test_zero_rate_items_no_vat(self):
        items = [_make_item(vat_category='Z', quantity=Decimal('5'), unit_price=Decimal('200.00'))]
        # Zero-rated: VAT = 0
        inv = _make_invoice(items=items, vat_amount=Decimal('0.00'), total_amount=Decimal('1000.00'))
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R004' not in codes


class TestLineItems:
    """Line item completeness validation."""

    def test_missing_description_error(self):
        item = _make_item(description='')
        inv = _make_invoice(items=[item])
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R012' in codes

    def test_zero_quantity_error(self):
        item = _make_item(quantity=Decimal('0'))
        inv = _make_invoice(items=[item])
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R013' in codes

    def test_negative_quantity_error(self):
        item = _make_item(quantity=Decimal('-1'))
        inv = _make_invoice(items=[item])
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R013' in codes

    def test_no_items_error(self):
        items_mock = MagicMock()
        items_mock.all.return_value = []
        inv = _make_invoice()
        inv.items = items_mock
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R011' in codes

    def test_invalid_vat_category(self):
        item = _make_item(vat_category='INVALID')
        inv = _make_invoice(items=[item])
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R015' in codes


class TestCreditNote:
    """Credit note specific validation."""

    def test_credit_note_missing_reference_error(self):
        inv = _make_invoice(
            invoice_type='credit_note',
            billing_reference='',
            credit_note_reason='',
        )
        result = PINTAEValidator().validate(inv)
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R007' in codes

    def test_credit_note_with_billing_reference_ok(self):
        inv = _make_invoice(
            invoice_type='credit_note',
            billing_reference='INV-2024-001',
        )
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R007' not in codes

    def test_credit_note_with_reason_ok(self):
        inv = _make_invoice(
            invoice_type='credit_note',
            billing_reference='',
            credit_note_reason='Price correction on INV-2024-001',
        )
        result = PINTAEValidator().validate(inv)
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R007' not in codes


class TestCurrency:
    """Currency code validation."""

    def test_valid_aed(self):
        result = PINTAEValidator().validate(_make_invoice(currency='AED'))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R016' not in codes

    def test_valid_usd(self):
        result = PINTAEValidator().validate(_make_invoice(currency='USD'))
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R016' not in codes

    def test_invalid_currency_too_short(self):
        result = PINTAEValidator().validate(_make_invoice(currency='AE'))
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R016' in codes

    def test_invalid_currency_numeric(self):
        result = PINTAEValidator().validate(_make_invoice(currency='784'))
        assert not result.is_valid
        codes = [e['code'] for e in result.errors]
        assert 'PINT-AE-R016' in codes


class TestValidationResult:
    """PINTAEValidationResult dataclass behaviour."""

    def test_starts_valid(self):
        r = PINTAEValidationResult()
        assert r.is_valid
        assert r.errors == []
        assert r.warnings == []

    def test_add_error_sets_invalid(self):
        r = PINTAEValidationResult()
        r.add_error('TEST-001', 'Test error')
        assert not r.is_valid
        assert len(r.errors) == 1

    def test_add_warning_keeps_valid(self):
        r = PINTAEValidationResult()
        r.add_warning('TEST-W001', 'Test warning')
        assert r.is_valid
        assert len(r.warnings) == 1

    def test_to_dict_structure(self):
        r = PINTAEValidationResult()
        r.add_error('X', 'msg')
        d = r.to_dict()
        assert 'is_valid' in d
        assert 'errors' in d
        assert 'warnings' in d
        assert d['is_valid'] is False
