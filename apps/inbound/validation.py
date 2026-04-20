"""
Inbound Invoice Validation Engine.

Validates supplier-submitted invoices against UAE FTA requirements
and PEPPOL UBL 2.1 compliance rules.

Rule codes:
  V001–V099  — structural / required-field rules
  FAF-VAT-*  — UAE VAT Audit File (21 mandatory fields)
  FAF-EXC-*  — UAE Excise Audit File (32 mandatory fields)
  FMT-*      — format / data-type rules
  BIZ-*      — business logic rules
"""
from dataclasses import dataclass, field
from typing import Any

from .models import (
    InboundInvoice,
    InboundObservation,
    SEVERITY_CRITICAL,
    SEVERITY_HIGH,
    SEVERITY_MEDIUM,
    SEVERITY_INFO,
)


# ─── Result Types ─────────────────────────────────────────────────────────────

@dataclass
class Finding:
    rule_code:  str
    severity:   str
    field_name: str
    message:    str
    suggestion: str = ''
    line_number: int | None = None


@dataclass
class ValidationResult:
    findings: list[Finding] = field(default_factory=list)

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == SEVERITY_CRITICAL)

    @property
    def has_critical(self) -> bool:
        return self.critical_count > 0

    @property
    def score(self) -> int:
        """0–100 score. Critical = -15, High = -8, Medium = -3, Info = 0."""
        deductions = sum(
            15 if f.severity == SEVERITY_CRITICAL else
            8  if f.severity == SEVERITY_HIGH else
            3  if f.severity == SEVERITY_MEDIUM else 0
            for f in self.findings
        )
        return max(0, 100 - deductions)


# ─── Validation Engine ────────────────────────────────────────────────────────

