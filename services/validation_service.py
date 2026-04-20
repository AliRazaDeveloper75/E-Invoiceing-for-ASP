"""
UAE E-Invoice Validation Engine.

Validates an Invoice before XML generation and ASP submission.
Called as Step 1 of the async processing pipeline (tasks/invoice_tasks.py).

Validation layers:
  Layer 1 — Structural:  required fields, data types, non-empty
  Layer 2 — UAE Tax:     TRN format, VAT rules, transaction scope
  Layer 3 — Business:    at least one item, positive amounts, dates
  Layer 4 — PEPPOL:      UBL structural requirements for transmission

Full PEPPOL schema validation will be added in Step 8 (XML Generator step).
"""
import logging
from decimal import Decimal
from datetime import date

logger = logging.getLogger(__name__)


class ValidationResult:
    """
    Container for validation output.

    errors   — blocking: invoice cannot be submitted
    warnings — non-blocking: logged but do not prevent submission
    """

    def __init__(self):
        self.errors:   list[str] = []
        self.warnings: list[str] = []

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, message: str) -> None:
        self.errors.append(message)
        logger.debug('Validation error: %s', message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)
        logger.debug('Validation warning: %s', message)

    def to_dict(self) -> dict:
        return {
            'is_valid': self.is_valid,
            'errors':   self.errors,
            'warnings': self.warnings,
        }


