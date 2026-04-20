"""
Taxes service layer.

Thin wrapper around VATCalculationService that exposes rate metadata
and on-demand calculations without requiring a full invoice context.
"""
from decimal import Decimal, ROUND_HALF_UP

from apps.common.constants import VAT_RATE_CHOICES

TWO_PLACES = Decimal('0.01')

# ── UAE VAT rate metadata ──────────────────────────────────────────────────────
# Mirrors VAT_RATE_MAP from invoices/models.py but includes display metadata
# for the reference API response.
UAE_VAT_RATES = [
    {
        'code':        'standard',
        'label':       'Standard Rate',
        'rate':        Decimal('5.00'),
        'description': (
            'UAE standard VAT rate of 5%. Applies to most taxable supplies of '
            'goods and services. Governed by Federal Decree-Law No. 8 of 2017.'
        ),
        'input_tax_recovery': True,
    },
    {
        'code':        'zero',
        'label':       'Zero Rate',
        'rate':        Decimal('0.00'),
        'description': (
            '0% VAT — supplies that are taxable but at a nil rate. '
            'Includes exports of goods and services outside the GCC, '
            'international transport, healthcare, education, and residential buildings.'
        ),
        'input_tax_recovery': True,
    },
    {
        'code':        'exempt',
        'label':       'Exempt',
        'rate':        None,
        'description': (
            'Outside the scope of UAE VAT — no VAT is charged and the supplier '
            'cannot recover input tax on related costs. '
            'Includes financial services, bare land, and residential rent.'
        ),
        'input_tax_recovery': False,
    },
    {
        'code':        'out_of_scope',
        'label':       'Out of Scope',
        'rate':        None,
        'description': (
            'Transactions that fall entirely outside UAE VAT law. '
            'Includes supplies made outside the UAE and non-business transactions.'
        ),
        'input_tax_recovery': False,
    },
]

_RATE_MAP = {r['code']: r['rate'] for r in UAE_VAT_RATES}


class TaxRateService:

    @staticmethod
    def get_all_rates() -> list[dict]:
        """Return all UAE VAT rate types with metadata."""
        return UAE_VAT_RATES

    @staticmethod
    def calculate(
        amount: Decimal,
        vat_rate_type: str,
        quantity: Decimal = Decimal('1.0000'),
    ) -> dict:
        """
        Calculate VAT for a given amount and rate type.

        Returns a breakdown dict with:
          subtotal, vat_rate, vat_amount, total_amount
        All values rounded to 2 decimal places (AED fils precision).
        """
        qty = Decimal(str(quantity))
        amt = Decimal(str(amount))

        subtotal = (qty * amt).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        rate = _RATE_MAP.get(vat_rate_type)
        if rate is not None:
            vat_amount = (subtotal * rate / 100).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        else:
            rate = Decimal('0.00')
            vat_amount = Decimal('0.00')

        total_amount = subtotal + vat_amount

        return {
            'vat_rate_type':  vat_rate_type,
            'quantity':        str(qty),
            'unit_amount':     str(amt),
            'subtotal':        str(subtotal),
            'vat_rate':        str(rate),
            'vat_amount':      str(vat_amount),
            'total_amount':    str(total_amount),
            'currency':        'AED',
        }