class InboundValidationEngine:
    """
    Runs all validation rules against an InboundInvoice and its items.

    Usage:
        engine = InboundValidationEngine(invoice)
        result = engine.run()
        engine.persist(result)   # saves InboundObservation records
    """

    def __init__(self, invoice: InboundInvoice):
        self.invoice  = invoice
        self.items    = list(invoice.items.all())
        self.findings: list[Finding] = []

    def run(self) -> ValidationResult:
        self._run_structural_rules()
        self._run_faf_vat_rules()
        self._run_format_rules()
        self._run_business_rules()
        self._run_item_rules()
        return ValidationResult(findings=self.findings)

    def persist(self, result: ValidationResult):
        """Save findings to DB and update invoice summary fields."""
        # Clear stale observations from previous validation run
        self.invoice.observations.all().delete()

        observations = [
            InboundObservation(
                invoice     = self.invoice,
                rule_code   = f.rule_code,
                severity    = f.severity,
                field_name  = f.field_name,
                message     = f.message,
                suggestion  = f.suggestion,
                line_number = f.line_number,
            )
            for f in result.findings
        ]
        InboundObservation.objects.bulk_create(observations)

        self.invoice.validation_score    = result.score
        self.invoice.has_critical_errors = result.has_critical
        self.invoice.observation_count   = len(result.findings)
        self.invoice.save(update_fields=[
            'validation_score', 'has_critical_errors',
            'observation_count', 'updated_at',
        ])

    # ── Private helpers ────────────────────────────────────────────────────────

    def _add(self, rule_code: str, severity: str, field_name: str,
             message: str, suggestion: str = '', line_number: int | None = None):
        self.findings.append(Finding(
            rule_code=rule_code, severity=severity, field_name=field_name,
            message=message, suggestion=suggestion, line_number=line_number,
        ))

    def _required(self, value: Any, rule_code: str, field_name: str,
                  label: str, suggestion: str = ''):
        if not value and value != 0:
            self._add(
                rule_code, SEVERITY_CRITICAL, field_name,
                f'{label} is required but was not provided.',
                suggestion or f'Please include the {label} field in your submission.',
            )
            return False
        return True

    # ── Structural Rules (V001–V020) ───────────────────────────────────────────

    def _run_structural_rules(self):
        inv = self.invoice

        self._required(
            inv.supplier_invoice_number, 'V001', 'supplier_invoice_number',
            'Invoice Number',
            'Provide a unique invoice number in the InvoiceNumber field.'
        )
        self._required(
            inv.invoice_type, 'V002', 'invoice_type',
            'Invoice Type',
            'Set invoice_type to one of: tax_invoice, credit_note, commercial_invoice.'
        )
        self._required(
            inv.issue_date, 'V003', 'issue_date',
            'Issue Date',
            'Provide the invoice issue date in YYYY-MM-DD format.'
        )
        self._required(
            inv.currency, 'V004', 'currency',
            'Currency Code',
            'Provide a 3-letter ISO 4217 currency code (e.g. AED, USD, EUR).'
        )

        # Supplier TRN
        supplier_trn = getattr(inv.supplier, 'trn', '')
        if not supplier_trn:
            self._add(
                'V005', SEVERITY_CRITICAL, 'supplier.trn',
                'Supplier TRN (Tax Registration Number) is missing.',
                'Ensure your company TRN is registered in the system.',
            )
        elif len(supplier_trn) != 15 or not supplier_trn.isdigit():
            self._add(
                'V006', SEVERITY_CRITICAL, 'supplier.trn',
                f'Supplier TRN "{supplier_trn}" is invalid — must be exactly 15 digits.',
                'Correct your TRN to a 15-digit number as issued by the UAE FTA.',
            )

        # At least one line item
        if not self.items:
            self._add(
                'V010', SEVERITY_CRITICAL, 'items',
                'Invoice has no line items.',
                'Include at least one invoice line item with description, quantity, and unit price.',
            )

    # ── UAE VAT FAF Rules (FAF-VAT-*) ─────────────────────────────────────────

    def _run_faf_vat_rules(self):
        inv = self.invoice

        # FAF field 1: Tax Period (can be derived from issue_date — warn if missing)
        if not inv.issue_date:
            self._add(
                'FAF-VAT-01', SEVERITY_CRITICAL, 'issue_date',
                'Tax period cannot be determined without an issue date.',
                'Provide the invoice issue date.',
            )

        # FAF field 3: Taxable Person TRN
        if inv.total_vat > 0 and not getattr(inv.supplier, 'trn', ''):
            self._add(
                'FAF-VAT-03', SEVERITY_CRITICAL, 'supplier.trn',
                'VAT invoice must include the supplier TRN (Taxable Person TRN — FAF Field 3).',
                'Register your TRN with the FTA and include it in all tax invoices.',
            )

        # FAF field 6: Customer TRN (required for B2B)
        if inv.transaction_type == 'b2b':
            # In inbound flow we check receiving company TRN
            recv_trn = getattr(inv.receiving_company, 'trn', '')
            if not recv_trn:
                self._add(
                    'FAF-VAT-06', SEVERITY_HIGH, 'receiving_company.trn',
                    'Customer TRN is required for B2B transactions (FAF Field 6).',
                    'Ensure the receiving company TRN is on file.',
                )

        # FAF field 10: VAT amount
        if inv.total_vat < 0:
            self._add(
                'FAF-VAT-10', SEVERITY_CRITICAL, 'total_vat',
                'VAT amount cannot be negative on a tax invoice.',
                'Correct the VAT calculation. For credit notes, use invoice_type=credit_note.',
            )

        # FAF field 12: Total invoice amount
        expected_total = inv.subtotal + inv.total_vat
        if abs(inv.total_amount - expected_total) > 0.01:
            self._add(
                'FAF-VAT-12', SEVERITY_CRITICAL, 'total_amount',
                f'Total amount {inv.total_amount} does not match subtotal + VAT '
                f'({inv.subtotal} + {inv.total_vat} = {expected_total}).',
                'Recalculate the total_amount as the sum of the taxable amount and VAT.',
            )

        # FAF field 17: Invoice type code
        valid_types = {'tax_invoice', 'credit_note', 'commercial_invoice', 'continuous_supply', 'simplified'}
        if inv.invoice_type and inv.invoice_type not in valid_types:
            self._add(
                'FAF-VAT-17', SEVERITY_CRITICAL, 'invoice_type',
                f'Invoice type "{inv.invoice_type}" is not a recognised UAE FAF invoice type.',
                f'Use one of: {", ".join(sorted(valid_types))}.',
            )

        # FAF field 18: Currency (AED required or exchange rate needed)
        if inv.currency != 'AED':
            self._add(
                'FAF-VAT-18', SEVERITY_MEDIUM, 'currency',
                f'Invoice is in {inv.currency}. The FTA requires the AED equivalent for reporting.',
                'Include the AED exchange rate in your submission.',
            )

    # ── Format Rules (FMT-*) ──────────────────────────────────────────────────

    def _run_format_rules(self):
        inv = self.invoice

        if inv.subtotal < 0:
            self._add(
                'FMT-001', SEVERITY_HIGH, 'subtotal',
                'Subtotal is negative. Use invoice_type=credit_note for negative adjustments.',
                'Resubmit as a credit note if this is a reversal.',
            )

        if inv.total_amount <= 0 and inv.invoice_type == 'tax_invoice':
            self._add(
                'FMT-002', SEVERITY_HIGH, 'total_amount',
                'Tax invoice total amount must be greater than zero.',
                'Check quantities and unit prices. For zero-value corrections use credit notes.',
            )

    # ── Business Logic Rules (BIZ-*) ──────────────────────────────────────────

    def _run_business_rules(self):
        inv = self.invoice

        # Credit notes must reference an original invoice
        if inv.invoice_type == 'credit_note' and not inv.purchase_order_ref:
            self._add(
                'BIZ-001', SEVERITY_HIGH, 'purchase_order_ref',
                'Credit notes should reference the original invoice number.',
                'Include the original invoice number in the purchase_order_ref field.',
            )

        # Due date must not be before issue date
        if inv.due_date and inv.issue_date and inv.due_date < inv.issue_date:
            self._add(
                'BIZ-002', SEVERITY_MEDIUM, 'due_date',
                f'Due date ({inv.due_date}) is before issue date ({inv.issue_date}).',
                'Correct the due date to be on or after the issue date.',
            )

        # Issue date cannot be in the future (allow 1-day tolerance for TZ)
        from django.utils import timezone as tz
        import datetime
        today = tz.localdate()
        if inv.issue_date and inv.issue_date > today + datetime.timedelta(days=1):
            self._add(
                'BIZ-003', SEVERITY_MEDIUM, 'issue_date',
                f'Issue date ({inv.issue_date}) is in the future.',
                'Verify the issue date — invoices should not be pre-dated into the future.',
            )

    # ── Line Item Rules ───────────────────────────────────────────────────────

    def _run_item_rules(self):
        for item in self.items:
            n = item.line_number

            if not item.description or not item.description.strip():
                self._add(
                    'V011', SEVERITY_CRITICAL, 'description',
                    f'Line {n}: Item description is required.',
                    'Provide a clear description for each invoice line item.',
                    line_number=n,
                )

            if item.quantity <= 0:
                self._add(
                    'V012', SEVERITY_CRITICAL, 'quantity',
                    f'Line {n}: Quantity must be greater than zero (got {item.quantity}).',
                    'Correct the quantity for this line item.',
                    line_number=n,
                )

            if item.unit_price < 0:
                self._add(
                    'V013', SEVERITY_HIGH, 'unit_price',
                    f'Line {n}: Unit price is negative ({item.unit_price}).',
                    'Unit prices must be non-negative. Use a credit note for reversals.',
                    line_number=n,
                )

            if float(item.vat_rate) not in (0.0, 5.0):
                self._add(
                    'FAF-VAT-09', SEVERITY_HIGH, 'vat_rate',
                    f'Line {n}: VAT rate {item.vat_rate}% is not a standard UAE rate (0% or 5%).',
                    'Apply the correct UAE VAT rate: 5% standard or 0% zero-rated.',
                    line_number=n,
                )

            # Check line total consistency
            expected_subtotal = round(float(item.quantity) * float(item.unit_price), 2)
            if abs(float(item.subtotal) - expected_subtotal) > 0.02:
                self._add(
                    'FMT-010', SEVERITY_HIGH, 'subtotal',
                    f'Line {n}: Subtotal {item.subtotal} does not match '
                    f'qty × price ({item.quantity} × {item.unit_price} = {expected_subtotal:.2f}).',
                    'Recalculate the line subtotal as quantity × unit_price.',
                    line_number=n,
                )