class InvoiceValidationService:
    """
    Validates an Invoice instance against UAE MoF e-invoicing rules.

    Usage:
        service = InvoiceValidationService()
        result  = service.validate(invoice)
        if not result.is_valid:
            # handle errors
    """

    def validate(self, invoice) -> ValidationResult:
        """
        Run all validation layers against the invoice.
        Returns a ValidationResult (check .is_valid and .errors).
        """
        result = ValidationResult()

        self._validate_company(invoice, result)
        self._validate_customer(invoice, result)
        self._validate_invoice_header(invoice, result)
        self._validate_items(invoice, result)
        self._validate_totals(invoice, result)
        self._validate_credit_note(invoice, result)

        if result.is_valid:
            logger.info('Invoice %s passed validation', invoice.invoice_number)
        else:
            logger.warning(
                'Invoice %s failed validation: %d error(s)',
                invoice.invoice_number, len(result.errors)
            )

        return result

    # ── Layer 1: Company (Supplier) ────────────────────────────────────────────

    def _validate_company(self, invoice, result: ValidationResult) -> None:
        company = invoice.company

        if not company:
            result.add_error('COMP-001: Invoice has no issuing company.')
            return

        if not company.trn:
            result.add_error('COMP-002: Company must have a TRN before issuing invoices.')
        elif len(company.trn) != 15 or not company.trn.isdigit():
            result.add_error(f'COMP-003: Company TRN "{company.trn}" is invalid. Must be 15 digits.')

        if not company.legal_name:
            result.add_error('COMP-004: Company legal name is required.')

        if not company.street_address or not company.city:
            result.add_warning('COMP-W001: Company address is incomplete.')

    # ── Layer 2: Customer (Buyer) ──────────────────────────────────────────────

    def _validate_customer(self, invoice, result: ValidationResult) -> None:
        customer = invoice.customer

        if not customer:
            result.add_error('CUST-001: Invoice has no customer (buyer).')
            return

        if not customer.name:
            result.add_error('CUST-002: Customer name is required.')

        # UAE B2B/B2G customers must have a TRN (per MoF framework)
        is_uae    = customer.country == 'AE'
        is_b2_scope = invoice.transaction_type in ('b2b', 'b2g')

        if is_uae and is_b2_scope:
            if not customer.trn:
                result.add_error(
                    'CUST-003: UAE B2B/B2G customers must have a TRN. '
                    'TIN (first 10 digits) is the B2B business identifier per UAE MoF.'
                )
            elif len(customer.trn) != 15 or not customer.trn.isdigit():
                result.add_error(
                    f'CUST-004: Customer TRN "{customer.trn}" is invalid. Must be 15 digits.'
                )

        # International export customers may have PEPPOL endpoint or email fallback
        if not is_uae and not customer.peppol_endpoint and not customer.email:
            result.add_warning(
                'CUST-W001: Non-UAE customer has no PEPPOL endpoint or email. '
                'Invoice may not be deliverable electronically.'
            )

    # ── Layer 3: Invoice Header ────────────────────────────────────────────────

    def _validate_invoice_header(self, invoice, result: ValidationResult) -> None:
        if not invoice.invoice_number:
            result.add_error('INV-001: Invoice number is missing.')

        if not invoice.issue_date:
            result.add_error('INV-002: Issue date is required.')
        elif isinstance(invoice.issue_date, date) and invoice.issue_date.year < 2024:
            result.add_warning(
                'INV-W001: Issue date is before 2024. '
                'UAE e-invoicing is mandated from Q2 2026 onwards.'
            )

        if invoice.due_date and invoice.issue_date:
            if invoice.due_date < invoice.issue_date:
                result.add_error('INV-003: Due date cannot be before the issue date.')

        if invoice.currency not in ('AED', 'USD', 'EUR'):
            result.add_warning(
                f'INV-W002: Currency "{invoice.currency}" may not be supported by all ASPs.'
            )

        # Credit note reference check
        if invoice.invoice_type == 'credit_note' and not invoice.reference_number:
            result.add_error(
                'INV-004: Credit notes must reference the original invoice number '
                '(Article 65, Federal Decree-Law No. 16 of 2024).'
            )

    # ── Layer 4: Line Items ────────────────────────────────────────────────────

    def _validate_items(self, invoice, result: ValidationResult) -> None:
        items = list(invoice.items.filter(is_active=True))

        if not items:
            result.add_error('ITEM-001: Invoice must have at least one line item.')
            return

        for i, item in enumerate(items, start=1):
            prefix = f'ITEM-{i:02d}'

            if not item.description or not item.description.strip():
                result.add_error(f'{prefix}-002: Item description is required.')

            if item.quantity <= Decimal('0'):
                result.add_error(f'{prefix}-003: Item quantity must be greater than zero.')

            if item.unit_price < Decimal('0'):
                result.add_error(f'{prefix}-004: Item unit price cannot be negative.')

            if item.vat_rate_type not in ('standard', 'zero', 'exempt', 'out_of_scope'):
                result.add_error(
                    f'{prefix}-005: Invalid VAT rate type "{item.vat_rate_type}". '
                    f'Must be one of: standard, zero, exempt, out_of_scope.'
                )

            if item.subtotal < Decimal('0'):
                result.add_error(f'{prefix}-006: Item subtotal cannot be negative.')

    # ── Layer 5: Financial Totals ──────────────────────────────────────────────

    def _validate_totals(self, invoice, result: ValidationResult) -> None:
        if invoice.total_amount < Decimal('0'):
            result.add_error(
                'TOT-001: Invoice total amount cannot be negative. '
                'Issue a credit note instead.'
            )

        if invoice.discount_amount < Decimal('0'):
            result.add_error('TOT-002: Discount amount cannot be negative.')

        if invoice.discount_amount > invoice.subtotal:
            result.add_error('TOT-003: Discount cannot exceed the invoice subtotal.')

        # Verify stored totals are consistent (guard against stale data)
        items = list(invoice.items.filter(is_active=True))
        computed_subtotal  = sum(i.subtotal   for i in items)
        computed_total_vat = sum(i.vat_amount for i in items)

        tolerance = Decimal('0.02')  # Allow 2 fils rounding tolerance

        if abs(invoice.subtotal  - computed_subtotal)  > tolerance:
            result.add_error(
                f'TOT-004: Stored subtotal {invoice.subtotal} does not match '
                f'computed value {computed_subtotal}. Recalculation needed.'
            )
        if abs(invoice.total_vat - computed_total_vat) > tolerance:
            result.add_error(
                f'TOT-005: Stored VAT total {invoice.total_vat} does not match '
                f'computed value {computed_total_vat}. Recalculation needed.'
            )

    # ── Layer 6: Credit Note Specific ─────────────────────────────────────────

    def _validate_credit_note(self, invoice, result: ValidationResult) -> None:
        if invoice.invoice_type != 'credit_note':
            return

        if not invoice.reference_number:
            result.add_error(
                'CN-001: Credit note must reference the original invoice number '
                '(Federal Decree-Law No. 16 of 2024, Article 65).'
            )

        if invoice.total_amount > Decimal('0'):
            result.add_warning(
                'CN-W001: Credit note has a positive total. '
                'Credit notes typically reduce the amount owed.'
            )
